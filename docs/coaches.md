---
layout: default
title: Coach Agents
nav_order: 3
---

# Coach Agents

## Overview

Each coach is defined by an `INSTRUCTIONS.md` file in its own directory. This file is the portable core -- it deploys identically to CMA, Busibox, or any future platform.

All coaches share a common structure:
1. **Role definition** -- who they are and what they specialize in
2. **Expertise areas** -- specific domains of knowledge
3. **How they work** -- methodology (understand context, research, present tradeoffs, QA review)
4. **Communication style** -- direct, evidence-based, opinionated
5. **Anti-patterns** -- what they should never do

## Coaches

### Founder Coach (`founder/`)
Aligns personal founder goals with business decisions. Helps with vision clarity, work-life balance, focus prioritization, and keeping the founder on track. Informs all other coaches about the founder's aspirations (unicorn vs lifestyle, active vs passive, etc.).

### Strategy Coach (`strategy/`)
Ensures business strategy is sound and execution is aligned. Sets up KPIs/OKRs, conducts competitive analysis, evaluates market positioning, and identifies strategic risks.

### Funding Coach (`funding/`)
Explores all capital options: VC, PE, angel, bootstrapping (via sales/consulting), debt, grants. Helps prepare pitch materials, models dilution, and guides based on founder goals and business stage. Has the `xlsx` skill for spreadsheet analysis.

### Finance Coach (`finance/`)
Covers financial operations: accounting systems, tax compliance across jurisdictions, FP&A, risk management, insurance, and regulatory requirements. Also has the `xlsx` skill.

### Legal Coach (`legal/`)
Reviews business transactions and contracts. Advises on corporate structure, IP protection, employment law, data privacy, and regulatory compliance.

### Growth Coach (`growth/`)
Designs go-to-market strategies: sales processes, marketing channels, PLG motions, pricing, retention, and customer acquisition. Tracks conversion funnels and growth metrics.

### Technology Coach (`technology/`)
Senior tech advisor covering architecture, AI/ML systems, developer experience, security, and cost engineering. Emphasizes research rigor -- verifies claims with web search, checks GitHub stats, and submits recommendations to the QA Judge.

### QA Judge (`qa-judge/`)
Meta-agent that evaluates the quality of other coaches' recommendations. Checks for:
- **GEO manipulation** -- AI-generated content designed to game search rankings
- **Source credibility** -- GitHub stars, contributor count, community sentiment
- **Reasoning chain validity** -- logical consistency of recommendations
- **Evidence quality** -- whether claims are backed by verifiable data

## Multi-Agent Routing

When a user sends a message, the router decides which coaches should handle it:

1. **Explicit mention**: `@funding what's a typical pre-seed round?` → Funding Coach only
2. **Keyword match**: "How do I structure my cap table?" → Funding Coach (strong keyword overlap)
3. **LLM classification**: "I'm thinking about pivoting our business model" → Strategy + Founder (Haiku classifies)
4. **Fallback**: Ambiguous messages default to the Founder Coach

When multiple coaches are selected, `synthesize=true` triggers a synthesis step: Claude Sonnet reads all coach responses and produces a unified recommendation highlighting agreements, conflicts, and action items.

## QA Judge Integration

Coaches with `callable: ["qa-judge"]` can invoke the QA Judge during their response. The QA Judge evaluates:
- Whether recommended technologies have real adoption (not just GEO)
- Whether financial/legal advice aligns with current regulations
- Whether growth strategies have evidence of working at the user's scale

The QA Judge uses the `research-rubric.md` framework for systematic evaluation.
