import Anthropic from "@anthropic-ai/sdk";
import { getEaMemory, createArtifact, createDataCollectionSession } from "@/lib/db";
import { sendEmail, artifactEmailHtml, collectionEmailHtml } from "@/lib/email";

// Server-side: prefer APP_URL, then NEXT_PUBLIC_APP_URL, then NEXTAUTH_URL
const BASE_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export interface DueTask {
  id: string;
  orgId: string;
  userId: string;
  projectId: string;
  taskType: string;
  context: Record<string, unknown> | null;
  conversationId: string | null;
}

export const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fast)" },
] as const;

/**
 * Builds the briefing prompt from context fields (used both in executor and for UI preview).
 * If context.customPrompt is set, it takes full precedence.
 */
export function buildBriefingPrompt(
  context: Record<string, unknown>,
  templateContent = ""
): string {
  const customPrompt = context.customPrompt as string | undefined;
  if (customPrompt?.trim()) return customPrompt.trim();

  const title = (context.title as string) || "Daily Briefing";
  const topics = context.topics as string | undefined;
  const format = context.format as string | undefined;
  const useWebSearch = context.useWebSearch !== false; // default true

  return [
    `You are the Chief of Staff generating a briefing titled: "${title}".`,
    topics ? `Focus on these topics: ${topics}.` : "",
    format ? `Use this format: ${format}.` : "Format as structured markdown with clear sections.",
    templateContent ? `Reference this saved template:\n${templateContent}` : "",
    useWebSearch ? "Search the web for the latest information, then produce the briefing in full. Be thorough and specific." : "Produce the briefing in full based on your knowledge. Be thorough and specific.",
  ].filter(Boolean).join("\n\n");
}

/**
 * Executes a briefing task: calls Anthropic with web search, stores artifact, emails user.
 */
export async function executeBriefingTask(task: DueTask, userEmail: string): Promise<void> {
  const context = (task.context ?? {}) as Record<string, unknown>;
  const title = (context.title as string) || "Daily Briefing";
  const contextKey = context.contextKey as string | undefined;
  const useWebSearch = context.useWebSearch !== false; // default true
  const model = (context.model as string) || "claude-sonnet-4-5";

  let templateContent = "";
  if (contextKey) {
    try {
      const memEntry = await getEaMemory(task.userId, task.projectId, contextKey);
      if (memEntry) templateContent = memEntry.content;
    } catch {
      // non-critical
    }
  }

  const prompt = buildBriefingPrompt(context, templateContent);

  const tools: any[] = useWebSearch ? [{ type: "web_search_20250305", name: "web_search" }] : [];

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    ...(tools.length > 0 ? { tools } : {}),
    messages: [{ role: "user", content: prompt }],
  } as Parameters<typeof client.messages.create>[0]) as Anthropic.Message;

  // Extract only the final answer text. When web_search is used the response
  // contains preamble text blocks ("I'll search for..."), tool_use blocks, and
  // then the actual answer in the final text block(s). Take only text blocks
  // that appear after the last tool-related block so the preview and artifact
  // contain the real content, not the preamble.
  const blocks = response.content;
  let lastToolIdx = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if ((blocks[i] as { type: string }).type !== "text") { lastToolIdx = i; break; }
  }
  const answerBlocks = blocks
    .slice(lastToolIdx + 1)
    .filter((b) => (b as { type: string }).type === "text");
  const content = (answerBlocks.length > 0 ? answerBlocks : blocks.filter((b) => (b as { type: string }).type === "text"))
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("\n\n");

  const artifact = await createArtifact({
    taskId: task.id,
    orgId: task.orgId,
    userId: task.userId,
    title,
    content,
    artifactType: "briefing",
  });

  const artifactUrl = `${BASE_URL}/artifacts/${artifact.id}`;
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  await sendEmail(
    userEmail,
    `${title} — ${date}`,
    artifactEmailHtml({ title, content, artifactUrl, runNumber: artifact.runNumber, date }),
  );
}

export const DEFAULT_COLLECTION_SYSTEM_PROMPT =
  `You are the Chief of Staff helping gather status updates for a report.
Ask focused questions to understand what happened this period: key accomplishments, blockers, upcoming priorities, and any decisions needed.
Keep questions concise. When you have enough detail (usually after 3-6 exchanges), respond with a message ending with "I have enough to complete the report." and include nothing else after that phrase.`;

/**
 * Executes a status-report collection task: creates a token session, emails a data-collection link.
 */
export async function executeCollectionTask(task: DueTask, userEmail: string): Promise<void> {
  const context = (task.context ?? {}) as Record<string, unknown>;
  const title = (context.title as string) || "Status Report";
  const description = (context.description as string) ||
    "Please share your updates so I can compile the status report.";

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

  const session = await createDataCollectionSession({
    taskId: task.id,
    userId: task.userId,
    orgId: task.orgId,
    expiresAt,
  });

  const collectUrl = `${BASE_URL}/collect/${session.token}`;
  const expiresStr = expiresAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  await sendEmail(
    userEmail,
    `Updates needed: ${title}`,
    collectionEmailHtml({ title, description, collectUrl, expiresAt: expiresStr }),
  );
}
