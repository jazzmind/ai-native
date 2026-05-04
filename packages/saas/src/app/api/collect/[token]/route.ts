import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionByToken, updateSessionData, completeSession } from "@/lib/db/queries/data-collection";
import { createArtifact } from "@/lib/db/queries/task-artifacts";
import { getEaMemory } from "@/lib/db";
import { sendEmail, artifactEmailHtml } from "@/lib/email";
import { DEFAULT_COLLECTION_SYSTEM_PROMPT } from "@/lib/task-executor";
import type { CollectedMessage } from "@/lib/db/queries/data-collection";
import { getAgentTaskById } from "@/lib/db/queries/agent-tasks";

export const runtime = "nodejs";

const BASE_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await getSessionByToken(token);

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status === "complete") {
    return Response.json({ error: "Session already complete", complete: true }, { status: 410 });
  }

  if (new Date(session.expiresAt) < new Date()) {
    return Response.json({ error: "Session expired" }, { status: 410 });
  }

  const messages: CollectedMessage[] = session.collectedData
    ? JSON.parse(session.collectedData)
    : [];

  return Response.json({
    taskId: session.taskId,
    status: session.status,
    expiresAt: session.expiresAt,
    messages,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await getSessionByToken(token);

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status === "complete") {
    return Response.json({ error: "Session already complete" }, { status: 410 });
  }
  if (new Date(session.expiresAt) < new Date()) {
    return Response.json({ error: "Session expired" }, { status: 410 });
  }

  const { userMessage, complete } = await req.json() as { userMessage: string; complete?: boolean };

  const messages: CollectedMessage[] = session.collectedData
    ? JSON.parse(session.collectedData)
    : [];

  // Add user message
  messages.push({ role: "user", content: userMessage, timestamp: new Date().toISOString() });

  if (complete) {
    // Mark session complete and trigger synthesis
    await updateSessionData(token, messages);
    await completeSession(token);
    await triggerSynthesis(session, messages);
    return Response.json({ ok: true, complete: true });
  }

  // Load task context for custom prompt/model overrides
  let taskContext: Record<string, unknown> = {};
  try {
    const task = await getAgentTaskById(session.taskId);
    if (task?.context) taskContext = task.context as Record<string, unknown>;
  } catch { /* non-critical */ }

  const systemPrompt = (taskContext.customSystemPrompt as string) || DEFAULT_COLLECTION_SYSTEM_PROMPT;
  const model = (taskContext.model as string) || "claude-sonnet-4-5";

  const client = getClient();

  const anthropicMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  const assistantText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  messages.push({ role: "assistant", content: assistantText, timestamp: new Date().toISOString() });
  await updateSessionData(token, messages);

  const isDone = assistantText.includes("I have enough to complete the report");

  if (isDone) {
    await completeSession(token);
    await triggerSynthesis(session, messages);
  }

  return Response.json({ reply: assistantText, done: isDone });
}

async function triggerSynthesis(
  session: Awaited<ReturnType<typeof getSessionByToken>>,
  messages: CollectedMessage[]
) {
  if (!session) return;

  try {
    const client = getClient();

    // Load context_key if any — stored in task context via EA memory
    let extraContext = "";
    try {
      const memEntry = await getEaMemory(session.userId, session.taskId, "weekly_status_report");
      if (memEntry) extraContext = `\n\nTemplate to follow:\n${memEntry.content}`;
    } catch {
      // non-critical
    }

    const transcript = messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
    const prompt = `You are the Chief of Staff. Based on the following status update conversation, produce a comprehensive weekly status report in professional markdown format.${extraContext}

Conversation:
${transcript}

Produce the full status report now:`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("\n\n");

    const artifact = await createArtifact({
      taskId: session.taskId,
      orgId: session.orgId,
      userId: session.userId,
      title: "Weekly Status Report",
      content,
      artifactType: "status_report",
    });

    const artifactUrl = `${BASE_URL}/artifacts/${artifact.id}`;
    const preview = content.slice(0, 300).replace(/[#*`]/g, "").trim() + (content.length > 300 ? "…" : "");
    const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    await sendEmail(
      session.userId, // userId is the email
      `Weekly Status Report — ${date}`,
      artifactEmailHtml({ title: "Weekly Status Report", content, artifactUrl, runNumber: artifact.runNumber, date }),
    );
  } catch (err) {
    console.error("Synthesis failed:", err);
  }
}
