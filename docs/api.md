---
layout: default
title: API Reference
nav_order: 8
---

# API Reference

All API routes are under the Next.js app at `coaches/app/src/app/api/`. All endpoints (except review access) require authentication via Auth.js session.

## Chat

### POST /api/chat

Send a message and receive a streaming response via Server-Sent Events.

**Request Body:**
```json
{
  "message": "How should I structure my cap table?",
  "conversationId": "uuid (optional, creates new if missing)",
  "coachKey": "funding (optional, bypasses routing)",
  "mode": "advise (optional, auto-detected if omitted)"
}
```

**SSE Events:**

| Event Type | Fields | Description |
|------------|--------|-------------|
| `routing` | `conversationId`, `coaches[]`, `reasoning`, `synthesize`, `lead`, `mode` | Which advisors were selected and in what mode |
| `coach_start` | `coachKey`, `coachName` | Advisor begins responding |
| `text` | `content`, `coachKey` | Streamed text chunk |
| `tool_use` | `tool`, `coachKey` | Advisor used a tool |
| `error` | `content`, `coachKey` | Error occurred |
| `coach_done` | `coachKey` | Advisor finished responding |
| `synthesis_start` | | Multi-advisor synthesis begins |
| `synthesis_text` | `content` | Synthesized response |
| `synthesis_done` | | Synthesis complete |
| `done` | `conversationId` | All processing complete |

## Conversations

### GET /api/conversations

List all conversations for the current user, scoped by project.

**Query Parameters:**
- `projectId` -- filter by project (defaults to active project)
- `id` -- get a specific conversation with its messages, activity, and expert comments

**Response:**
```json
{
  "conversations": [
    { "id": "uuid", "title": "How should I...", "updated_at": "2024-..." }
  ]
}
```

## Feedback

### GET /api/feedback

Retrieve aggregated feedback statistics.

**Query Parameters:**
- `projectId` -- scope to project
- `coachKey` -- filter by advisor
- `mode` -- filter by mode
- `days` -- lookback window (default: 30)

**Response:**
```json
{
  "stats": { "total": 42, "positive": 35, "negative": 7, "rate": 0.833 },
  "byCoach": { "technology": { "positive": 10, "negative": 2 } },
  "byMode": { "advise": { "positive": 15, "negative": 3 } }
}
```

### POST /api/feedback

Submit feedback for a message.

```json
{
  "messageId": "uuid",
  "conversationId": "uuid",
  "coachKey": "technology",
  "mode": "advise",
  "rating": "positive",
  "comment": "optional free-text"
}
```

## Behaviors

### GET /api/behaviors

List behavioral directives and pending revisions.

**Query Parameters:**
- `projectId` -- scope to project

**Response:**
```json
{
  "behaviors": [{ "id": "uuid", "coach_key": "technology", "directive": "...", "is_active": 1 }],
  "revisions": [{ "id": "uuid", "behavior_id": null, "proposed_directive": "...", "analysis": "...", "status": "pending" }]
}
```

### POST /api/behaviors

Manage directives and review proposals.

**Actions:**

| Action | Fields | Description |
|--------|--------|-------------|
| `create` | `coachKey`, `directive`, `projectId` | Add a new behavioral directive |
| `update` | `id`, `directive?`, `is_active?` | Update directive text or toggle active state |
| `delete` | `id` | Remove a directive |
| `approve_revision` | `revisionId` | Approve a pending AI-proposed revision |
| `reject_revision` | `revisionId` | Reject a pending revision |

### POST /api/behaviors/analyze

Trigger AI analysis of recent negative feedback. Creates revision proposals for advisors with poor feedback patterns.

```json
{ "projectId": "uuid" }
```

## Tool Trust

### GET /api/tools

List tool trust levels for a project.

**Query Parameters:**
- `projectId` -- scope to project

### POST /api/tools

Manage tool trust configuration.

| Action | Fields | Description |
|--------|--------|-------------|
| `set` | `toolPattern`, `trustLevel`, `projectId` | Set trust level (auto/confirm/blocked) |
| `delete` | `id` | Remove a trust override |

## Reviews

### GET /api/reviews

List expert review requests for the current user.

### POST /api/reviews

Create or update review requests.

**Create:**
```json
{
  "action": "create",
  "conversationId": "uuid",
  "expertEmail": "expert@example.com",
  "question": "Can you review our tax strategy?"
}
```

**Update Status:**
```json
{
  "action": "update_status",
  "reviewId": "uuid",
  "status": "completed"
}
```

### GET /api/reviews/[id]/comments

Get all expert comments for a review.

### POST /api/reviews/[id]/comments

Add an expert comment.

```json
{
  "content": "I'd recommend a different approach...",
  "parentMessageId": "uuid (optional, anchors to a specific message)"
}
```

### GET /api/review-access/[token]

**No auth required.** Validates a guest access token and returns the scoped review context including conversation messages and existing expert comments.

## Effectiveness

### GET /api/effectiveness

Aggregated effectiveness metrics for the dashboard.

**Query Parameters:**
- `projectId` -- scope to project

**Response:**
```json
{
  "feedbackByCoach": { "technology": { "positive": 20, "negative": 3 } },
  "feedbackByMode": { "advise": { "positive": 15, "negative": 2 } },
  "timeline": [{ "date": "2024-01-15", "positive": 5, "negative": 1 }],
  "modeDistribution": { "advise": 45, "coach": 20, "plan": 15, "assist": 12, "execute": 8 },
  "revisions": [{ "id": "uuid", "coach_key": "growth", "analysis": "...", "status": "approved" }]
}
```

## Knowledge

### GET /api/knowledge?action=status
Returns provider type and availability.

### GET /api/knowledge?action=collections
Lists knowledge collections (project-scoped).

### POST /api/knowledge

**Search:**
```json
{ "action": "search", "query": "cap table structure", "limit": 5 }
```

**Ingest:**
```json
{ "action": "ingest", "content": "...", "title": "Q1 Report", "collection": "finance" }
```

## Profile

### GET /api/profile
Get user profile facts.

### POST /api/profile
Add or update profile facts.

### DELETE /api/profile
Remove a profile fact.

## Projects

### GET /api/projects
List projects for the current user.

### POST /api/projects
Create a new project or update an existing one.

## Admin

### GET /api/admin/targets
List all deployment targets for the current user.

### POST /api/admin/targets
Create a target or delete one (`action: "delete"`).

### POST /api/admin/targets/[id]/deploy
Deploy all advisors to a target.

### GET /api/admin/targets/[id]/status
Check agent health on a target.

### POST /api/admin/setup
Validate credentials for a target type.

### GET/POST /api/admin/config
Get/set app configuration key-value pairs.

### GET/POST /api/admin/mcp
MCP server connection management.
