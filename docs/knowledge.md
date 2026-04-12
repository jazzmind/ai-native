---
layout: default
title: Knowledge Base
nav_order: 7
---

# Knowledge Base Integration

## Overview

The knowledge base integration allows advisors to query organization-specific documents, making them contextually aware of the business they're advising. The system uses a provider pattern to support multiple backends and is scoped per-project with a "common" knowledge pool shared across projects.

## Provider Interface

```typescript
interface KnowledgeProvider {
  search(query, options?): Promise<SearchResult[]>
  ingest(doc, collection?): Promise<{ id: string }>
  listCollections(): Promise<Collection[]>
  isAvailable(): Promise<boolean>
}
```

## Providers

### Busibox Provider
When a Busibox deployment target is configured and deployed, the platform automatically uses Busibox for knowledge operations:

- **Search** -- hybrid search (vector + keyword) via Busibox Search API
- **Ingest** -- document storage via Busibox Data API
- **Collections** -- maps to Busibox collections

Busibox provides:
- **Data API** -- document storage with metadata
- **Search API** -- hybrid vector + keyword search
- **Docs API** -- document processing and chunking
- **Embedding API** -- vector embeddings for RAG

### Standalone Provider (Local Fallback)
When no Busibox instance is configured, a local SQLite FTS5 index provides basic full-text search:

- Uses SQLite's built-in FTS5 extension for tokenized search
- Stores documents in the same `coach-router.db` database
- Supports collections and metadata
- No vector embeddings -- keyword-based ranking only

## Project Scoping

Knowledge is scoped by project and user:

- **Per-project knowledge**: Documents ingested into a project are only accessible within that project
- **Common knowledge pool**: Items tagged as "common" are accessible across all of a user's projects
- **Knowledge sharing**: Explicit sharing between projects via the knowledge share table

This means advisors working on a fintech project see fintech-relevant documents, while advisors on a healthtech project see healthtech-relevant ones. Common knowledge (company policies, founder preferences, etc.) is always available.

## Auto-Detection

The knowledge provider is automatically selected:

1. Check for deployed Busibox targets in the config store (per-user)
2. If a Busibox target with `status=deployed` exists and has valid credentials, use `BusiboxKnowledgeProvider`
3. Otherwise, use `StandaloneKnowledgeProvider`

Reset with `resetKnowledgeProvider()` when target configuration changes.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/knowledge?action=status` | GET | Provider type and availability |
| `/api/knowledge?action=collections` | GET | List knowledge collections (project-scoped) |
| `/api/knowledge` | POST `{action: "search", query}` | Search documents |
| `/api/knowledge` | POST `{action: "ingest", content, title}` | Add a document |

## Other Data Adapters

The adapter pattern extends beyond knowledge:

### Profile Provider
User profile facts (global per-user, not per-project):
- `StandaloneProfileProvider` -- SQLite-backed
- `BusiboxProfileProvider` -- Busibox Data API

### Activity Provider
Agent activity logging (tool use, delegations, token usage):
- `StandaloneActivityProvider` -- SQLite-backed
- `BusiboxActivityProvider` -- Busibox Data API

## System Prompt Augmentation

When a knowledge provider is configured, advisors can have their system prompt augmented with context about available organizational knowledge.

## Use Cases

- **Legal Advisor** searching contracts and agreements
- **Finance Advisor** querying financial reports and budgets
- **Strategy Advisor** reviewing strategic planning documents
- **Technology Advisor** accessing architecture decision records
- **Funding Advisor** referencing previous term sheets and cap table models
