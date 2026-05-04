---
name: pre-mortem
description: Before committing to a plan, architecture, strategy, or contract, assume it has already failed and work backwards to find the most likely causes — before they happen.
advisors: [founder, strategy, technology, funding, finance, legal, growth, ea, mk]
---

# Pre-Mortem

You help the user find the most likely failure modes of a plan before committing to it.

A post-mortem asks why something failed after it failed. A pre-mortem asks the same question before it begins. Research by Gary Klein found that prospective hindsight — imagining the failure as already happened — increases the identification of reasons for future outcomes by approximately 30%.

This skill is not pessimism. It is a structured commitment to the plan by testing it first.

## When To Use

Use this skill when the user is about to commit to:

- a go-to-market strategy;
- a technical architecture or major infrastructure decision;
- a fundraising plan or pitch narrative;
- a partnership, contract, or hiring decision;
- a product roadmap or scope of work;
- a launch or publication date.

Do not use it for reversible, low-cost, exploratory decisions — the overhead is not worth it. Reserve it for commitments that are difficult to undo.

## Process

### 1. State The Plan And Horizon

Confirm what the user is committing to and the time horizon being assessed.

```text
The plan is: [one sentence]. We are assessing the 90-day / 1-year / 3-year horizon.
```

### 2. Invoke Prospective Hindsight

Ask the user (or reason through this yourself as the advisor):

```text
It is [horizon] from now. The plan has failed — not partially, but significantly. 
What happened?
```

Generate the top five to eight plausible failure narratives, across categories:

- **Execution failures:** team, velocity, dependency, sequencing.
- **Assumption failures:** a core belief turned out to be wrong.
- **External failures:** market shift, competitor move, regulatory change, macro event.
- **Resource failures:** ran out of money, talent, or time before the plan could work.
- **Relational failures:** co-founder conflict, customer churn, partnership breakdown, legal dispute.
- **Second-order failures:** the plan succeeded but created a new, worse problem.

### 3. Rank By Probability × Impact

Score each failure mode:

- **Probability:** How likely is this failure path? (High / Medium / Low)
- **Impact:** If it happens, how badly does it derail the outcome? (High / Medium / Low)

Flag any failure mode that is **High Probability + High Impact** as a Red Flag.

### 4. Develop Countermeasures

For each Red Flag:

- What early warning signal would indicate this failure is starting?
- What action now would reduce the probability or impact?
- Is there a tripwire — a pre-committed decision point — that would trigger an early course correction?

### 5. Update The Plan

Decide what, if anything, changes in the plan before proceeding:

- A step is added (de-risk action).
- A dependency is validated before committing.
- A milestone is made into a go/no-go decision point.
- The plan proceeds unchanged with the failure modes explicitly acknowledged.

## Output Format

```markdown
## Pre-Mortem

**Plan:** ...
**Horizon:** ...

### Failure Modes

| # | Narrative | Category | Probability | Impact | Status |
|---|---|---|---|---|---|
| 1 | ... | Assumption | High | High | 🔴 Red Flag |
| 2 | ... | Execution | Medium | High | ⚠️ Watch |
| 3 | ... | External | Low | High | Monitor |

### Red Flag Countermeasures

**[Failure 1]**
- Early signal: ...
- Action now: ...
- Tripwire: If [X] happens by [date], then [Y].

### Plan Updates
- [ ] [Action added to plan]
- [ ] [Dependency to validate]

### Confidence Assessment
After this pre-mortem, confidence level: [High / Moderate / Low with conditions]
```

## Escalation

Emit a `:::dispatch` block when:

- A Red Flag is a **legal or contractual exposure** that needs legal review before proceeding.
- A Red Flag is a **financial runway or unit economics failure** that needs finance or funding input.
- A Red Flag is a **market or competitive threat** that strategy should assess.
- A Red Flag is a **technical feasibility question** that technology should evaluate.

```
:::dispatch advisor: [legal|finance|funding|strategy|technology|growth]
question: [What failure mode we need assessed, and what the plan is]
:::
```

## Anti-Patterns

- Do not use the pre-mortem to talk the user out of a good plan — the goal is to strengthen it, not kill it.
- Do not generate failure modes that are implausible given the context.
- Do not skip the countermeasures — identifying failures without actions is just anxiety.
- Do not treat every failure mode as equal; ranking is essential.
- Do not perform a pre-mortem on decisions the user has already irrevocably made.

## Agent Behavior

Be specific and grounded. Vague failure modes ("things go wrong") are useless. Name the mechanism. Be honest about high-probability risks without catastrophizing. The user should leave with a plan they believe in more, not less — because they have tested it.
