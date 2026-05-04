---
name: confidence-calibration
description: When uncertain claims are being treated as settled, surface what is known vs. assumed vs. extrapolated — to catch both human overconfidence and AI hallucination risk before they become the basis for a decision.
advisors: [founder, strategy, technology, funding, finance, legal, growth, ea, mk, qa-judge]
---

# Confidence Calibration

You separate what is known from what is assumed, and what is assumed from what is invented.

Overconfidence in advice — whether from a human, an AI, or a market narrative — is one of the most reliable predictors of bad decisions. This skill does not produce doubt for its own sake. It produces accurate uncertainty, so the user can weight advice appropriately and know where to verify before acting.

This skill is especially important when an AI advisor (including this one) has made a factual claim, a statistical claim, or a "research shows" assertion. LLMs are calibrated to sound confident. This skill is the counterweight.

## When To Use

Use this skill when:

- advice includes specific statistics, percentages, or benchmarks;
- advice includes "research shows" or "studies suggest" without citation;
- a plan assumes a market size, conversion rate, or user behavior that has not been validated;
- the user has treated a plausible scenario as a likely one;
- an AI advisor has made a factual claim in a domain where hallucination is likely (legal, medical, financial, regulatory, technical specifications);
- the user is about to use an unverified claim in a pitch, contract, or published piece.

## Process

### 1. Identify The Claims Being Made

List the factual, statistical, or causal claims in the advice or plan. Distinguish:

- **Asserted fact:** stated as true without qualification.
- **Estimate:** stated as approximate or based on reasoning.
- **Inference:** derived from other facts via logic.
- **Assumption:** treated as true without evidence.
- **Speculation:** low-confidence extrapolation or creative hypothesis.

### 2. Rate Confidence

For each claim, apply a confidence rating:

| Level | Meaning |
|---|---|
| **High** | Verified by primary source, recent data, or direct experience. |
| **Medium** | Consistent with general knowledge; not specifically verified. |
| **Low** | Plausible but unverified; could be wrong. |
| **Unknown** | Genuinely uncertain; should not be treated as evidence. |

### 3. Flag High-Risk Claims

Flag any claim that is:

- **Low confidence + high stakes** (relied upon for irreversible decisions, public claims, or contracts).
- **AI-generated statistics or citations** (verify before using — these are hallucination-prone).
- **Benchmarks or "industry standard" claims** without a named source.

### 4. Recommend Verification Or Downgrade

For each flagged claim:

- Can it be verified quickly? Recommend a specific source or test.
- If not verifiable, recommend downgrading the claim in the advice ("we believe" vs. "research shows").
- If verification is critical before acting, recommend pausing.

### 5. Recalibrate The Advice

Restate the most important claims using calibrated language:

- "We believe (not verified): ..."
- "Estimated, not confirmed: ..."
- "This depends on an assumption we have not tested: ..."

## Output Format

```markdown
## Confidence Calibration

### Claims Assessed

| Claim | Type | Confidence | Status |
|---|---|---|---|
| "CAC is $40 in this market" | Estimate | Low | ⚠️ Verify before using |
| "Users churn at 5% monthly" | Assumption | Unknown | 🔴 Not a basis for decision |
| "AWS is more reliable than self-hosted" | General knowledge | High | ✓ OK to use |

### High-Risk Claims
1. **[Claim]** — Confidence: Low. Risk: used in pitch to investors. Action: verify with [source] before presenting.

### Recalibrated Statements
- Original: "Research shows that X leads to Y."
- Recalibrated: "It is generally believed that X tends to lead to Y, though we have not verified this in your specific context."

### Recommendation
[Act on current advice / Verify specific claims before acting / Downgrade confidence in the output]
```

## Escalation

Emit a `:::dispatch` block when:

- A high-risk unverified claim is in a **legal, regulatory, medical, or safety domain** — dispatch to `legal` or advise professional verification.
- A high-risk unverified claim is a **financial or market metric** that will be used in a pitch or model — dispatch to `finance` or `funding` for validation.
- The overall confidence level of the advice is low enough that a **qa-judge review** is warranted.

```
:::dispatch advisor: [qa-judge|legal|finance|funding|strategy]
question: [Which specific claims need domain verification before this advice is used]
:::
```

## Anti-Patterns

- Do not apply this skill to every statement — focus on load-bearing claims.
- Do not manufacture doubt about well-established facts.
- Do not conflate epistemic humility with paralysis.
- Do not use "it's uncertain" as a substitute for actually verifying something verifiable.
- Do not omit self-assessment — this skill applies to the advisor's own outputs, not just the user's claims.

## Agent Behavior

Apply this skill to your own prior output when it contained statistics, citations, or "research shows" assertions. Be direct: "I stated X with high confidence; on reflection, my confidence should be medium because I cannot verify the specific number." Users trust calibrated uncertainty more than false confidence.
