---
layout: default
title: Advisors
nav_order: 3
---

# Advisors

## Overview

Each advisor is defined by an `INSTRUCTIONS.md` file in its own directory. This file is the portable core -- it deploys identically to CMA, Busibox, or any future platform. At runtime, behavior is further shaped by the active mode, behavioral directives, and user profile context.

All advisors share a common structure:
1. **Role definition** -- who they are and what they specialize in
2. **Expertise areas** -- specific domains of knowledge
3. **How they work** -- methodology (understand context, research, present tradeoffs, QA review)
4. **Communication style** -- direct, evidence-based, opinionated
5. **Anti-patterns** -- what they should never do

## Operational Modes

Every advisor can operate in five modes. The mode is either selected explicitly by the user or auto-detected by the router from message intent:

| Mode | Behavior | Tools | Typical Advisor Count |
|------|----------|-------|----------------------|
| **Advise** | Research + recommend | Search only | 2-4 (broad perspective) |
| **Coach** | Socratic method | Minimal | 1 (focused dialogue) |
| **Plan** | Structured action items | Research + docs | 2-4 (broad perspective) |
| **Assist** | Prep work, flag decisions | Research + drafting | 1-3 |
| **Execute** | Decide and act | Full tool access | 1-2 (most relevant) |

Mode templates are stored in `coaches/modes/` and injected into every message at runtime. Behavioral directives (learned per advisor per project) can further customize behavior within a mode.

## Advisors

### Founder Advisor (`founder/`)
Aligns personal founder goals with business decisions. Helps with vision clarity, work-life balance, focus prioritization, and keeping the founder on track. Informs all other advisors about the founder's aspirations.

### Strategy Advisor (`strategy/`)
Ensures business strategy is sound and execution is aligned. Sets up KPIs/OKRs, conducts competitive analysis, evaluates market positioning, and identifies strategic risks.

### Funding Advisor (`funding/`)
Explores all capital options: VC, PE, angel, bootstrapping, debt, grants. Helps prepare pitch materials, models dilution, and guides based on founder goals. Has the `xlsx` skill for spreadsheet analysis.

### Finance Advisor (`finance/`)
Covers financial operations: accounting systems, tax compliance across jurisdictions, FP&A, risk management, insurance, and regulatory requirements. Also has the `xlsx` skill.

### Legal Advisor (`legal/`)
Reviews business transactions and contracts. Advises on corporate structure, IP protection, employment law, data privacy, and regulatory compliance.

### Growth Advisor (`growth/`)
Designs go-to-market strategies: sales processes, marketing channels, PLG motions, pricing, retention, and customer acquisition.

### Technology Advisor (`technology/`)
Senior tech advisor covering architecture, AI/ML systems, developer experience, security, and cost engineering. Emphasizes research rigor -- verifies claims with web search, checks GitHub stats, and submits recommendations to the QA Judge.

### QA Judge (`qa-judge/`)
Meta-agent that evaluates the quality of other advisors' recommendations. Checks for GEO manipulation, source credibility, reasoning chain validity, and evidence quality.

## Multi-Agent Routing

When a user sends a message, the router decides which advisors should handle it and in what mode:

1. **Explicit mention**: `@funding what's a typical pre-seed round?` → Funding Advisor only
2. **LLM classification**: Claude Haiku parses the message and selects 1-4 advisors + a lead + a mode
3. **Fallback**: Ambiguous messages default to the Founder Advisor in advise mode

When multiple advisors are selected, the lead advisor synthesizes all responses with mode-appropriate guidance (e.g., a plan-mode synthesis produces a unified action plan, not just a summary).

### Mode Auto-Detection

The router detects mode from message intent:
- "help me understand" / "what should I" → **advise**
- "how do I get better at" / "teach me" → **coach**
- "create a plan for" / "what are the steps" → **plan**
- "prepare" / "draft" / "put together" → **assist**
- "do it" / "set up" / "send" / "create" → **execute**

## Behavioral Directives

Each advisor's behavior can be customized per project through behavioral directives -- short instructions injected at runtime:

- Manually created by the user (e.g., "Always use Australian tax context")
- Proposed by AI analysis when negative feedback accumulates (3+ thumbs-down in 7 days or >30% negative rate)
- AI proposals require human approval before activation

Active directives are prepended to every message alongside the mode template and user profile.

## QA Judge Integration

Advisors with `callable: ["qa-judge"]` can invoke the QA Judge during their response. The QA Judge evaluates:
- Whether recommended technologies have real adoption (not just GEO)
- Whether financial/legal advice aligns with current regulations
- Whether growth strategies have evidence of working at the user's scale

The QA Judge uses the `research-rubric.md` framework for systematic evaluation.
