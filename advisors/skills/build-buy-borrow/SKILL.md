---
name: build-buy-borrow
description: Three-way structured decision before committing to a technical approach — determines whether to build it in-house, buy a solution, or borrow (open source, library, partner, or contract).
advisors: [technology]
---

# Build / Buy / Borrow

You apply a structured three-way analysis before committing to a technical approach.

"We'll just build it" is one of the most expensive phrases in engineering. So is "let's buy a tool for this" when the requirement is non-standard. This skill separates the three paths — build, buy, and borrow — along the dimensions that actually matter: differentiation, cost, control, risk, and velocity.

## When To Use

Use this skill when:

- the user is deciding how to implement a capability, feature, or system component;
- a developer proposes building something from scratch without evaluating alternatives;
- a vendor tool is being considered without evaluating build or open-source alternatives;
- a new dependency is being added without evaluating its strategic implications;
- an integration, API, or third-party service is being evaluated.

## Definitions

- **Build:** Design and implement in-house. Full control, full cost, full maintenance obligation.
- **Buy:** License or subscribe to a commercial product or SaaS. Fast, bounded scope, vendor dependency.
- **Borrow:** Use open-source software, a library, a framework, a contractor, or a partner. Flexible cost structure, community risk, integration overhead.

## Process

### 1. State The Capability Needed

What must this component do? State it in functional terms, not implementation terms.

### 2. Assess Strategic Differentiation

Is this capability a **core differentiator** for the product, or is it infrastructure?

- **Core differentiator:** something that, if done better than anyone else, creates a competitive advantage. Candidates for build.
- **Infrastructure:** something every company in this space needs to work. Candidates for buy or borrow.

Caution: most teams overestimate how many components are differentiators. Authentication is not a differentiator. Custom auth may be.

### 3. Evaluate Each Path

For each of the three paths, assess:

| Dimension | Build | Buy | Borrow |
|---|---|---|---|
| **Time to working** | Weeks to months | Days to weeks | Days to weeks |
| **Ongoing cost** | Engineering time | Subscription / license | Maintenance / integration |
| **Control** | Full | Limited to API | Moderate |
| **Customization** | Unlimited | Limited to config | Moderate |
| **Vendor risk** | None | Pricing, shutdown, API change | Community abandonment |
| **Maintenance burden** | High | Low | Medium |
| **Security surface** | Controlled | Vendor-managed | Dependency audit needed |

Apply to the specific capability being assessed.

### 4. Apply Decision Filters

- **Velocity:** What is the cost of delay? If speed matters, lean toward buy or borrow.
- **Reversibility:** How hard is it to switch paths later? Build is hardest to undo.
- **Team expertise:** Does the team have the skills to build and maintain this well?
- **Budget:** Is there a budget for a commercial solution, or must it be zero direct cost?
- **Compliance / security:** Does the capability require data residency, audit trails, or certifications that constrain vendor choices?

### 5. Recommend

State a primary recommendation and the key condition under which it would change:

```text
Recommend: Borrow (open-source library X).
Switch to Build if: the library cannot support [specific requirement] without forking.
Switch to Buy if: the team lacks bandwidth to integrate and maintain it within [timeline].
```

## Output Format

```markdown
## Build / Buy / Borrow

**Capability:** ...
**Differentiator:** Yes / No / Uncertain

### Path Assessment

| Dimension | Build | Buy | Borrow |
|---|---|---|---|
| Time to working | ... | ... | ... |
| Ongoing cost | ... | ... | ... |
| Control | ... | ... | ... |
| Maintenance | ... | ... | ... |
| Risk | ... | ... | ... |

### Key Filters
- Velocity: ...
- Reversibility: ...
- Team expertise: ...

### Recommendation
**Primary:** [Build / Buy / Borrow] — [Specific tool or approach]
**Switch to [other path] if:** ...

### Next Step
...
```

## Escalation

Emit a `:::dispatch` block when:

- The decision has significant **budget or capital allocation implications** that finance should model.
- A vendor dependency would be **contractually or legally binding** in a way that legal should review.
- The capability is a **product strategy question** (whether to build a differentiator vs. buy infrastructure) that founder or strategy should resolve.

```
:::dispatch advisor: [finance|legal|founder|strategy]
question: [What the build/buy/borrow analysis surfaces that needs non-technical input]
:::
```

## Anti-Patterns

- Do not default to build because it feels like more control.
- Do not default to buy because it feels faster.
- Do not evaluate open-source as free — maintenance and integration have real costs.
- Do not make this decision based on what the team prefers building.
- Do not skip the reversibility assessment for foundational components.

## Agent Behavior

Be specific. Name actual libraries, tools, or vendor categories rather than speaking in abstractions. The user should leave with a specific next step: "evaluate these three libraries," "schedule a demo with vendor X," or "spec out the build estimate."
