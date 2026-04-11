---
layout: default
title: Deployment
nav_order: 6
---

# Deployment Guide

## Deploy via Admin Console (Recommended)

1. Start the app: `npm run dev`
2. Navigate to `/admin/setup`
3. Choose your target (CMA or Busibox)
4. Enter credentials and validate
5. Click "Deploy All Agents"

## Deploy via CLI (deploy.py)

The Python script provides direct control over CMA deployment.

### Prerequisites

```bash
pip install anthropic
```

### Commands

```bash
# Deploy all agents
python deploy.py deploy

# List deployed agents
python deploy.py list

# Run a test session with the Technology Coach
python deploy.py test

# Archive all agents and environment
python deploy.py cleanup
```

### How deploy.py works

1. Creates a cloud environment with unrestricted networking
2. Deploys base agents (QA Judge) first -- these have no dependencies
3. Deploys dependent agents (all coaches) with `callable_agents` references to QA Judge
4. Saves state to `.deploy-state.json` (agent IDs, versions, environment ID)

### Configuration

Set `ANTHROPIC_API_KEY` via environment variable, `.env` file, or `--api-key` flag.

MCP servers (Notion, Slack) are disabled by default. Enable with:
```bash
export COACH_MCP_ENABLED=true
```

### Agent Model

All agents use `claude-sonnet-4-6`. The QA Judge runs the same model to ensure evaluation quality matches recommendation quality.

### Deploy State

`.deploy-state.json` tracks:
```json
{
  "agents": {
    "qa-judge": { "id": "agent_...", "version": 1, "name": "QA Judge" },
    "technology": { "id": "agent_...", "version": 1, "name": "Technology Coach" }
  },
  "environment_id": "env_..."
}
```

The Next.js app reads this file to resolve agent IDs for session creation.

## Deploying the Next.js App

### Development

```bash
npm run dev
```

### Production (standalone server)

```bash
npm run build
npm run start
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Electron Desktop App

```bash
# Development
npm run electron:dev

# Package for distribution
npm run electron:build
```

Produces platform-specific installers:
- **macOS**: DMG + ZIP
- **Windows**: NSIS installer + portable
- **Linux**: AppImage + DEB

## Busibox Deployment

When deploying to Busibox:

1. Ensure your Busibox instance is running and accessible
2. Generate an API key in Busibox admin
3. Use the admin console setup wizard with the Busibox host URL and API key
4. Coaches are pushed as agents via the Busibox Agent API
5. When Busibox is connected, coaches gain access to the organization's knowledge base (RAG, search)
