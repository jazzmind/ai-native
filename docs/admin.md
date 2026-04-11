---
layout: default
title: Admin Console
nav_order: 5
---

# Admin Console

## Overview

The admin console (`/admin`) provides a UI for managing deployment targets, deploying coach agents, and connecting MCP servers. It replaces manual env file editing and CLI script execution.

## Setup Wizard

Access at `/admin/setup`. A 4-step flow:

### Step 1: Choose Target Type
- **Claude Managed Agents** -- deploy to Anthropic's managed cloud
- **Busibox** -- deploy to a self-hosted Busibox instance

### Step 2: Enter Credentials
- **CMA**: Anthropic API key
- **Busibox**: Host URL + API key

### Step 3: Validate
Credentials are tested against the target API:
- CMA: sends a minimal Haiku request
- Busibox: hits the `/api/health` endpoint

### Step 4: Deploy
All 8 agents (7 coaches + QA Judge) are deployed to the target. The wizard shows progress and reports success/failure.

## Target Detail Page

Access at `/admin/targets/[id]`. Shows:

### Status Summary
- Deployment status (deployed, error, deploying, unconfigured)
- Number of deployed agents
- Last deployment timestamp

### MCP Server Connections
Manage OAuth connections for MCP servers:
- **Notion** -- opens Notion's OAuth flow at `mcp.notion.com/mcp`
- **Slack** -- opens Slack's OAuth flow at `mcp.slack.com/mcp`
- **Google Workspace** -- requires Claude connector (deferred)

Connection status is tracked per target so you can have different MCP configurations for different deployment targets.

### Deployed Agents
List of all agents with:
- Agent name and ID
- Version number
- Health status (click "Check Status" to poll the target API)

### Actions
- **Redeploy All** -- re-deploys all agents (updates existing, creates missing)
- **Check Status** -- polls the target for agent health
- **Delete** -- removes the target configuration (does not archive deployed agents)

## Config Store

The admin console stores configuration in SQLite with encrypted credentials:

### Tables

**config** -- key-value settings store

**deploy_targets** -- deployment target configurations
- Credentials encrypted at rest using AES-256-GCM
- Key derived from `CONFIG_ENCRYPTION_KEY` env var or a machine-specific fallback
- Agent state (IDs, versions) stored alongside for update/redeploy

**mcp_connections** -- MCP server auth state per target

## Deployment Adapters

The adapter pattern (`lib/deploy/adapter.ts`) defines a common interface:

```typescript
interface DeployAdapter {
  validate(config): Promise<{ valid, error? }>
  deploy(coaches, config): Promise<DeployResult>
  status(config, agentState): Promise<TargetStatus>
  teardown(config, agentState): Promise<{ success, error? }>
}
```

### CMA Adapter
Ports the logic from `deploy.py` to TypeScript:
1. Creates/reuses an environment
2. Deploys base agents (QA Judge) first
3. Deploys dependent agents with `callable_agents` references
4. Prepends date/time preamble to system prompts

### Busibox Adapter
Pushes INSTRUCTIONS.md content to the Busibox Agent API:
1. Validates connection via `/api/health`
2. POSTs each coach to `/api/agents`
3. Checks status via GET `/api/agents`
