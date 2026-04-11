import Anthropic from "@anthropic-ai/sdk";
import { COACH_META } from "./coaches";
import { getAllCoaches, getCoachByKey } from "./coaches-server";
import type { CoachConfig } from "./coaches";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export interface RoutingDecision {
  coaches: CoachConfig[];
  reasoning: string;
  synthesize: boolean;
}

function extractExplicitMention(message: string): CoachConfig | null {
  const lower = message.toLowerCase();
  const atMatch = lower.match(/@(\w+)/);
  if (atMatch) {
    const mention = atMatch[1];
    return getCoachByKey(mention) || null;
  }
  return null;
}

function scoreByKeywords(message: string): { coach: CoachConfig; score: number }[] {
  const lower = message.toLowerCase();
  const coaches = getAllCoaches();
  return coaches
    .map((coach) => {
      const score = coach.keywords.reduce((acc, kw) => {
        return acc + (lower.includes(kw) ? 1 : 0);
      }, 0);
      return { coach, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export async function routeMessage(message: string): Promise<RoutingDecision> {
  const explicit = extractExplicitMention(message);
  if (explicit) {
    return {
      coaches: [explicit],
      reasoning: `Explicitly requested @${explicit.key}`,
      synthesize: false,
    };
  }

  const keywordResults = scoreByKeywords(message);

  if (keywordResults.length === 1) {
    return {
      coaches: [keywordResults[0].coach],
      reasoning: `Keyword match: ${keywordResults[0].coach.name}`,
      synthesize: false,
    };
  }

  if (keywordResults.length > 1 && keywordResults[0].score > keywordResults[1].score * 2) {
    return {
      coaches: [keywordResults[0].coach],
      reasoning: `Strong keyword match: ${keywordResults[0].coach.name} (score: ${keywordResults[0].score})`,
      synthesize: false,
    };
  }

  const client = getClient();
  const coachList = COACH_META.map((c) => `- ${c.key}: ${c.name} - ${c.description}`).join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    system: `You are a message router for a business coach team. Given a user message, decide which coach(es) should handle it.

Available coaches:
${coachList}

Respond with ONLY valid JSON (no markdown):
{"coaches": ["key1", "key2"], "reasoning": "brief explanation", "synthesize": true/false}

Rules:
- Pick 1 coach for focused questions
- Pick 2-3 coaches for broad topics that span multiple domains
- Set synthesize=true when multiple coaches are involved and their responses should be combined
- Never pick more than 3 coaches
- Default to "founder" if genuinely ambiguous`,
    messages: [{ role: "user", content: message }],
  });

  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);
    const coaches = (parsed.coaches as string[])
      .map((key: string) => getCoachByKey(key))
      .filter(Boolean) as CoachConfig[];

    if (coaches.length === 0) {
      const fallback = getAllCoaches()[0];
      return {
        coaches: [fallback],
        reasoning: "Fallback to Founder Coach",
        synthesize: false,
      };
    }

    return {
      coaches,
      reasoning: parsed.reasoning || "LLM classification",
      synthesize: parsed.synthesize ?? coaches.length > 1,
    };
  } catch {
    const fallback = getAllCoaches()[0];
    return {
      coaches: [fallback],
      reasoning: "Router parse error, defaulting to Founder Coach",
      synthesize: false,
    };
  }
}
