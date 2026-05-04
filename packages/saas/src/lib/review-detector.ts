import Anthropic from "@anthropic-ai/sdk";

export interface ReviewSuggestion {
  shouldSuggest: boolean;
  reason: string;
  domain: string;
  urgency: 'low' | 'medium' | 'high';
}

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a risk classifier. Given a user question and AI advisor responses, determine if a HUMAN expert review would add significant value.

Suggest review ONLY for high-stakes topics:
- Legal contracts, terms, compliance, regulatory matters
- Tax strategy, credits, deductions with specific dollar amounts
- Financial projections used for fundraising or major decisions
- Medical, health, or safety-related advice
- Intellectual property, patents, trademarks
- Employment law, HR compliance
- Insurance, liability coverage analysis

Do NOT suggest review for:
- General business strategy or brainstorming
- Marketing ideas or growth tactics
- Product roadmap discussions
- General coaching or mentoring
- Technical architecture decisions

Respond with JSON only:
{
  "shouldSuggest": boolean,
  "reason": "1-sentence explanation of why human review would help",
  "domain": "legal|tax|finance|compliance|health|ip|employment|insurance|general",
  "urgency": "low|medium|high"
}`;

export async function detectReviewNeed(
  userMessage: string,
  responses: Map<string, string>,
  mode: string,
): Promise<ReviewSuggestion> {
  const client = getClient();

  const responseSummary = Array.from(responses.entries())
    .map(([key, text]) => `[${key}]: ${text.slice(0, 500)}`)
    .join('\n\n');

  try {
    const result = await client.messages.create({
      model: "claude-haiku-4-5-20250415",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Mode: ${mode}\n\nUser question: ${userMessage}\n\nAdvisor responses:\n${responseSummary}`,
      }],
    });

    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    const parsed = JSON.parse(text);

    return {
      shouldSuggest: !!parsed.shouldSuggest,
      reason: parsed.reason || '',
      domain: parsed.domain || 'general',
      urgency: parsed.urgency || 'low',
    };
  } catch {
    return { shouldSuggest: false, reason: '', domain: 'general', urgency: 'low' };
  }
}
