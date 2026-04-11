---
layout: default
title: Architecture
nav_order: 2
---

# Architecture

## Overview

The Coach Platform is a Next.js 16 application with an optional Electron shell for desktop deployment. It connects to Claude Managed Agents (CMA) for AI-powered coaching and uses SQLite for local data persistence.

## Key Design Decisions

### Portable Agent Definitions
Each coach is defined by an `INSTRUCTIONS.md` file -- a plain Markdown document describing the agent's expertise, how it works, and its communication style. This is the portable unit: the same INSTRUCTIONS.md deploys to CMA, Busibox, or any future target.

### Multi-Agent Orchestration
Since CMA's native `callable_agents` is still in Research Preview, the app implements its own orchestration:

1. **Router** (`lib/router.ts`) -- classifies each user message and picks 1-3 coaches
2. **Session Manager** (`lib/session-manager.ts`) -- creates/reuses CMA sessions per coach per conversation
3. **Synthesis** -- when multiple coaches respond, Claude Sonnet synthesizes their answers into a unified recommendation

### Adapter Pattern for Deployment
The deploy layer uses an adapter interface (`lib/deploy/adapter.ts`) so the same UI and logic can deploy to different targets:

- `CMAAdapter` -- creates/updates agents via the Anthropic API
- `BusiboxAdapter` -- pushes INSTRUCTIONS.md via the Busibox Agent API

### Local-First Data
All data lives in a SQLite database (`coach-router.db`) in the app directory:

- Conversation history and coach sessions
- Deployment target configuration (with encrypted credentials)
- Knowledge base (FTS5 for standalone mode)

## Data Flow

### Chat Flow

```
User Message
    │
    ▼
┌─────────┐     ┌──────────┐     ┌──────────────┐
│  Router  │────▶│  Session  │────▶│  CMA Agent   │
│ (Haiku)  │     │  Manager  │     │  (Streaming)  │
└─────────┘     └──────────┘     └──────────────┘
    │                                    │
    │ (if multi-coach)                   │
    │                                    ▼
    │                            ┌──────────────┐
    └───────────────────────────▶│  Synthesis    │
                                │  (Sonnet)     │
                                └──────────────┘
```

### Routing Algorithm

1. Check for explicit `@mention` (e.g., "@funding what's a typical pre-seed round?")
2. Score by keyword overlap with each coach's keyword list
3. If one coach scores 2x+ higher than the next, pick it
4. Otherwise, use Claude Haiku to classify into 1-3 coaches
5. Fallback: Founder Coach

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, Recharts, Lucide icons |
| Framework | Next.js 16 (App Router, Turbopack) |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| AI | Claude Managed Agents (Anthropic API) |
| Desktop | Electron 41 |
| Markdown | react-markdown + remark-gfm |
| Build | Turbopack (dev), Next.js (prod), electron-builder (desktop) |

## File Organization

### `lib/` -- Core Libraries

| Module | Purpose |
|--------|---------|
| `coaches.ts` | Client-side coach metadata (keys, names, icons, keywords) |
| `coaches-server.ts` | Server-side coach config (loads deploy state, agent IDs) |
| `db.ts` | Conversation & message persistence |
| `router.ts` | Multi-agent message routing |
| `session-manager.ts` | CMA session lifecycle |
| `config-store.ts` | Encrypted config & deploy target management |
| `deploy/` | Deployment adapter interface + CMA & Busibox implementations |
| `knowledge/` | Knowledge provider interface + Busibox & standalone providers |

### `app/` -- Next.js Pages & Routes

| Route | Purpose |
|-------|---------|
| `/` | Chat interface with sidebar |
| `/admin` | Deployment target dashboard |
| `/admin/setup` | Setup wizard for new targets |
| `/admin/targets/[id]` | Target detail with agent status & MCP connections |

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Send message, receive SSE stream |
| `/api/conversations` | GET | List conversations |
| `/api/knowledge` | GET/POST | Knowledge base search & ingest |
| `/api/admin/targets` | GET/POST | Target CRUD |
| `/api/admin/targets/[id]/deploy` | POST | Trigger deployment |
| `/api/admin/targets/[id]/status` | GET | Check agent health |
| `/api/admin/setup` | POST | Validate credentials |
| `/api/admin/config` | GET/POST | App configuration |
| `/api/admin/mcp` | GET/POST | MCP connection management |
