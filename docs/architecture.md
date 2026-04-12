---
layout: default
title: Architecture
nav_order: 2
---

# Architecture

## Overview

The AI Executive Team is a Next.js 16 application with an optional Electron shell for desktop deployment. It connects to Claude Managed Agents (CMA) for AI-powered advisory sessions, uses SQLite for local data persistence, and supports multi-user authentication via Auth.js v5.

## Key Design Decisions

### Portable Agent Definitions
Each advisor is defined by an `INSTRUCTIONS.md` file -- a plain Markdown document describing the agent's expertise, methodology, and communication style. This is the portable unit: the same INSTRUCTIONS.md deploys to CMA, Busibox, or any future target.

### Static vs Dynamic Instructions
Agent behavior is split into two layers:

- **Deploy-time (static)**: `INSTRUCTIONS.md` defines the advisor's core identity and expertise. This is baked into the CMA agent's system prompt.
- **Runtime (dynamic)**: Mode templates, behavioral directives, user profile, and expert feedback are prepended to each user message. This allows behavior changes without redeploying agents.

### Multi-Agent Orchestration
The app implements its own orchestration layer:

1. **Router** (`lib/router.ts`) -- uses Claude Haiku to classify each message, select 1-4 advisors, choose a lead, and auto-detect mode
2. **Session Manager** (`lib/session-manager.ts`) -- creates/reuses CMA sessions per advisor per conversation
3. **Mode Injection** -- loads the mode template + behavioral directives + expert comments and prepends them to the contextual message
4. **Synthesis** -- when multiple advisors respond, Claude Sonnet synthesizes their answers with mode-appropriate guidance

### Adapter Pattern
The platform uses adapters for deployment and data providers:

- **Deploy Adapters**: `CMAAdapter`, `BusiboxAdapter` -- same UI deploys to different targets
- **Knowledge Providers**: `StandaloneProvider` (SQLite FTS5), `BusiboxProvider` (RAG)
- **Profile Providers**: `StandaloneProfileProvider` (SQLite), `BusiboxProfileProvider`
- **Activity Providers**: `StandaloneActivityProvider` (SQLite), `BusiboxActivityProvider`

### Local-First Data
All data lives in a SQLite database (`coach-router.db`):

- Conversations, messages, and coach sessions
- Projects, knowledge shares, and user profiles
- Message feedback, behavioral directives, and revision proposals
- Tool trust levels, review requests, and expert comments
- Deployment target configuration (with encrypted credentials)
- Knowledge base (FTS5 for standalone mode)

### Authentication
Auth.js v5 (NextAuth) with JWT sessions. Supports Google, GitHub, and generic OIDC (for Busibox SSO) OAuth providers, plus a credentials fallback for local development. `AUTH_ADMIN_EMAILS` restricts access.

## Data Flow

### Chat Flow

```
User Message + Mode Selection
    │
    ▼
┌─────────┐     ┌───────────┐     ┌──────────────┐
│  Router  │────▶│  Mode +   │────▶│  CMA Agent   │
│ (Haiku)  │     │  Context  │     │  (Streaming)  │
│ +mode    │     │  Builder  │     │              │
└─────────┘     └───────────┘     └──────────────┘
    │                │                     │
    │         ┌──────┘                     │
    │         │  Prepends:                 │
    │         │  • Mode template           │
    │         │  • Behavioral directives   │
    │         │  • Expert comments         │
    │         │  • User profile            │
    │         └──────┐                     │
    │                │                     ▼
    │ (if multi)     │             ┌──────────────┐
    └────────────────┴────────────▶│  Synthesis    │
                                  │  (mode-aware) │
                                  └──────────────┘
```

### Feedback → Behavioral Adaptation Flow

```
Thumbs Down (accumulated)
    │
    ▼
┌─────────────┐     ┌───────────────┐     ┌─────────────┐
│  Threshold  │────▶│  AI Analysis  │────▶│  Proposed    │
│  Check      │     │  (Haiku)      │     │  Revision    │
└─────────────┘     └───────────────┘     └──────┬──────┘
                                                 │
                                          ┌──────▼──────┐
                                          │  User       │
                                          │  Review     │
                                          │  (approve/  │
                                          │   reject)   │
                                          └──────┬──────┘
                                                 │ approve
                                          ┌──────▼──────┐
                                          │  Active     │
                                          │  Directive  │──▶ Injected into
                                          └─────────────┘    every message
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, Lucide icons |
| Framework | Next.js 16 (App Router, Turbopack) |
| Backend | Next.js API Routes (Node.js runtime) |
| Auth | Auth.js v5 (NextAuth) with JWT sessions |
| Database | SQLite via better-sqlite3 (WAL mode) |
| AI | Claude Managed Agents (Anthropic API) |
| Desktop | Electron 41 |
| Markdown | react-markdown + remark-gfm |

## File Organization

### `lib/` -- Core Libraries

| Module | Purpose |
|--------|---------|
| `coaches.ts` | Client-side advisor metadata (keys, names, icons, keywords) |
| `coaches-server.ts` | Server-side advisor config (loads deploy state, agent IDs) |
| `modes.ts` | Mode types, metadata, validation (client-safe) |
| `modes-server.ts` | Mode template file loader (server-only, uses `fs`) |
| `db.ts` | All SQLite tables, CRUD for conversations, feedback, behaviors, tool trust, reviews |
| `router.ts` | Mode-aware multi-agent message routing |
| `session-manager.ts` | CMA session lifecycle |
| `config-store.ts` | Encrypted config & deploy target management (per-user) |
| `behavior-analysis.ts` | Threshold detection and AI-driven revision proposals |
| `review-tokens.ts` | Guest access token generation for expert reviews |
| `auth.ts` | Auth.js configuration, `getRequiredUser()`, `handleAuthError()` |
| `deploy/` | Deployment adapter interface + CMA & Busibox implementations |
| `knowledge/` | Knowledge provider interface + Busibox & standalone (per-project) |
| `profile/` | User profile provider interface + Busibox & standalone (per-user) |
| `activity/` | Agent activity provider interface + Busibox & standalone |

### `app/` -- Next.js Pages & Routes

| Route | Purpose |
|-------|---------|
| `/` | Chat interface with mode selector and advisor picker |
| `/behaviors` | Behavioral directives management and revision review |
| `/effectiveness` | Effectiveness dashboard with per-advisor metrics |
| `/reviews` | Expert review request tracking |
| `/knowledge` | Knowledge base management (per-project scoped) |
| `/projects` | Project management |
| `/settings/tools` | Tool trust level configuration |
| `/admin` | Deployment target dashboard |
| `/admin/setup` | Setup wizard for new targets |
| `/review/[token]` | Guest expert review page (no auth required) |
| `/login` | Authentication page |

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Send message with mode, receive SSE stream |
| `/api/conversations` | GET | List conversations (project-scoped) |
| `/api/feedback` | GET/POST | Message feedback stats and submission |
| `/api/behaviors` | GET/POST | Behavioral directives CRUD and revision review |
| `/api/behaviors/analyze` | POST | Trigger AI behavior analysis |
| `/api/tools` | GET/POST | Tool trust level management |
| `/api/reviews` | GET/POST | Expert review request management |
| `/api/reviews/[id]/comments` | GET/POST | Expert comment submission |
| `/api/review-access/[token]` | GET | Guest access token validation |
| `/api/effectiveness` | GET | Effectiveness dashboard data |
| `/api/knowledge` | GET/POST/PUT/DELETE | Knowledge base operations |
| `/api/profile` | GET/POST/DELETE | User profile management |
| `/api/projects` | GET/POST | Project CRUD |
| `/api/admin/targets` | GET/POST | Target CRUD |
| `/api/admin/targets/[id]/deploy` | POST | Trigger deployment |
| `/api/admin/targets/[id]/status` | GET | Check agent health |
| `/api/admin/setup` | POST | Validate credentials |
| `/api/admin/config` | GET/POST | App configuration |
| `/api/admin/mcp` | GET/POST | MCP connection management |
