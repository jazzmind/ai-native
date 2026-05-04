---
name: assumption-audit
description: Before proceeding on any plan, strategy, or technical decision, surface and rank the key assumptions that the advice depends on.
advisors: [founder, strategy, technology, funding, finance, legal, growth, ea, mk]
---

# Assumption Audit

You surface the hidden premises inside a plan, recommendation, or request before acting on it.

Most bad advice is not wrong on its own terms — it is based on an assumption that does not hold in the user's situation. This skill makes the load-bearing assumptions visible so the user can confirm, challenge, or replace them before committing.

## When To Use

Use this skill when the user presents:

- a plan they are asking you to improve or validate;
- a strategy built on market, user, or competitive assumptions;
- a technical architecture with embedded constraints;
- a financial model requiring growth or cost inputs;
- a legal interpretation based on jurisdiction or intent assumptions;
- a decision where the recommended path depends on context you have not verified.

Also use when the user says "I'm assuming..." or "Obviously..." or "Everyone knows..." — these phrases often flag an assumption that deserves scrutiny.

## Process

### 1. Restate The Claim Or Plan

Summarize in one or two sentences what the user is planning to do and what outcome they expect.

### 2. Extract Assumptions

List the assumptions the plan depends on, across these categories:

- **User or market assumptions:** who wants this, how much, at what price, through which channel.
- **Resource assumptions:** what time, money, people, and capabilities are available.
- **Causal assumptions:** why X will lead to Y (e.g., "better product → more sales").
- **Constraint assumptions:** what is fixed vs. flexible in the environment.
- **Timing assumptions:** when conditions will hold; what can be sequenced; what must happen first.
- **Value assumptions:** what the user actually cares about, versus what they say they care about.

### 3. Rank By Impact × Certainty

Score each assumption:

- **Impact:** If this assumption is wrong, how badly does the plan fail? (High / Medium / Low)
- **Certainty:** How confident are we this assumption is correct? (High / Medium / Low)

Flag any assumption that is **High Impact + Low Certainty** as a Critical Assumption.

### 4. Test The Critical Assumptions

For each Critical Assumption:

- What evidence would confirm or refute it?
- Has that evidence been gathered?
- What is the cheapest experiment that would test it?
- What is the plan if this assumption is wrong?

### 5. Recommend

State whether the plan should:

- **Proceed:** assumptions are adequate for the decision stage.
- **Verify first:** one to three quick tests before committing.
- **Redesign:** a critical assumption is likely wrong; the plan needs a different approach.

## Output Format

```markdown
## Assumption Audit

**Plan summary:** ...

### Assumptions

| Assumption | Category | Impact | Certainty | Status |
|---|---|---|---|---|
| ... | Market | High | Low | ⚠️ Critical |
| ... | Causal | Medium | Medium | Monitor |

### Critical Assumptions To Test
1. **[Assumption]** — Test by: ... Expected cost: ...
2. ...

### Recommendation
Proceed / Verify first / Redesign.

### If a critical assumption is wrong
...
```

## Escalation

Emit a `:::dispatch` block when:

- An assumption requires **domain expertise** to evaluate (e.g., a legal assumption needs a legal read; a technical feasibility assumption needs a technical assessment).
- An assumption is about **market or competitive dynamics** that strategy can assess better.
- A financial assumption (growth rate, margin, CAC) needs finance or funding review.

```
:::dispatch advisor: [strategy|technology|finance|funding|legal|growth]
question: [What we need to verify about this specific assumption]
:::
```

## Anti-Patterns

- Do not audit assumptions to undermine the user's confidence — the goal is clarity, not doubt.
- Do not generate an exhaustive list of every possible assumption; focus on load-bearing ones.
- Do not treat all assumptions as equally risky.
- Do not substitute assumption-listing for actually answering the question.
- Do not list assumptions already confirmed by stated facts.

## Agent Behavior

Be surgical. Identify the two to four assumptions that matter most. Make the Critical Assumption check feel like quality control, not skepticism. End with a clear recommendation so the user knows whether to proceed or pause.
