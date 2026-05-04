import Anthropic from "@anthropic-ai/sdk";
import { getProfileProvider } from "@/lib/profile";
import { getKnowledgeProvider } from "@/lib/knowledge";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

interface ExtractedFact {
  category: string;
  key: string;
  value: string;
}

interface ExtractedKnowledge {
  title: string;
  content: string;
  tags: string[];
}

export interface ExtractionResult {
  facts: ExtractedFact[];
  knowledge: ExtractedKnowledge[];
}

export async function extractFromConversation(
  userMessage: string,
  advisorResponses: Map<string, string>,
  synthesisText: string | null,
  userId: string,
  projectId: string,
  conversationId: string,
  orgId = "unknown"
): Promise<ExtractionResult> {
  const result: ExtractionResult = { facts: [], knowledge: [] };

  const responseSummary = Array.from(advisorResponses.entries())
    .map(([key, text]) => `[${key}]: ${text.slice(0, 1500)}`)
    .join("\n\n");

  const fullContext = [
    `User: ${userMessage}`,
    responseSummary,
    synthesisText ? `Synthesis: ${synthesisText.slice(0, 1500)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const [facts, knowledge] = await Promise.all([
    extractProfileFacts(fullContext),
    extractKnowledgeItems(fullContext),
  ]);

  const profileProvider = getProfileProvider();
  for (const fact of facts) {
    try {
      await profileProvider.upsert(userId, fact.category, fact.key, fact.value, conversationId, orgId);
    } catch {
      // skip individual upsert failures
    }
  }
  result.facts = facts;

  const knowledgeProvider = getKnowledgeProvider();
  for (const item of knowledge) {
    try {
      await knowledgeProvider.ingest(
        { userId, projectId },
        {
          content: item.content,
          title: item.title,
          source: `conversation:${conversationId}`,
          metadata: { tags: item.tags, auto_extracted: true },
        }
      );
    } catch {
      // skip individual ingest failures
    }
  }
  result.knowledge = knowledge;

  return result;
}

export async function extractFromThread(
  messages: { role: string; content: string; coach_key: string | null }[],
  userId: string,
  projectId: string,
  conversationId: string
): Promise<ExtractionResult> {
  const result: ExtractionResult = { facts: [], knowledge: [] };

  const userMessages: string[] = [];
  const advisorResponses: Map<string, string[]> = new Map();

  for (const msg of messages) {
    if (msg.role === "user") {
      userMessages.push(msg.content);
    } else if (msg.role === "assistant" && msg.content) {
      const key = msg.coach_key || "advisor";
      if (!advisorResponses.has(key)) advisorResponses.set(key, []);
      advisorResponses.get(key)!.push(msg.content);
    }
  }

  const parts: string[] = [];
  for (const userMsg of userMessages) {
    parts.push(`User: ${userMsg}`);
  }
  for (const [key, responses] of advisorResponses.entries()) {
    parts.push(`[${key}]: ${responses.join("\n\n")}`);
  }

  const fullContext = parts.join("\n\n---\n\n").slice(0, 8000);

  const [facts, knowledge] = await Promise.all([
    extractProfileFacts(fullContext),
    extractKnowledgeItems(fullContext),
  ]);

  const profileProvider = getProfileProvider();
  for (const fact of facts) {
    try {
      await profileProvider.upsert(userId, fact.category, fact.key, fact.value, conversationId);
    } catch {
      // skip individual upsert failures
    }
  }
  result.facts = facts;

  const knowledgeProvider = getKnowledgeProvider();
  for (const item of knowledge) {
    try {
      await knowledgeProvider.ingest(
        { userId, projectId },
        {
          content: item.content,
          title: item.title,
          source: `conversation:${conversationId}`,
          metadata: { tags: item.tags, auto_extracted: true },
        }
      );
    } catch {
      // skip individual ingest failures
    }
  }
  result.knowledge = knowledge;

  return result;
}

async function extractProfileFacts(context: string): Promise<ExtractedFact[]> {
  const client = getClient();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: `You extract user profile facts from business conversations. Only extract when there is clear, explicit signal — never guess or infer weakly.

Return a JSON array of facts. Each fact has:
- category: one of "personal", "company", "preferences", "goals", "context"
- key: short identifier (e.g. "location", "company_name", "funding_preference")
- value: the fact value

Rules:
- Only extract facts the user explicitly stated or clearly implied
- Skip if the user is just asking questions without revealing facts about themselves
- Prefer fewer, high-confidence facts over many uncertain ones
- If nothing worth extracting, return an empty array

Return ONLY valid JSON. No markdown, no explanation.`,
      messages: [
        {
          role: "user",
          content: `Extract user profile facts from this conversation:\n\n${context.slice(0, 4000)}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f: any) => f.category && f.key && f.value
    ) as ExtractedFact[];
  } catch (err) {
    console.error("[auto-extract] extractProfileFacts failed:", err);
    return [];
  }
}

async function extractKnowledgeItems(
  context: string
): Promise<ExtractedKnowledge[]> {
  const client = getClient();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: `You extract reusable knowledge items from business advisory conversations. Only extract when the advisors provide concrete, referenceable information worth remembering.

Return a JSON array of knowledge items. Each item has:
- title: brief descriptive title
- content: the knowledge content (can be multiple paragraphs)
- tags: array of categorization tags

Types of knowledge worth extracting:
- Strategic recommendations with specific rationale
- Action items or decisions made
- Framework or methodology recommendations
- Market/industry insights shared
- Financial guidance or benchmarks
- Legal or compliance considerations
- Technical architecture decisions

Rules:
- Only extract substantive, actionable knowledge
- Skip generic advice or obvious statements
- Each item should be self-contained and understandable out of context
- If nothing worth extracting, return an empty array

Return ONLY valid JSON. No markdown, no explanation.`,
      messages: [
        {
          role: "user",
          content: `Extract knowledge items from this advisory conversation:\n\n${context.slice(0, 6000)}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (k: any) => k.title && k.content
    ) as ExtractedKnowledge[];
  } catch (err) {
    console.error("[auto-extract] extractKnowledgeItems failed:", err);
    return [];
  }
}
