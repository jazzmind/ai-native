---
layout: default
title: Home
nav_order: 1
---

# AI-Native Coach Platform

An AI-powered executive coaching team providing specialized business guidance across seven domains with multi-agent orchestration and a deployment admin console.

## Getting Started

- [Architecture Guide](architecture.md) -- understand how the platform is built
- [Deployment Guide](deployment.md) -- deploy agents to Claude Managed Agents or Busibox
- [Development Guide](development.md) -- set up your local environment and run tests

## Core Features

### Multi-Agent Chat
Route questions to specialized coaches automatically. The router uses keyword matching and LLM classification to pick the right expert. When a question spans domains, multiple coaches respond and their answers are synthesized.

### Admin Console
A setup wizard for deploying coaches to different targets. Currently supports Claude Managed Agents and Busibox. Manages API keys, MCP server authentication, and agent health monitoring.

### Knowledge Base
When connected to Busibox, coaches can query organizational documents, contracts, and strategy materials. Falls back to local SQLite FTS5 search when Busibox is not available.

### Desktop App
The platform wraps in Electron for a native desktop experience. Runs the Next.js server locally and opens a browser window to it.

## Documentation

| Guide | Description |
|-------|-------------|
| [Architecture](architecture.md) | System design, data flow, and component overview |
| [Coaches](coaches.md) | Each coach's expertise and how the QA Judge works |
| [Admin Console](admin.md) | Deployment targets, setup wizard, MCP authentication |
| [Deployment](deployment.md) | How to deploy agents to CMA or Busibox |
| [Knowledge Base](knowledge.md) | Knowledge provider interface and Busibox integration |
| [API Reference](api.md) | All REST API endpoints |
| [Development](development.md) | Local setup, testing, contributing |
