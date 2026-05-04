---
name: scope-clarifier
description: Before deep work begins, bound what is in scope, what is out of scope, and what the exit condition is — so neither the user nor the agent gets lost in a rabbit hole.
advisors: [ea, technology, legal, strategy, founder]
---

# Scope Clarifier

You bound the work before it begins.

Unbounded work is the most common cause of wasted effort — by humans and agents alike. This skill prevents the user (and the advisor) from expanding into adjacent problems, pursuing completeness over sufficiency, or doing work that is not actually being asked for. It is used both in human decision-making and as a guardrail for agents running autonomous tasks.

## When To Use

Use this skill when:

- the user's request is open-ended or could expand significantly;
- the user asks for research, analysis, drafting, or investigation without a clear stopping point;
- an agent is about to run a multi-step autonomous task;
- the user is starting a project, sprint, audit, or work session;
- the scope of a legal, technical, or strategic review has not been defined.

## Process

### 1. State What Is Being Asked

Paraphrase the request in one sentence. If the request has multiple possible interpretations, name them.

### 2. Define The Core Deliverable

Identify the one thing that must exist for this work to be complete:

```text
The work is done when: [specific output or decision or artifact].
```

### 3. Draw The Scope Boundary

Explicitly list:

- **In scope:** what is included in this work.
- **Out of scope:** adjacent concerns that are excluded from this work (but may need to be addressed later or separately).
- **Deferred:** things that may be in scope later but are explicitly not now.

### 4. Define Exit Conditions

Identify the conditions under which work stops:

- The deliverable is produced.
- A blocker is surfaced that prevents the deliverable (and must be named).
- A time or resource limit is reached.
- A discovery changes the scope (and must be flagged before continuing).

For agent tasks specifically:

```text
Stop and report if: you encounter [X], cannot verify [Y], or the task requires [Z] which was not authorized.
```

### 5. Flag Scope Risks

Name what is most likely to cause scope creep on this task:

- A dependency that is larger than expected.
- An adjacent question that is tempting but not required.
- A completeness standard that exceeds what is needed for the decision.
- User or agent curiosity pulling the work sideways.

## Output Format

```markdown
## Scope Clarifier

**Request:** ...
**Core deliverable:** The work is done when ...

### In Scope
- ...

### Out of Scope
- ...

### Deferred
- ...

### Exit Conditions
- Done: ...
- Blocker: Stop and report if ...
- Limit: ...

### Scope Risks
- [What is most likely to cause this to expand beyond intent]
```

## Escalation

Emit a `:::dispatch` block when:

- Bounding the scope requires **domain expertise** to define what is sufficient (e.g., what constitutes an adequate legal review, a complete technical audit, or a credible market sizing).
- The scope includes **decisions about resource allocation or priority** that founder or strategy should set.

```
:::dispatch advisor: [technology|legal|strategy|founder|ea]
question: [What we need defined before scope can be confirmed]
:::
```

## Anti-Patterns

- Do not define scope so narrowly that the output is useless.
- Do not define scope so broadly that it defeats the purpose of bounding.
- Do not skip the out-of-scope list — explicitly naming exclusions prevents drift.
- Do not apply this skill when the work is clearly bounded already.
- Do not use scope-clarifier to block necessary work — use it to frame it.

## Agent Behavior

When using this skill for an autonomous agent task, output the scoped task as a structured brief the agent will operate within. Make the exit conditions explicit — agents need a specific stop signal, not a vague "when done." For agent tasks, always include at least one "stop and report" condition so the agent surfaces blockers rather than inventing solutions.
