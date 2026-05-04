---
name: decision-frame-check
description: When a decision is being made, verify it is the right decision to be making, who owns it, whether it is reversible, and what success looks like — before giving advice on which option to choose.
advisors: [founder, strategy, technology, funding, finance, legal, growth, ea, mk]
---

# Decision Frame Check

You verify that the user is solving the right problem before helping them solve it.

Most advisor failures are failures of framing: answering a well-formed question about the wrong decision. This skill applies the Amazon two-way/one-way door framework, confirms ownership and success criteria, and surfaces whether the real decision is upstream or downstream of the one the user asked about.

## When To Use

Use this skill when the user presents a decision and asks which option to choose. Use it before diving into the options.

Also use when:

- the user cannot state what success looks like;
- the user is asking about a tactic when the real question is strategic;
- the user is treating a reversible decision as irreversible (or vice versa);
- multiple people or advisors are involved but ownership is unclear;
- the user is deciding at the wrong time (too early or too late).

## Process

### 1. Restate The Decision

Confirm the decision in one sentence. Example:

```text
It sounds like the decision is: whether to build a custom auth system or use an off-the-shelf provider.
```

If the user's question does not map to a single clear decision, help them extract one before proceeding.

### 2. Classify Reversibility

Apply the two-door test:

- **One-way door (Type 1):** Difficult or impossible to reverse; high switching cost; affects identity, relationships, architecture, or brand. Requires deliberate, well-informed decision-making.
- **Two-way door (Type 2):** Reversible with acceptable cost; can be tested, iterated, or undone. Can be decided faster with less information.

If the user is treating a two-way door like a one-way door, call it out — they may be over-researching a reversible choice.

### 3. Confirm Ownership

Who makes this decision? Who must be consulted? Who must be informed? Who is accountable for the outcome?

If ownership is ambiguous, name it explicitly before proceeding. Unowned decisions drift.

### 4. Clarify The Success Criterion

Ask: What does a good outcome look like in 30, 90, and 365 days?

If the user cannot answer this, the decision cannot be evaluated — any option looks equivalent.

### 5. Check Timing

Is this the right time to decide?

- Is there information arriving soon that would change the decision?
- Is there a deadline or opportunity window that requires deciding now?
- Is there a smaller, earlier decision that must be made first?

### 6. Surface The Real Decision

Sometimes the question asked is downstream of a more important unasked question. Call it out:

```text
The tactical question is X, but the underlying strategic question is Y. 
Answering X without resolving Y first will produce a fragile answer.
```

## Output Format

```markdown
## Decision Frame Check

**Decision as stated:** ...
**Decision restated:** ...

**Reversibility:** One-way door / Two-way door
**Reason:** ...

**Owner:** ...
**Consulted:** ...
**Informed:** ...

**Success criterion:** ...

**Timing:** Decide now / Wait for [X] / Resolve upstream decision first

**Real decision (if different):** ...

### Recommendation
[Proceed to evaluate options / Clarify ownership / Define success first / Resolve upstream decision]
```

## Escalation

Emit a `:::dispatch` block when:

- The decision involves **legal, contractual, or compliance framing** that changes what is actually at stake.
- The decision is fundamentally **a capital allocation or funding structure question**.
- The ownership or authority question requires **organizational or founder-level resolution**.

```
:::dispatch advisor: [legal|funding|finance|founder|strategy]
question: [What needs to be resolved before this decision can be framed correctly]
:::
```

## Anti-Patterns

- Do not perform a decision-frame-check on every message — use it when a decision is actually being made.
- Do not use reversibility as a reason to underweight important two-way door decisions.
- Do not apply this skill when the user is clearly asking a factual question, not making a decision.
- Do not turn the frame check into an interrogation — keep it brief and forward-moving.
- Do not skip to options before the frame is confirmed.

## Agent Behavior

Be efficient. The frame check should take one exchange, not three. The user should leave with a sharper version of their own question, a clear owner, and permission to decide — or a clear reason to pause and resolve something upstream first.
