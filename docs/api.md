---
layout: default
title: API Reference
nav_order: 8
---

# API Reference

All API routes are under the Next.js app at `coaches/app/src/app/api/`.

## Chat

### POST /api/chat

Send a message and receive a streaming response via Server-Sent Events.

**Request Body:**
```json
{
  "message": "How should I structure my cap table?",
  "conversationId": "uuid (optional, creates new if missing)",
  "coachKey": "funding (optional, bypasses routing)"
}
```

**SSE Events:**

| Event Type | Fields | Description |
|------------|--------|-------------|
| `routing` | `conversationId`, `coaches[]`, `reasoning`, `synthesize` | Which coaches were selected |
| `coach_start` | `coachKey`, `coachName` | Coach begins responding |
| `text` | `content`, `coachKey` | Streamed text chunk |
| `tool_use` | `tool`, `coachKey` | Coach used a tool |
| `error` | `content`, `coachKey` | Error occurred |
| `coach_done` | `coachKey` | Coach finished responding |
| `synthesis_start` | | Multi-coach synthesis begins |
| `synthesis_text` | `content` | Synthesized response |
| `synthesis_done` | | Synthesis complete |
| `done` | `conversationId` | All processing complete |

## Conversations

### GET /api/conversations

List all conversations ordered by most recent.

**Response:**
```json
{
  "conversations": [
    { "id": "uuid", "title": "How should I...", "updated_at": "2024-..." }
  ]
}
```

## Admin

### GET /api/admin/targets
List all deployment targets.

### POST /api/admin/targets
Create a target or delete one (`action: "delete"`).

**Create:**
```json
{
  "type": "cma",
  "name": "My Claude Agents",
  "config": { "apiKey": "sk-ant-..." }
}
```

### POST /api/admin/targets/[id]/deploy
Deploy all coaches to a target.

### GET /api/admin/targets/[id]/status
Check agent health on a target.

### POST /api/admin/setup
Validate credentials for a target type.

```json
{ "type": "cma", "config": { "apiKey": "sk-ant-..." } }
```

### GET/POST /api/admin/config
Get/set app configuration key-value pairs.

### GET /api/admin/mcp?targetId=ID
List MCP server connections for a target.

### POST /api/admin/mcp
Connect/disconnect MCP servers.

```json
{ "action": "connect", "targetId": "...", "mcpName": "notion" }
```

## Knowledge

### GET /api/knowledge?action=status
Returns provider type and availability.

### GET /api/knowledge?action=collections
Lists knowledge collections.

### POST /api/knowledge
Search or ingest documents.

**Search:**
```json
{ "action": "search", "query": "cap table structure", "limit": 5 }
```

**Ingest:**
```json
{ "action": "ingest", "content": "...", "title": "Q1 Report", "collection": "finance" }
```
