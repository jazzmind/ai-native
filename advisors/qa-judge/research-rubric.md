# Research Quality Rubric

Use this rubric to evaluate the quality of research-based recommendations.

## Criteria (each scored 1-5)

### 1. Source Quality (weight: 30%)
- **5**: Multiple independent, credible sources. Real production usage documented. Practitioner validation from HN/Reddit/engineering blogs.
- **4**: Good sources with minor gaps. At least one strong practitioner source.
- **3**: Sources exist but are mostly vendor/project-originated. Limited independent validation.
- **2**: Relies heavily on GEO-susceptible content (listicles, comparison articles from content farms).
- **1**: Sources are unverifiable, self-referential, or fabricated.

### 2. Traction Verification (weight: 25%)
- **5**: Quantified adoption metrics (stars, downloads, named production users). Clear community activity.
- **4**: Some metrics provided, mostly credible. Minor gaps in verification.
- **3**: Claims adoption but provides limited hard numbers. Some signals present.
- **2**: Adoption claims are vague ("widely used", "growing community") without evidence.
- **1**: No traction evidence, or evidence contradicts the recommendation.

### 3. Reasoning Rigor (weight: 20%)
- **5**: Clear logic chain from requirements to recommendation. Tradeoffs explicitly stated. Assumptions declared.
- **4**: Sound reasoning with minor unstated assumptions.
- **3**: Logic is present but surface-level. Feature matching without depth evaluation.
- **2**: Cherry-picked evidence. Significant biases present (recency, authority, hype).
- **1**: Recommendation doesn't follow from the evidence presented.

### 4. Alternative Coverage (weight: 15%)
- **5**: All major alternatives evaluated. Clear rationale for why the recommendation wins.
- **4**: Most alternatives covered. Minor omissions.
- **3**: Some alternatives mentioned but not deeply compared.
- **2**: Obvious alternatives missing without explanation.
- **1**: No alternatives considered.

### 5. Actionability (weight: 10%)
- **5**: Clear next steps, implementation path, risk mitigation. Practical and specific.
- **4**: Good guidance with minor gaps.
- **3**: General direction provided but lacks specifics.
- **2**: Vague or overly theoretical.
- **1**: No actionable guidance.

## Scoring

- **Total ≥ 4.0**: PASS — Research meets quality standards
- **Total 3.0-3.9**: CONCERNS — Research needs supplemental verification in flagged areas
- **Total < 3.0**: FAIL — Research should be redone with specific guidance on what to fix

## GEO Red Flags (automatic penalty)

Any of these findings reduce the total score by 0.5 points each:
- Recommending a tool with < 500 GitHub stars as a primary solution
- Primary sources are the tool's own marketing materials
- No practitioner discussion found on HN, Reddit, or engineering blogs
- "Comparison" articles from content farm domains
- Claims that can't be independently verified
