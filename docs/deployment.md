---
layout: default
title: Deployment
nav_order: 6
---

# Deployment Guide

## Deploy via Admin Console (Recommended)

1. Start the app: `npm run dev`
2. Sign in (first user with `AUTH_ADMIN_EMAILS` email gets access)
3. Navigate to `/admin/setup` (or use the onboarding flow on first visit)
4. Choose your target (CMA or Busibox)
5. Enter credentials and validate
6. Click "Deploy All Agents"

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

# Run a test session with the Technology Advisor
python deploy.py test

# Archive all agents and environment
python deploy.py cleanup
```

### How deploy.py works

1. Creates a cloud environment with unrestricted networking
2. Deploys base agents (QA Judge) first -- these have no dependencies
3. Deploys dependent agents (all advisors) with `callable_agents` references to QA Judge
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

`.deploy-state.json` tracks deployed agent IDs and environment. This file is gitignored. The Next.js app reads it to resolve agent IDs for session creation.

## Authentication Setup

### Auth.js v5 Configuration

Create `coaches/app/.env.local`:

```env
AUTH_SECRET=<generate-with-openssl-rand-base64-32>
AUTH_TRUST_HOST=true
AUTH_ADMIN_EMAILS=you@example.com
```

### OAuth Providers

To enable Google/GitHub OAuth, add provider credentials:

```env
# Google OAuth
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# GitHub OAuth
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret
```

Without OAuth credentials, the app falls back to email-based credentials authentication using `AUTH_ADMIN_EMAILS`.

### Busibox SSO (Generic OIDC)

```env
AUTH_OIDC_ISSUER=https://your-busibox.example.com
AUTH_OIDC_CLIENT_ID=your-client-id
AUTH_OIDC_CLIENT_SECRET=your-client-secret
```

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
4. Advisors are pushed as agents via the Busibox Agent API
5. When Busibox is connected, advisors gain access to the organization's knowledge base (RAG, search) and user profile/activity adapters switch to Busibox-backed providers
