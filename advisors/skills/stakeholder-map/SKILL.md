---
name: stakeholder-map
description: Before advice that will affect other people, surface who they are, what they want, what power they have, and what would constitute a good or bad outcome for each of them.
advisors: [growth, legal, founder, strategy, ea]
---

# Stakeholder Map

You make the people affected by a decision visible before the decision is made.

Advice that ignores stakeholders fails in execution even when it is correct in theory. This skill does not require a full political analysis. It requires naming who is in the room (or should be), what they want, and what power they have to shape or block the outcome.

## When To Use

Use this skill when:

- the plan involves multiple people, teams, customers, or institutions with different interests;
- the advice the user is about to act on could affect someone who has not been consulted;
- a relationship, negotiation, partnership, hiring, or org change is being planned;
- the user is preparing to launch, pitch, litigate, publish, or confront.

Do not use it for decisions with no material stakeholders beyond the user.

## Process

### 1. Define The Decision Or Action

State what is being decided or done in one sentence.

### 2. Identify Stakeholders

List everyone who:

- is directly affected by the outcome;
- has authority, consent, or veto power over the process;
- must be informed even if not consulted;
- could be surprised or harmed if not considered.

Group them:

- **Primary:** directly affected, must be engaged.
- **Secondary:** indirectly affected or influential; should be considered.
- **Latent:** not obvious, but could become significant (regulators, press, future customers, co-founders).

### 3. Assess Each Stakeholder

For each primary stakeholder, assess:

| Field | Question |
|---|---|
| **Want** | What outcome do they prefer? |
| **Fear** | What outcome do they want to avoid? |
| **Power** | Can they block, enable, or ignore this? |
| **Relationship** | How is the current relationship? |
| **Informed?** | Do they know this is happening? |
| **Consulted?** | Have they been asked for input? |

### 4. Identify Conflicts

Note where stakeholder interests conflict with each other or with the user's plan.

### 5. Plan Engagement

For each primary stakeholder, decide:

- **Inform:** tell them after the decision.
- **Consult:** get input before deciding.
- **Collaborate:** co-create part of the plan.
- **Align:** get explicit agreement before proceeding.

## Output Format

```markdown
## Stakeholder Map

**Decision / Action:** ...

### Primary Stakeholders

| Stakeholder | Want | Fear | Power | Status |
|---|---|---|---|---|
| [Name/Role] | ... | ... | High/Med/Low | Informed / Consulted / Not engaged |

### Secondary Stakeholders
- [Name/Role]: [brief note on interest and relevance]

### Latent Stakeholders
- [Who could become significant and why]

### Conflicts
- [Stakeholder A] wants X; [Stakeholder B] wants Y. Resolution needed before proceeding.

### Engagement Plan
- [Stakeholder]: [Inform / Consult / Collaborate / Align] — [when / how]
```

## Escalation

Emit a `:::dispatch` block when:

- The stakeholder analysis reveals a **legal obligation** to consult or notify (e.g., employment law, regulatory bodies, contractual parties).
- A stakeholder has **significant financial interest** (investor, creditor, acquirer) that changes the decision stakes.
- The conflict between stakeholders is a **strategic or political question** that needs founder or strategy input.

```
:::dispatch advisor: [legal|funding|finance|founder|strategy]
question: [What about this stakeholder situation requires domain expertise]
:::
```

## Anti-Patterns

- Do not map stakeholders for one-person decisions with no material relational impact.
- Do not treat all stakeholders as equally powerful — rank matters.
- Do not use the map to justify ignoring stakeholders — use it to decide how to engage them.
- Do not confuse what a stakeholder says they want with what they actually need.
- Do not skip latent stakeholders in high-stakes decisions.

## Agent Behavior

Be specific about names and roles when they are known. When they are not, prompt the user to name them. The output should surface a surprise: someone the user had not considered, or a conflict they had not named. That is where the value is.
