import Anthropic from "@anthropic-ai/sdk";
import { COACH_META } from "./coaches";
import { getAllCoaches, getCoachByKey } from "./coaches-server";
import type { CoachConfig } from "./coaches";
import { type AgentMode, isValidMode } from "./modes";

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
  lead?: string;
  mode: AgentMode;
}

async function extractExplicitMention(message: string, userId: string): Promise<CoachConfig | null> {
  const lower = message.toLowerCase();
  const atMatch = lower.match(/@(\w+)/);
  if (atMatch) {
    const mention = atMatch[1];
    return (await getCoachByKey(mention, userId)) || null;
  }
  return null;
}

export async function routeMessage(
  message: string,
  userId: string,
  explicitMode?: AgentMode
): Promise<RoutingDecision> {
  const explicit = await extractExplicitMention(message, userId);
  if (explicit) {
    return {
      coaches: [explicit],
      reasoning: `Explicitly requested @${explicit.key}`,
      synthesize: false,
      mode: explicitMode || "advise",
    };
  }

  const client = getClient();
  const coachList = COACH_META.map((c) => `- ${c.key}: ${c.name} - ${c.description}`).join("\n");

  const modeInstruction = explicitMode
    ? `The user has explicitly selected "${explicitMode}" mode. Use that mode. Do not override it.`
    : `Also determine the best operating mode from: advise, coach, plan, assist, execute.
Auto-detection hints:
- "help me understand" / "what should I" / "what are the options" -> advise
- "how do I get better at" / "teach me" / "help me learn" -> coach
- "create a plan" / "what are the steps" / "roadmap" / "timeline" -> plan
- "prepare" / "draft" / "put together" / "build me a" -> assist
- "do it" / "set up" / "send" / "create" / "execute" / "go ahead" -> execute
Default to "advise" if unclear.`;

  const modeCoachCountGuidance = explicitMode
    ? getModeCoachCountGuidance(explicitMode)
    : `- "plan" and "advise" modes tend toward 2-4 coaches for broad perspective
- "execute" mode tends toward 1-2 coaches (most relevant only)
- "coach" mode often works best with 1 coach for focused dialogue
- "assist" mode uses 1-3 coaches depending on artifact complexity`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: `You are a message router for an AI executive team. Given a user message, decide which advisor(s) should handle it and in what mode.

Available advisors:
${coachList}
- ea: Chief of Staff - executive assistant, task management, advisor orchestration, daily planning, recurring workflows, status reports, meeting notes, action items

Respond with ONLY valid JSON (no markdown):
{"coaches": ["key1", "key2", ...], "lead": "key1", "mode": "advise", "reasoning": "brief explanation"}

${modeInstruction}

Coach selection rules:
- Route to "ea" (and ONLY "ea") for operational/coordination requests: planning the day, open tasks, status reports, meeting notes, action item capture, recurring workflows, "what's on my plate", "follow up on X", "plan my day", template management
- Pick 2-4 advisors for most business questions since multiple perspectives add value
- Only pick 1 advisor for very narrow, single-domain questions (e.g. "what's my tax deadline")
${modeCoachCountGuidance}
- The "lead" is the most relevant advisor who will synthesize the final response
- lead MUST be one of the advisors you picked
- Never pick more than 4 advisors
- Default to "ea" as lead if genuinely ambiguous`,
      messages: [{ role: "user", content: message }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);
    const coaches = (await Promise.all(
      (parsed.coaches as string[]).map((key: string) => getCoachByKey(key, userId))
    )).filter(Boolean) as CoachConfig[];

    if (coaches.length === 0) {
      const allCoaches = await getAllCoaches(userId);
      const fallback = (await getCoachByKey("ea", userId)) || allCoaches[0];
      return {
        coaches: [fallback],
        reasoning: "Fallback to Chief of Staff",
        synthesize: false,
        mode: explicitMode || "advise",
      };
    }

    const lead = parsed.lead || coaches[0].key;
    const detectedMode = parsed.mode && isValidMode(parsed.mode) ? parsed.mode : "advise";

    return {
      coaches,
      reasoning: parsed.reasoning || "LLM classification",
      synthesize: coaches.length > 1,
      lead,
      mode: explicitMode || detectedMode,
    };
  } catch {
    const allCoaches = await getAllCoaches(userId);
    const fallback = (await getCoachByKey("ea", userId)) || allCoaches[0];
    return {
      coaches: [fallback],
      reasoning: "Router parse error, defaulting to Chief of Staff",
      synthesize: false,
      mode: explicitMode || "advise",
    };
  }
}

function getModeCoachCountGuidance(mode: AgentMode): string {
  switch (mode) {
    case "plan":
    case "advise":
      return "- In this mode, prefer 2-4 advisors for broad perspective";
    case "execute":
      return "- In execute mode, prefer 1-2 advisors (most relevant only)";
    case "coach":
      return "- In coach mode, prefer 1 advisor for focused dialogue";
    case "assist":
      return "- In assist mode, prefer 1-3 advisors depending on artifact complexity";
    default:
      return "";
  }
}
