---
name: unit-economics-check
description: Sanity-check CAC, LTV, margin, and payback period before escalating to finance or funding — surfaces whether the business model is fundamentally sound at the unit level.
advisors: [finance, funding, growth]
---

# Unit Economics Check

You verify that the business makes money at the unit level before analyzing it at the portfolio level.

Companies with beautiful pitch decks and terrible unit economics fail predictably. This skill is not a full financial model — it is a sanity check that surfaces whether the core economic engine is sound. It is used by growth advisors before GTM decisions, by funding advisors before pitch preparation, and by finance advisors before budget allocation.

## When To Use

Use this skill when:

- evaluating a new product line, pricing tier, or market segment;
- preparing a fundraising pitch that will include financial metrics;
- deciding whether to increase customer acquisition spend;
- a growth plan assumes scale will "fix the economics";
- the user is unsure whether the business model works at the unit level.

Do not use it for pre-revenue, pre-market-fit companies where the unit economics are definitionally unknown — flag this instead.

## Core Metrics

### Customer Acquisition Cost (CAC)

```
CAC = Total Sales + Marketing Spend / Number of New Customers Acquired
```

In the same period.

### Customer Lifetime Value (LTV)

For subscription:
```
LTV = ARPU × Gross Margin % × (1 / Monthly Churn Rate)
```

For transactional:
```
LTV = Average Order Value × Gross Margin % × Purchase Frequency × Customer Lifespan
```

### LTV:CAC Ratio

- **< 1:** Business loses money on every customer. Unsustainable.
- **1-3:** Marginal. Possible at high scale with improving economics.
- **3+:** Generally healthy for VC-backed SaaS. Target for most B2B.
- **5+:** Either a great business or a measurement error. Verify.

### Payback Period

```
Payback = CAC / (ARPU × Gross Margin %)
```

- **< 12 months:** Strong. Capital-efficient growth is possible.
- **12-24 months:** Manageable with adequate funding.
- **> 24 months:** Requires significant capital to sustain growth. High risk.

### Gross Margin

- **SaaS:** 70-80%+ is typical. Below 50% is concerning.
- **Marketplace:** 20-40% net take rate.
- **Physical goods:** 30-60% depending on category.
- **Services:** 40-70%.

## Process

### 1. Collect Current Metrics

Ask the user for (or estimate from available data):

- Monthly/annual revenue
- Number of customers
- Customer acquisition spend (last 12 months)
- New customers acquired (last 12 months)
- Average revenue per user (ARPU)
- Monthly churn rate
- Cost of goods sold / cost to serve

### 2. Calculate Core Ratios

Compute: CAC, LTV, LTV:CAC, Payback, Gross Margin.

If data is missing, use the best available estimate and flag uncertainty.

### 3. Benchmark

Compare ratios to healthy benchmarks for the business model (SaaS, marketplace, transactional, services).

### 4. Identify The Constraint

Identify the primary unit economics constraint:

- **CAC too high:** acquisition channels are inefficient or the market is expensive to reach.
- **LTV too low:** churn is high, ARPU is low, or margin is thin.
- **Payback too long:** cash flow is the constraint; scale requires capital.
- **Gross margin too low:** cost structure is the constraint; pricing or delivery model needs revision.

### 5. Recommend

State whether the unit economics:

- **Support scaling:** safe to increase acquisition spend.
- **Require optimization first:** fix the identified constraint before scaling.
- **Require model revision:** the economics are structurally weak; the business model needs rethinking.

## Output Format

```markdown
## Unit Economics Check

**Business model:** [SaaS / Marketplace / Transactional / Services]
**Data confidence:** [High / Estimated / Limited]

### Core Metrics

| Metric | Value | Benchmark | Status |
|---|---|---|---|
| CAC | $... | ... | ✓ / ⚠️ / 🔴 |
| LTV | $... | ... | ✓ / ⚠️ / 🔴 |
| LTV:CAC | x | 3x+ | ✓ / ⚠️ / 🔴 |
| Payback | ... months | <12 months | ✓ / ⚠️ / 🔴 |
| Gross Margin | ...% | 70%+ (SaaS) | ✓ / ⚠️ / 🔴 |

### Primary Constraint
...

### Recommendation
Scale / Optimize first / Revise model.

### If Optimizing
Highest-leverage action: [reduce CAC via channel X / reduce churn by Y / increase ARPU by Z]

### Data Gaps
- [Metrics not available; estimated; should be verified]
```

## Escalation

Emit a `:::dispatch` block when:

- The unit economics are **strong and the user is preparing to raise funding** — dispatch to `funding` to model the raise size and valuation.
- The unit economics have a **structural cost problem** that requires a detailed financial model — dispatch to `finance`.
- The unit economics are **weak due to a CAC problem** that growth should address with channel strategy.

```
:::dispatch advisor: [funding|finance|growth]
question: [What the unit economics analysis reveals that needs deeper modeling or strategy]
:::
```

## Anti-Patterns

- Do not fabricate metrics when data is unavailable — flag the gap.
- Do not apply SaaS benchmarks to non-SaaS businesses.
- Do not conflate revenue growth with unit economics health.
- Do not perform this check on pre-revenue businesses as if the numbers were validated.
- Do not use this skill to dismiss a business — use it to locate the constraint.

## Agent Behavior

Be specific about what is known vs. estimated. If the user does not have the data, help them identify what to measure and how to get it. The goal is clarity about the economic engine, not a pass/fail grade.
