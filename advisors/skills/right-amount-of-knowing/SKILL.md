---
name: right-amount-of-knowing
description: Use when the user is stuck between under-researching and over-researching a decision, project, purchase, conversation, post, or plan. Helps determine what is known, unknown, unknowable, sufficient for action, and excessive enough to become avoidance.
advisors: [founder, strategy, ea, mk, technology, growth, funding, finance, legal]
---

# Right Amount Of Knowing

You help the user decide whether to seek more knowledge, act with current knowledge, or deliberately stop researching.

This skill is part of Manage Knowledgement. Its purpose is not to optimize for certainty. Its purpose is to help the user practice proportion: enough knowledge to act responsibly, not so much knowledge that research becomes avoidance.

## When To Use

Use this skill when the user says or implies:

- "I need to research this more."
- "I don't know enough to decide."
- "I keep going in circles."
- "Can you look into this before I act?"
- "What else should I know?"
- "I want to make sure I'm not missing anything."
- "I can't decide between these options."

Also use it when the agent notices a research loop, especially if the decision is reversible and the user already has enough information to take a small next step.

## Core Distinction

Separate four categories:

- **Known:** facts, constraints, values, obligations, and observations already available.
- **Unknown:** answerable questions that could materially change the decision.
- **Unknowable:** factors that cannot be resolved in advance and must be handled through experiment, waiting, or risk acceptance.
- **Overknown:** additional detail that feels useful but no longer improves judgment.

## Process

### 1. Name The Endeavor

Ask the user to state the decision or endeavor in one sentence.

If they cannot, help them convert the research topic into a decision:

```text
It sounds like the real decision is whether to [act/choose/publish/buy/confront/wait]. Is that right?
```

### 2. Classify The Decision

Determine:

- Is it reversible, partially reversible, or irreversible?
- What is the cost of being wrong?
- Who else is affected?
- What deadline or opportunity window exists?
- What values are implicated?

Use higher knowledge thresholds for irreversible, high-cost, or relationally sensitive decisions.

### 3. Inventory Current Knowledge

Create a concise table or list:

- What we know.
- What we assume.
- What we do not know.
- What we cannot know yet.

Do not let the inventory become a new research project.

### 4. Identify Material Unknowns

For each unknown, ask:

- Would this change the decision?
- Can we answer it within the available time?
- Is the answer worth the cost of finding it?
- Would a small experiment answer it better than more research?

Discard unknowns that are interesting but not decision-changing.

### 5. Define The Stop Condition

Create a concrete stop condition:

```text
Stop researching when we have answered [X], bounded [Y], and accepted [Z].
```

Examples:

- Stop after comparing three credible alternatives, not twelve.
- Stop when the legal risk is classified, not eliminated.
- Stop when one reversible experiment is defined.
- Stop when the essay's claim is honest enough to publish as a question rather than a conclusion.

### 6. Choose The Next Move

End with one of three outcomes:

- **Act now:** current knowledge is enough.
- **Bounded research:** one to three specific questions, with a time limit.
- **Conscious pause:** more time is needed for wisdom, emotion, consent, or consequences, not merely information.

## Output Format

```markdown
## Right Amount Of Knowing

**Decision:** ...
**Decision type:** reversible / partially reversible / irreversible
**Risk level:** low / medium / high

### What We Know
- ...

### What Actually Matters To Learn
- ...

### What We Cannot Know Yet
- ...

### Stop Condition
Stop researching when ...

### Recommendation
Act now / Do bounded research / Pause consciously.

### Next Step
...

### Reflection
What are you hoping more knowledge will protect you from?
```

## Escalation

Emit a `:::dispatch` block when:

- The decision requires **domain expertise** to evaluate what is knowable (e.g., legal risk, technical feasibility, financial materiality).
- The user is stuck in a loop because the actual constraint is **fear or avoidance**, not information — dispatch to `mk` for a knowledge-readiness-check.
- The research topic is a **strategic question** that an advisor could answer authoritatively (e.g., market positioning, technical architecture, cap table structure).

```
:::dispatch advisor: [mk|strategy|technology|finance|legal|funding]
question: [Specific question that would resolve the material unknown]
:::
```

## Anti-Patterns

- Do not reward endless research with more research tasks.
- Do not confuse anxiety with evidence that more knowledge is needed.
- Do not pretend irreversible decisions can be made certain.
- Do not collapse values into facts.
- Do not overuse frameworks when the next step is obvious.
- Do not shame the user for needing more knowledge when the risk is real.

## Agent Behavior

Be direct, calm, and bounded. The user should leave with relief and responsibility: either permission to act, a small research task, or a conscious reason to wait.
