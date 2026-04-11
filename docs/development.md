---
layout: default
title: Development
nav_order: 9
---

# Development Guide

## Prerequisites

- **Node.js** 20+
- **Python** 3.11+ (for `deploy.py`)
- **npm** 10+

## Setup

```bash
# Clone the repo
git clone git@github.com:jazzmind/ai-native.git
cd ai-native/coaches/app

# Install dependencies
npm install

# Set up environment
cp ../.env.example ../.env
# Edit .env with your ANTHROPIC_API_KEY
```

## Development Server

```bash
npm run dev
```

Starts Next.js with Turbopack on [http://localhost:3000](http://localhost:3000).

## Electron Development

```bash
npm run electron:dev
```

Runs Next.js dev server and Electron concurrently. Electron opens a window pointing to the dev server.

## Building

```bash
# Next.js production build
npm run build

# Electron packaging
npm run electron:build

# Electron unpackaged (for testing)
npm run electron:pack
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run src/lib/__tests__/router.test.ts

# Watch mode
npx vitest
```

### Test Structure

Tests live alongside their source in `__tests__/` directories:

```
src/lib/
├── __tests__/
│   ├── config-store.test.ts   # Config store tests
│   ├── knowledge.test.ts      # Knowledge provider tests
│   └── router.test.ts         # Router logic tests
```

### Testing Philosophy

Per project rules:
- **No mocks or fake data** unless explicitly needed
- Tests use real SQLite databases (in-memory or temp files)
- API route tests make real HTTP calls against the dev server

## Code Style

- TypeScript strict mode
- Tailwind CSS for all styling (no inline styles)
- React Server Components where possible, `"use client"` only when needed
- `@/` path alias for `src/`

## Key Conventions

### Adding a New Coach

1. Create `coaches/new-coach/INSTRUCTIONS.md`
2. Add entry to `COACH_CONFIGS` in `deploy.py`
3. Add entry to `COACH_META` in `app/src/lib/coaches.ts`
4. Add entry to `COACH_CONFIGS` in `app/src/lib/deploy/coach-loader.ts`
5. Run `python deploy.py deploy` to deploy

### Adding a New API Route

1. Create directory under `src/app/api/`
2. Export `GET`, `POST`, etc. from `route.ts`
3. Use `NextRequest` for typed request handling
4. Return `Response.json()` for JSON responses

### Adding a Deploy Adapter

1. Implement the `DeployAdapter` interface from `lib/deploy/adapter.ts`
2. Register in `lib/deploy/index.ts`
3. Add the type to the setup wizard UI
4. Add to the target type labels in the admin dashboard

## Database

SQLite via `better-sqlite3` in WAL mode. The database file `coach-router.db` is created in the app's working directory on first access.

Tables are auto-created by each module's `getDb()` function. No migration system -- schema changes are additive via `CREATE TABLE IF NOT EXISTS`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | API key for Claude |
| `COACH_MCP_ENABLED` | No | Enable MCP servers in deploy.py (`true`/`false`) |
| `CONFIG_ENCRYPTION_KEY` | No | Override key for credential encryption |
