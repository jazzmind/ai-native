---
name: jobs-to-be-done
description: Clarify what job the user or customer is hiring this product, feature, or message for — before GTM strategy, positioning, or messaging work begins.
advisors: [growth, strategy]
---

# Jobs To Be Done

You identify the functional, social, and emotional job a customer is hiring a product or service to do — before building GTM strategy, writing copy, or designing features.

The Jobs To Be Done (JTBD) framework, developed by Clayton Christensen, shifts the unit of analysis from customer segment to customer motivation. People do not buy products; they hire them to make progress in a specific situation. Getting this wrong produces marketing that describes features to people who are looking for progress.

## When To Use

Use this skill when:

- building positioning or messaging for a product or feature;
- designing a go-to-market strategy for a new market or segment;
- a product is struggling with adoption despite good features;
- the user is trying to understand why customers churn or do not convert;
- competing products appear similar but are winning different customers for different reasons;
- a new feature is being prioritized and the team disagrees on who it is for.

## Core Concepts

### The Job Statement

A job is expressed as:

```
When [situation], I want to [motivation/goal], so I can [desired outcome].
```

Example:
```
When I am about to make a significant business decision, 
I want to quickly get structured advice from multiple perspectives,
so I can feel confident I am not missing something important.
```

### Three Job Dimensions

- **Functional:** The practical, objective task — what it does.
- **Social:** How it makes the person look to others — what it signals.
- **Emotional:** How it makes the person feel — what internal state it creates or relieves.

Strong products satisfy all three. Strong messaging identifies which dimension drives the hire.

### Competing Solutions

Customers are always hiring something for the job — even if it is a spreadsheet, a conversation with a colleague, or doing nothing. The real competition is whatever they hired before you.

## Process

### 1. Identify The Customer Segment

Who is the customer or user being analyzed? Be specific — different segments hire the same product for different jobs.

### 2. Elicit The Situation

What is happening in the customer's life or work immediately before they reach for this product?

```text
What were they doing just before? What triggered the search? What changed?
```

### 3. Name The Job

Construct the job statement:

```
When [situation], I want to [goal], so I can [outcome].
```

If multiple plausible jobs emerge, list them and ask the user which one is primary.

### 4. Map The Three Dimensions

For the primary job:

- **Functional:** What task is being accomplished?
- **Social:** What does hiring this product say about the person to others?
- **Emotional:** What does the person feel while using it, or after using it?

### 5. Identify The Old Hire

What did customers do before this product existed? What are they switching from?

Understanding the switch reveals what the product is actually competing against.

### 6. Evaluate Product-Job Fit

Does the current product, messaging, or positioning address the primary job and its three dimensions?

- Where does it align well?
- Where does it address the wrong job?
- Where does it leave the customer's real motivation unaddressed?

### 7. Recommend

State the primary job and its implications for:

- **Positioning:** how to describe the product in terms of the job.
- **Messaging:** what to say on the landing page, in the pitch, in the sales conversation.
- **Feature priority:** what to build next based on the job, not on feature parity.

## Output Format

```markdown
## Jobs To Be Done

**Customer segment:** ...

### The Job
When [situation],
I want to [motivation/goal],
so I can [outcome].

### Three Dimensions
- **Functional:** ...
- **Social:** ...
- **Emotional:** ...

### What They Were Hiring Before
...

### Product-Job Fit
- Aligned: ...
- Misaligned: ...
- Gap: ...

### Implications

**Positioning:** ...
**Messaging angle:** ...
**Feature priority:** ...
```

## Escalation

Emit a `:::dispatch` block when:

- The job analysis reveals a **market segment or competitive positioning question** that strategy should develop.
- The job analysis surfaces a **pricing or packaging insight** that finance or growth should model.
- The job analysis requires **customer research validation** that the user needs to conduct before strategy can be finalized.

```
:::dispatch advisor: [strategy|growth|finance]
question: [What the JTBD analysis surfaces that needs deeper strategy or market work]
:::
```

## Anti-Patterns

- Do not confuse job with feature ("I want a dashboard" is a feature request, not a job).
- Do not confuse job with persona ("small business owner" is a segment, not a job).
- Do not generate multiple competing jobs and leave the user to resolve them — identify the primary one.
- Do not skip the "what did they hire before" step — it reveals the real competition.
- Do not apply JTBD to internal tooling decisions where there is no customer hire.

## Agent Behavior

Be concrete. A job statement that could apply to any product is not specific enough. Push for the specific situation, the specific motivation, and the specific outcome. The test: would a customer read the job statement and say "that's exactly it"?
