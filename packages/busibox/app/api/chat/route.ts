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
  formatEaMemoryForPrompt,
} from "@ai-native/core";
import type { AgentMode, AgentSessionContext } from "@ai-native/core";
import { ensureDataDocuments } from "@lib/data-api-client";
import {
  getStorageProvider,
  getAgentProvider,
  getKnowledgeProvider,
  type BusiboxStorageProvider,
  type BusiboxAgentProvider,
  type BusiboxKnowledgeProvider,
} from "@lib/providers";
import { searchKnowledgeForContext } from "@lib/knowledge";

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

  const storage = getStorageProvider(dataAuth.apiToken);
  const agentProvider = getAgentProvider(auth.apiToken);
  const knowledgeProvider = getKnowledgeProvider(async () => dataAuth.apiToken);

  // Ensure documents and sync advisors
  const documentIds = await ensureDataDocuments(dataAuth.apiToken);
  await agentProvider.syncAdvisorsOnce({
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
    const conv = await storage.createConversation({
      orgId,
      userId,
      projectId,
      title: message.slice(0, 80),
    });
    conversationId = conv.id;
  }

  // Persist user message
  await storage.createMessage({
    conversationId,
    role: "user",
    content: message,
  });

  // Route to advisors
  const routing = await agentProvider.routeMessage({
    message,
    explicitCoachKeys: coachKeys?.length ? coachKeys : undefined,
    explicitMode: requestedMode as AgentMode | undefined,
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

        // Collect responses per coach for synthesis
        const coachResponses: Record<string, string> = {};

        // If EA orchestration — run EA first, may dispatch
        if (routing.coaches.length === 1 && routing.coaches[0]?.key === "ea") {
          await streamAdvisorResponse(
            agentProvider,
            storage,
            knowledgeProvider,
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
                agentProvider,
                storage,
                knowledgeProvider,
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
              agentProvider,
              routing.lead ?? routing.coaches[0]?.key ?? "strategy",
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

const SAFE_SKILL_NAME = /^[a-z0-9][a-z0-9_-]*$/i;

/** Load a skill's SKILL.md content by name. Returns null if not found or name is unsafe. */
function loadSkillContent(skillName: string): string | null {
  // Allowlist: only alphanumerics, hyphens, underscores. Prevents path traversal.
  if (!SAFE_SKILL_NAME.test(skillName)) {
    return null;
  }

  const skillsRoot = resolve(process.cwd(), "advisors", "skills");
  const candidates = [
    resolve(skillsRoot, skillName, "SKILL.md"),
    join(resolve(__dirname, "..", "..", "..", "advisors"), "skills", skillName, "SKILL.md"),
  ];
  for (const p of candidates) {
    // Verify the resolved path stays within the skills root
    if (!p.startsWith(skillsRoot)) {
      continue;
    }
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
  agentProvider: BusiboxAgentProvider,
  storage: BusiboxStorageProvider,
  knowledgeProvider: BusiboxKnowledgeProvider,
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
  const behaviors = await storage.listActiveBehaviors(orgId, userId, coachKey);
  const behaviorText = behaviors.length > 0
    ? "\n\n## Active Behavioral Directives\n" + behaviors.map((b) => `- ${b.directive}`).join("\n")
    : "";

  let eaMemoryText = "";
  if (isEa) {
    const memEntries = await storage.listEaMemory(userId, projectId);
    eaMemoryText = memEntries.length > 0
      ? "\n\n## EA Memory\n" + formatEaMemoryForPrompt(memEntries)
      : "";
  }

  // Enrich context with knowledge search
  let knowledgeText = "";
  try {
    knowledgeText = await searchKnowledgeForContext(
      knowledgeProvider,
      { userId, projectId },
      message,
    );
  } catch {
    // knowledge search is best-effort
  }

  const systemContext = behaviorText + eaMemoryText + knowledgeText;

  const ctx: AgentSessionContext = { conversationId, coachKey, orgId, userId, projectId };

  let fullText = "";
  let hadError = false;
  for await (const event of agentProvider.streamResponse(ctx, message, systemContext)) {
    switch (event.type) {
      case "text":
        fullText += event.text;
        sendFn(controller, { type: "text", coachKey, text: event.text });
        break;
      case "tool_use":
        sendFn(controller, { type: "tool_use", coachKey, toolName: event.toolName, toolInput: event.toolInput });
        break;
      case "error":
        sendFn(controller, { type: "error", coachKey, message: event.message });
        hadError = true;
        break;
      case "done":
        fullText = event.fullText || fullText;
        break;
      default:
        break;
    }
  }

  if (hadError) {
    // Mirrors the previous behavior of returning immediately when the
    // agent-api request failed, without emitting coach_done.
    return;
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
          agentProvider,
          storage,
          knowledgeProvider,
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
      await storage.upsertEaMemory({
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
      await storage.createAgentTask({
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
              agentProvider,
              storage,
              knowledgeProvider,
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
      await storage.createMessage({
        conversationId,
        role: "assistant",
        content: cleanedText,
        coachKey,
      });
    }
  } else if (fullText) {
    // Store non-EA advisor message
    await storage.createMessage({
      conversationId,
      role: "assistant",
      content: fullText,
      coachKey,
    });
  }

  sendFn(controller, { type: "coach_done", coachKey });
}

async function streamSynthesis(
  agentProvider: BusiboxAgentProvider,
  leadKey: string,
  userMessage: string,
  mode: string,
  coachResponses: Record<string, string>,
  controller: ReadableStreamDefaultController,
  sendFn: (controller: ReadableStreamDefaultController, data: object) => void,
): Promise<void> {
  sendFn(controller, { type: "synthesis_start", leadKey });

  const responses = Object.entries(coachResponses).map(([key, text]) => ({
    coachKey: key,
    coachName: getCoachMeta(key)?.name ?? key,
    response: text,
  }));

  let errored = false;
  for await (const event of agentProvider.synthesize(responses, userMessage, mode as AgentMode)) {
    if (event.type === "text") {
      sendFn(controller, { type: "synthesis_text", text: event.text });
    } else if (event.type === "error") {
      sendFn(controller, { type: "synthesis_error", message: event.message });
      errored = true;
    }
  }

  if (!errored) {
    sendFn(controller, { type: "synthesis_done" });
  }
}
