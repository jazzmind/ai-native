---
layout: default
title: Home
nav_order: 1
---

# AI Executive Team

An AI-native advisory team framework with seven specialized advisors, five operational modes (advise, coach, plan, assist, execute), human/expert-in-the-loop controls, behavioral adaptation, and multi-agent orchestration.

## Getting Started

- [Architecture Guide](architecture.md) -- understand how the platform is built
- [Deployment Guide](deployment.md) -- deploy agents to Claude Managed Agents or Busibox
- [Development Guide](development.md) -- set up your local environment and run tests

## Core Features

### Multi-Agent Advisory Team
Route questions to specialized advisors automatically. The router uses LLM classification to pick 1-4 advisors, selects a lead, and synthesizes their perspectives. Users can also explicitly select advisors or use `@mentions`.

### Agent Modes
Five operational modes control how advisors respond: **Advise** (recommend), **Coach** (Socratic), **Plan** (action items), **Assist** (draft artifacts), **Execute** (take actions). Modes can be set explicitly or auto-detected from message intent.

### Behavioral Adaptation
Thumbs up/down feedback drives an AI-analyzed, human-approved learning loop. When negative feedback accumulates, the system proposes behavioral directives that are injected at runtime without redeploying agents.

### Human in the Loop
Execute mode uses configurable tool trust levels (auto/confirm/blocked) with session-level batch approval. External experts can review conversations and post inline comments that are incorporated into agent context.

### Multi-User & Projects
OAuth/SSO authentication via Auth.js v5. Project-scoped workspaces with per-user deployment targets, knowledge bases, and behavioral directives.

### Knowledge Base
Adapter-based knowledge system supporting standalone SQLite FTS5 or Busibox RAG. Per-project scoping with a common knowledge pool and explicit sharing.

### Desktop App
The platform wraps in Electron for a native desktop experience.

## Documentation

| Guide | Description |
|-------|-------------|
| [Architecture](architecture.md) | System design, data flow, and component overview |
| [Advisors](coaches.md) | Each advisor's expertise, modes, and the QA Judge |
| [Admin Console](admin.md) | Deployment targets, setup wizard, MCP authentication |
| [Deployment](deployment.md) | How to deploy agents to CMA or Busibox |
| [Knowledge Base](knowledge.md) | Knowledge provider interface and project scoping |
| [API Reference](api.md) | All REST API endpoints |
| [Development](development.md) | Local setup, testing, contributing |
