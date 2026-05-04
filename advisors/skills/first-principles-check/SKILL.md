---
name: first-principles-check
description: Strip inherited assumptions to their fundamentals and rebuild from scratch — for pivots, paradigm resets, and decisions where received wisdom may be leading the user in the wrong direction.
advisors: [founder, strategy]
---

# First Principles Check

You help the user stop reasoning by analogy and start reasoning from fundamentals.

Most strategic thinking is borrowed: "this is how companies in this space do it," "this is the standard contract structure," "this is what investors expect." First principles thinking strips the inheritance and rebuilds from what is actually true. Elon Musk used it to reduce rocket cost by 10x by ignoring aerospace industry pricing conventions. It is not appropriate for every decision — but when the received wisdom is wrong, or the user is constrained by someone else's frame, it is the only way out.

## When To Use

Use this skill when:

- the user is trying to compete in a market by copying incumbents;
- a cost, timeline, or resource constraint seems immovable but has not been questioned;
- the user is stuck because "this is how it's done" and that answer is not working;
- a business model is inherited from a category rather than derived from customer reality;
- a pivot is needed and the user does not know which assumptions to change;
- the user says "everyone does it this way" or "that's just the standard."

Do not use it on well-validated approaches where the received wisdom is actually correct — first principles can generate unnecessary complexity in stable, well-understood domains.

## Process

### 1. State The Problem As Currently Framed

What is the user trying to solve, in the terms they are currently using?

### 2. Identify The Inherited Assumptions

List the assumptions embedded in the current framing that come from industry convention, analogy, or unquestioned inheritance rather than first principles. Mark each one:

- **Inherited:** assumed because "that's how it's done."
- **Verified:** assumed because it has been tested and confirmed in this context.
- **Structural:** a real constraint (physics, law, economics) that cannot be changed.

### 3. Strip To Fundamentals

For each inherited assumption, ask:

```text
What is actually true here, independent of convention?
```

Identify the underlying physical, economic, behavioral, or relational reality beneath the assumption. What would a person building this from scratch — with no knowledge of industry norms — conclude?

### 4. Rebuild

From the fundamentals, construct:

- What the actual problem is (stripped of inherited framing).
- What the constraints actually are (structural vs. conventional).
- What new approaches become possible when the inherited assumptions are removed.
- What the first-principles version of the solution looks like.

### 5. Compare

Side-by-side:

- Current approach (inherited framing) → what it produces, at what cost.
- First-principles approach → what it produces, at what cost, and what new risks it introduces.

### 6. Recommend

The first-principles approach is not always right. Inherited conventions often encode accumulated wisdom. Recommend:

- **Adopt the first-principles approach:** the inherited framing is wrong for this context.
- **Modify the current approach:** strip one or two assumptions, keep the rest.
- **Validate the inherited approach:** it is actually correct here, and here is why.

## Output Format

```markdown
## First Principles Check

**Problem as framed:** ...

### Inherited Assumptions

| Assumption | Source | Type |
|---|---|---|
| ... | Industry convention | Inherited |
| ... | Tested in this context | Verified |
| ... | Physics / law / economics | Structural |

### Stripped-Down Reality
What is actually true here, independent of convention:
- ...

### First-Principles Solution
...

### Comparison
| | Current Approach | First-Principles Approach |
|---|---|---|
| Output | ... | ... |
| Cost | ... | ... |
| Risk | ... | ... |

### Recommendation
Adopt / Modify / Validate inherited approach.
Reason: ...
```

## Escalation

Emit a `:::dispatch` block when:

- The first-principles analysis reveals a **market structure, competitive, or positioning insight** that strategy should develop.
- Rebuilding from first principles surfaces a **significant capital or resource question** that funding or finance should model.
- The stripped-down reality involves a **legal or regulatory constraint** that needs legal verification.

```
:::dispatch advisor: [strategy|funding|finance|legal|technology]
question: [What the first-principles analysis surfaced that needs domain expertise]
:::
```

## Anti-Patterns

- Do not apply first-principles thinking to operational decisions where the convention is correct and efficient.
- Do not mistake "obvious to me" for "derived from fundamentals."
- Do not use this skill to justify ignoring hard-won industry experience.
- Do not generate a first-principles solution that is more complex than the problem it solves.
- Do not confuse contrarianism with first-principles thinking.

## Agent Behavior

Be Socratic but efficient. The goal is to find the one or two inherited assumptions that are actually wrong for this user's context — not to generate a complete philosophical reconstruction. Most users need to question one constraint, not all of them.
