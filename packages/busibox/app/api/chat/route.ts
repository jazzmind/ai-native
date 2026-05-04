/**
 * Chat API Route — Busibox implementation
 *
 * Handles multi-advisor routing and streaming via busibox agent-api.
 * Mirrors the SaaS /api/chat/route.ts in structure and SSE event shape
 * so the shared Chat UI component works identically on both platforms.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { requireAuthWithTokenExchange } from "@lib/auth-middleware";
import {
  parseDispatchBlocks,
  parseMemoryBlocks,
  parseSkillBlocks,
  parseTaskBlocks,
  stripEaBlocks,
  getCoachMeta,
} from "@ai-native/core";
import {
  ensureDataDocuments,
  createConversation,
  createMessage,
  createTask,
  upsertEaMemory,
  listActiveBehaviors,
  listEaMemory,
} from "@lib/data-api-client";
import { routeMessage } from "@lib/router";
import { syncAdvisorsOnce } from "@lib/sync";
import { formatEaMemoryForPrompt } from "@ai-native/core";
import { BusiboxKnowledgeProvider, searchKnowledgeForContext } from "@lib/knowledge";

export const runtime = "nodejs";
export const maxDuration = 180;

interface ChatRequestBody {
  message: string;
  conversationId?: string | null;
  projectId?: string;
  coachKeys?: string[];
  mode?: string;
}

function send(controller: ReadableStreamDefaultController, data: object) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

export async function POST(request: NextRequest) {
  // Authenticate
  const auth = await requireAuthWithTokenExchange(request, "agent-api");
  if (auth instanceof NextResponse) return auth;

  // Also get data-api token for storage
  const dataAuth = await requireAuthWithTokenExchange(request, "data-api");
  if (dataAuth instanceof NextResponse) return dataAuth;

  // Parse body
  const body = (await request.json()) as ChatRequestBody;
  const { message, coachKeys, mode: requestedMode } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Ensure documents and sync advisors
  const documentIds = await ensureDataDocuments(dataAuth.apiToken);
  await syncAdvisorsOnce(auth.apiToken, {
    conversations: documentIds.conversations,
    messages: documentIds.messages,
    eaMemory: documentIds.eaMemory,
  });

  // Resolve user identity from token (Busibox SSO tokens carry userId)
  const { userId, orgId } = extractUserInfo(auth.apiToken);
  const projectId = body.projectId || "default";

  // Get or create conversation
  let conversationId = body.conversationId;
  if (!conversationId) {
    const conv = await createConversation(dataAuth.apiToken, documentIds.conversations, {
      orgId,
      userId,
      projectId,
      title: message.slice(0, 80),
    });
    conversationId = conv.id;
  }

  // Persist user message
  const userMsg = await createMessage(dataAuth.apiToken, documentIds.messages, {
    conversationId,
    role: "user",
    content: message,
  });

  // Route to advisors
  const routing = await routeMessage(auth.apiToken, {
    message,
    explicitCoachKeys: coachKeys?.length ? coachKeys : undefined,
    explicitMode: requestedMode as "advise" | "coach" | "plan" | "assist" | "execute" | undefined,
    projectContext: projectId,
  });

  // Build SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Emit routing decision
        send(controller, {
          type: "routing",
          coaches: routing.coaches.map((c) => c.key),
          lead: routing.lead,
          mode: routing.mode,
          synthesize: routing.synthesize,
        });
        send(controller, { type: "conversation_id", conversationId });

        const agentApiUrl = process.env.AGENT_API_URL || "http://localhost:8000";

        // Collect responses per coach for synthesis
        const coachResponses: Record<string, string> = {};

        // If EA orchestration — run EA first, may dispatch
        if (routing.coaches.length === 1 && routing.coaches[0]?.key === "ea") {
          await streamAdvisorResponse(
            agentApiUrl,
            auth.apiToken,
            dataAuth.apiToken,
            documentIds,
            conversationId,
            "ea",
            message,
            routing.mode,
            userId,
            projectId,
            orgId,
            controller,
            send,
            coachResponses,
            true, // isEa
          );
        } else {
          // Parallel advisor responses
          await Promise.all(
            routing.coaches.map((coach) =>
              streamAdvisorResponse(
                agentApiUrl,
                auth.apiToken,
                dataAuth.apiToken,
                documentIds,
                conversationId!,
                coach.key,
                message,
                routing.mode,
                userId,
                projectId,
                orgId,
                controller,
                send,
                coachResponses,
                false,
              ),
            ),
          );

          // Synthesize if multiple advisors
          if (routing.synthesize && Object.keys(coachResponses).length > 1) {
            await streamSynthesis(
              agentApiUrl,
              auth.apiToken,
              routing.lead,
              message,
              routing.mode,
              coachResponses,
              controller,
              send,
            );
          }
        }

        send(controller, { type: "done", conversationId });
        controller.close();
      } catch (err) {
        console.error("[CHAT] Stream error:", err);
        send(controller, { type: "error", message: String(err) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Load a skill's SKILL.md content by name. Returns null if not found. */
function loadSkillContent(skillName: string): string | null {
  const candidates = [
    resolve(process.cwd(), "advisors", "skills", skillName, "SKILL.md"),
    join(resolve(__dirname, "..", "..", "..", "advisors"), "skills", skillName, "SKILL.md"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return readFileSync(p, "utf-8");
    }
  }
  return null;
}

/** Build the second-pass prompt for a skill invocation */
function buildSkillPrompt(skillName: string, skillContent: string, context: string, originalMessage: string): string {
  return `The user sent this message: "${originalMessage}"

You identified that this situation calls for the **${skillName}** skill. Apply the skill process below to the following context:

**Context:** ${context}

---

${skillContent}

---

Now apply the skill process to the context above and respond to the user.`;
}

/** Extract userId/orgId from a Busibox JWT token payload */
function extractUserInfo(token: string): { userId: string; orgId: string } {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    return {
      userId: (payload.sub as string) || "unknown",
      orgId: (payload.org_id as string) || "unknown",
    };
  } catch {
    return { userId: "unknown", orgId: "unknown" };
  }
}

async function streamAdvisorResponse(
  agentApiUrl: string,
  agentToken: string,
  dataToken: string,
  documentIds: Awaited<ReturnType<typeof ensureDataDocuments>>,
  conversationId: string,
  coachKey: string,
  message: string,
  mode: string,
  userId: string,
  projectId: string,
  orgId: string,
  controller: ReadableStreamDefaultController,
  sendFn: (controller: ReadableStreamDefaultController, data: object) => void,
  coachResponses: Record<string, string>,
  isEa: boolean,
): Promise<void> {
  const coach = getCoachMeta(coachKey);
  if (!coach) return;

  sendFn(controller, { type: "coach_start", coachKey });

  // Build context for this advisor
  const behaviors = await listActiveBehaviors(dataToken, documentIds.behaviors, orgId, userId, coachKey);
  const behaviorText = behaviors.length > 0
    ? "\n\n## Active Behavioral Directives\n" + behaviors.map((b) => `- ${b.directive}`).join("\n")
    : "";

  let eaMemoryText = "";
  if (isEa) {
    const memEntries = await listEaMemory(dataToken, documentIds.eaMemory, userId, projectId);
    eaMemoryText = memEntries.length > 0
      ? "\n\n## EA Memory\n" + formatEaMemoryForPrompt(memEntries)
      : "";
  }

  // Enrich context with knowledge search
  let knowledgeText = "";
  try {
    const searchApiToken = dataToken; // search-api uses same token exchange
    const knowledgeProvider = new BusiboxKnowledgeProvider(async () => searchApiToken);
    knowledgeText = await searchKnowledgeForContext(
      knowledgeProvider,
      { userId, projectId },
      message,
    );
  } catch {
    // knowledge search is best-effort
  }

  const systemContext = behaviorText + eaMemoryText + knowledgeText;

  // Stream via agent-api sessions endpoint
  const res = await fetch(`${agentApiUrl}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${agentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_name: coachKey,
      conversation_id: `${conversationId}:${coachKey}`,
      message,
      system_context: systemContext,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    sendFn(controller, {
      type: "error",
      coachKey,
      message: `Agent ${coachKey} unavailable: ${res.status}`,
    });
    return;
  }

  let fullText = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as { type: string; text?: string; tool?: string; input?: unknown };
        if (event.type === "text" && event.text) {
          fullText += event.text;
          sendFn(controller, { type: "text", coachKey, text: event.text });
        } else if (event.type === "tool_use") {
          sendFn(controller, { type: "tool_use", coachKey, toolName: event.tool, toolInput: event.input });
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  coachResponses[coachKey] = fullText;

  // Handle skill invocations for all advisors
  if (fullText) {
    const skillInvocations = parseSkillBlocks(fullText);
    for (const invocation of skillInvocations) {
      const skillContent = loadSkillContent(invocation.skillName);
      if (skillContent) {
        sendFn(controller, {
          type: "skill_invoked",
          coachKey,
          skillName: invocation.skillName,
        });
        const skillPrompt = buildSkillPrompt(
          invocation.skillName,
          skillContent,
          invocation.context,
          message,
        );
        // Second-pass: same advisor applies the skill
        const skillResponses: Record<string, string> = {};
        await streamAdvisorResponse(
          agentApiUrl,
          agentToken,
          dataToken,
          documentIds,
          conversationId,
          coachKey,
          skillPrompt,
          mode,
          userId,
          projectId,
          orgId,
          controller,
          sendFn,
          skillResponses,
          isEa,
        );
        // Merge the skill response into coachResponses
        if (skillResponses[coachKey]) {
          coachResponses[coachKey] = (coachResponses[coachKey] ?? "") + "\n\n" + skillResponses[coachKey];
        }
      } else {
        console.warn(`[CHAT] Skill "${invocation.skillName}" not found in advisors/skills/`);
      }
    }
  }

  // Process EA side effects (:::dispatch, :::memory, :::task)
  if (isEa && fullText) {
    const dispatches = parseDispatchBlocks(fullText);
    const memories = parseMemoryBlocks(fullText);
    const tasks = parseTaskBlocks(fullText);

    // Process memory writes
    for (const mem of memories) {
      await upsertEaMemory(dataToken, documentIds.eaMemory, {
        orgId,
        userId,
        projectId,
        memoryType: mem.type,
        key: mem.key,
        title: mem.title,
        content: mem.content,
      });
    }

    // Process task creation
    for (const task of tasks) {
      await createTask(dataToken, documentIds.tasks, {
        orgId,
        userId,
        projectId,
        conversationId,
        taskType: task.type,
        title: task.title,
        triggerAt: task.triggerAt,
        triggerDescription: task.triggerDescription,
        repeatInterval: task.repeatInterval,
        contextKey: task.contextKey,
      });
    }

    // Process dispatches — run dispatched advisors and collect their responses
    if (dispatches.length > 0) {
      for (const dispatch of dispatches) {
        for (const advisorKey of dispatch.advisors) {
          if (getCoachMeta(advisorKey)) {
            await streamAdvisorResponse(
              agentApiUrl,
              agentToken,
              dataToken,
              documentIds,
              conversationId,
              advisorKey,
              dispatch.question,
              "advise",
              userId,
              projectId,
              orgId,
              controller,
              sendFn,
              coachResponses,
              false,
            );
          }
        }
      }
    }

    // Store cleaned EA message
    const cleanedText = stripEaBlocks(fullText);
    if (cleanedText) {
      await createMessage(dataToken, documentIds.messages, {
        conversationId,
        role: "assistant",
        content: cleanedText,
        coachKey,
      });
    }
  } else if (fullText) {
    // Store non-EA advisor message
    await createMessage(dataToken, documentIds.messages, {
      conversationId,
      role: "assistant",
      content: fullText,
      coachKey,
    });
  }

  sendFn(controller, { type: "coach_done", coachKey });
}

async function streamSynthesis(
  agentApiUrl: string,
  agentToken: string,
  leadKey: string,
  userMessage: string,
  mode: string,
  coachResponses: Record<string, string>,
  controller: ReadableStreamDefaultController,
  sendFn: (controller: ReadableStreamDefaultController, data: object) => void,
): Promise<void> {
  sendFn(controller, { type: "synthesis_start", leadKey });

  const responseContext = Object.entries(coachResponses)
    .map(([key, text]) => {
      const coach = getCoachMeta(key);
      return `## ${coach?.name ?? key}\n${text}`;
    })
    .join("\n\n---\n\n");

  const synthesisPrompt = `You have received responses from ${Object.keys(coachResponses).length} advisors to this question: "${userMessage}"

${responseContext}

Synthesize these responses into a unified answer that:
1. Highlights where advisors agree (with high confidence)
2. Surfaces tensions or disagreements (and explains them)
3. Gives the user a clear, actionable path forward
4. Cites advisors by name when drawing on their specific expertise
5. Uses the ${mode} mode: ${getSynthesisModeInstruction(mode)}`;

  const res = await fetch(`${agentApiUrl}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${agentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_name: leadKey,
      conversation_id: `synthesis-${Date.now()}`,
      message: synthesisPrompt,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    sendFn(controller, { type: "synthesis_error", message: `Synthesis unavailable: ${res.status}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as { type: string; text?: string };
        if (event.type === "text" && event.text) {
          sendFn(controller, { type: "synthesis_text", text: event.text });
        }
      } catch {
        // skip
      }
    }
  }

  sendFn(controller, { type: "synthesis_done" });
}

function getSynthesisModeInstruction(mode: string): string {
  const instructions: Record<string, string> = {
    advise: "give concrete recommendations and analysis",
    coach: "help the user build capability and understanding",
    plan: "produce structured action items with owners and timelines",
    assist: "prepare the materials, the user will decide",
    execute: "make the decision and describe the actions to take",
  };
  return instructions[mode] ?? instructions["advise"]!;
}
