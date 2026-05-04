import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import Anthropic from "@anthropic-ai/sdk";
import { routeMessage } from "@/lib/router";
import { getOrCreateSession, streamCoachResponse } from "@/lib/session-manager";
import {
  addMessage,
  createConversation,
  getConversation,
  getActiveBehaviors,
  getExpertComments,
  listEaMemory,
  upsertEaMemory,
  formatEaMemoryForPrompt,
} from "@/lib/db";
import { getActivityProvider } from "@/lib/activity";
import { getProfileProvider, formatProfileForPrompt } from "@/lib/profile";
import { getKnowledgeProvider } from "@/lib/knowledge";
import { extractFromConversation } from "@/lib/auto-extract";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { resolveAnthropicKey, BYOKeyRequiredError } from "@/lib/api-key-resolver";
import { getCoachByKey } from "@/lib/coaches-server";
import type { CoachConfig } from "@/lib/coaches";
import { type AgentMode, isValidMode } from "@/lib/modes";
import { loadModeTemplate } from "@/lib/modes-server";
import { trackEvent, Events } from "@/lib/usage-tracking";
import { detectReviewNeed } from "@/lib/review-detector";
import { parseTaskBlocks } from "@/lib/parse-tasks";
import { parseDispatchBlocks, parseMemoryBlocks, parseExpertRequests, stripEaBlocks } from "@/lib/parse-dispatch";

export const runtime = "nodejs";
export const maxDuration = 300;

function formatBehaviorDirectives(directives: { directive: string }[]): string {
  if (directives.length === 0) return "";
  return "\n\n[Behavioral Directives]\n" +
    directives.map((d) => `- ${d.directive}`).join("\n") + "\n";
}

function formatExpertContext(comments: { author_email: string; author_name: string | null; content: string }[]): string {
  if (comments.length === 0) return "";
  return "\n\n[Expert Feedback]\n" +
    comments.map((c) => {
      const name = c.author_name || c.author_email;
      return `${name}: "${c.content}"`;
    }).join("\n") + "\n";
}

export async function POST(req: NextRequest) {
  let user;
  let orgId = '';
  let orgPlan: 'free' | 'pro' | 'team' = 'free';
  let anthropicKey: string;
  try {
    const result = await getRequiredUserAndOrg();
    user = result.user;
    orgId = result.org.id;
    orgPlan = (result.org.plan as 'free' | 'pro' | 'team') || 'free';
    anthropicKey = await resolveAnthropicKey(orgId, user.id, orgPlan);
  } catch (err) {
    if (err instanceof BYOKeyRequiredError) {
      return Response.json({ error: err.message, code: 'BYO_KEY_REQUIRED' }, { status: 402 });
    }
    return handleAuthError(err);
  }

  const body = await req.json();
  const { message, conversationId, coachKeys, projectId, mode: requestedMode, attachments } = body as {
    message: string;
    conversationId?: string;
    coachKeys?: string[];
    projectId: string;
    mode?: string;
    attachments?: { fileId: string; filename: string; extractedText: string; mimeType: string }[];
  };

  if (!message?.trim()) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }
  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const explicitMode: AgentMode | undefined =
    requestedMode && isValidMode(requestedMode) ? requestedMode : undefined;

  let convId = conversationId;
  let isNewConversation = false;
  if (!convId || !(await getConversation(convId, user.id))) {
    convId = uuidv4();
    isNewConversation = true;
    const title = message.slice(0, 80) + (message.length > 80 ? "..." : "");
    await createConversation(convId, title, user.id, projectId);
    trackEvent(orgId, user.id, Events.CONVERSATION_CREATED, { conversationId: convId, projectId });
  }

  await addMessage(convId, "user", message, null, explicitMode || null);
  trackEvent(orgId, user.id, Events.MESSAGE_SENT, {
    conversationId: convId,
    projectId,
    isNewConversation,
    coachCount: coachKeys?.length || 0,
    mode: explicitMode || 'auto',
  });

  let coaches: CoachConfig[];
  let synthesize = false;
  let routingInfo = "";
  let leadKey: string | undefined;
  let activeMode: AgentMode;

  if (coachKeys && coachKeys.length > 0) {
    const resolved = (await Promise.all(coachKeys.map((k) => getCoachByKey(k))))
      .filter(Boolean) as CoachConfig[];
    if (resolved.length === 0) {
      return Response.json({ error: "No valid coaches found" }, { status: 400 });
    }
    coaches = resolved;
    synthesize = coaches.length > 1;
    leadKey = coaches[0].key;
    routingInfo = `Selected: ${coaches.map((c) => c.name).join(", ")}`;
    activeMode = explicitMode || "advise";
  } else {
    const decision = await routeMessage(message, explicitMode);
    coaches = decision.coaches;
    synthesize = decision.synthesize;
    routingInfo = decision.reasoning;
    leadKey = decision.lead || coaches[0].key;
    activeMode = decision.mode;
  }

  const isEaOrchestration = coaches.length === 1 && coaches[0].key === "ea";

  const modeTemplate = loadModeTemplate(activeMode);
  const expertComments = await getExpertComments(convId);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller closed
        }
      };

      send({
        type: "routing",
        conversationId: convId,
        coaches: coaches.map((c) => ({
          key: c.key,
          name: c.name,
          icon: c.icon,
          isLead: c.key === leadKey,
        })),
        reasoning: routingInfo,
        synthesize,
        lead: leadKey,
        mode: activeMode,
      });

      for (const coach of coaches) {
        send({
          type: "coach_start",
          coachKey: coach.key,
          coachName: coach.name,
          isLead: coach.key === leadKey,
        });
      }

      const profileProvider = getProfileProvider();
      const profileEntries = await profileProvider.list(user.id);
      const profileContext = formatProfileForPrompt(profileEntries);

      let knowledgeContext = "";
      try {
        const knowledgeProvider = getKnowledgeProvider();
        const available = await knowledgeProvider.isAvailable();
        if (available) {
          const results = await knowledgeProvider.search(
            { userId: user.id, projectId },
            message,
            { limit: 5 }
          );
          if (results.length > 0) {
            knowledgeContext = "\n\n[Organizational Knowledge]\n" +
              results.map((r) => {
                const title = r.title ? `**${r.title}**: ` : "";
                const source = r.source ? ` (source: ${r.source})` : "";
                return `- ${title}${r.content.slice(0, 500)}${source}`;
              }).join("\n") + "\n";
          }
        }
      } catch {
        // knowledge search is non-critical
      }

      const contextParts: string[] = [];
      contextParts.push(`[MODE: ${activeMode.toUpperCase()}]\n${modeTemplate}`);

      const expertContext = formatExpertContext(expertComments);
      if (expertContext) contextParts.push(expertContext);

      if (profileContext) {
        contextParts.push(`[User Profile Context]${profileContext}`);
      }

      if (knowledgeContext) {
        contextParts.push(knowledgeContext);
      }

      if (attachments && attachments.length > 0) {
        const attachmentContext = attachments.map(a => {
          const text = a.extractedText
            ? `\n${a.extractedText.slice(0, 15000)}`
            : '\n[Binary file — no text extracted]';
          return `[Attached Document: ${a.filename} (${a.mimeType})]${text}`;
        }).join('\n\n');
        contextParts.push(attachmentContext);
      }

      const activityProvider = getActivityProvider();
      const coachResponses = new Map<string, string>();

      // ── EA ORCHESTRATION PATH ───────────────────────────────────────────────
      if (isEaOrchestration) {
        const eaCoach = coaches[0];

        // Load EA memory to provide context
        let eaMemoryContext = "";
        try {
          const memoryEntries = await listEaMemory(user.id, projectId);
          const formatted = formatEaMemoryForPrompt(memoryEntries);
          if (formatted) {
            eaMemoryContext = `\n\n[EA Memory — Your Stored Templates & Context]\n${formatted}`;
          }
        } catch {
          // non-critical
        }

        // Phase 1: EA planning turn
        send({ type: "ea_planning_start", coachKey: "ea" });

        const eaFullContext = [...contextParts];
        if (eaMemoryContext) eaFullContext.push(eaMemoryContext);
        const eaBehaviors = await getActiveBehaviors(user.id, projectId, "ea");
        const eaBehaviorContext = formatBehaviorDirectives(eaBehaviors);
        if (eaBehaviorContext) eaFullContext.push(eaBehaviorContext);

        const eaPlanningMessage = eaFullContext.join("\n\n") + `\n\n${message}`;

        let eaPlanningResponse = "";
        try {
          const sessionId = await getOrCreateSession(convId!, eaCoach, anthropicKey);
          for await (const event of streamCoachResponse(sessionId, eaPlanningMessage, eaCoach.key, anthropicKey)) {
            switch (event.type) {
              case "text":
                eaPlanningResponse += event.content;
                send({ type: "text", content: event.content, coachKey: "ea" });
                break;
              case "tool_use":
                send({ type: "tool_use", tool: event.content, coachKey: "ea" });
                activityProvider.add(user.id, convId!, "ea", "tool_use", { tool: event.content, input: event.toolInput }, orgId);
                break;
              case "tool_result":
                send({ type: "tool_result", content: event.content, coachKey: "ea", toolName: event.toolName });
                break;
              case "thinking":
                send({ type: "thinking", coachKey: "ea" });
                break;
              case "usage":
                send({ type: "usage", coachKey: "ea", usage: event.usage });
                activityProvider.add(user.id, convId!, "ea", "usage", event.usage as Record<string, unknown>, orgId);
                break;
              case "context_compacted":
                send({ type: "context_compacted", coachKey: "ea" });
                break;
              case "error":
                send({ type: "error", content: event.content, coachKey: "ea" });
                break;
            }
          }
        } catch (err) {
          send({ type: "error", content: String(err), coachKey: "ea" });
        }

        send({ type: "ea_planning_done", coachKey: "ea" });

        // Persist EA memory blocks
        const memoryBlocks = parseMemoryBlocks(eaPlanningResponse);
        for (const block of memoryBlocks) {
          try {
            await upsertEaMemory({
              orgId,
              userId: user.id,
              projectId,
              memoryType: block.type,
              key: block.key,
              title: block.title,
              content: block.content,
            });
            send({ type: "ea_memory_saved", key: block.key, title: block.title, memoryType: block.type });
          } catch {
            // non-critical
          }
        }

        // Emit expert request suggestions
        const expertRequests = parseExpertRequests(eaPlanningResponse);
        for (const req of expertRequests) {
          send({ type: "ea_expert_request", domain: req.domain, title: req.title, question: req.question, budgetHint: req.budgetHint });
        }

        // Phase 2: Dispatch to advisors if EA requested it
        const dispatchBlocks = parseDispatchBlocks(eaPlanningResponse);
        const advisorResponses = new Map<string, string>();

        if (dispatchBlocks.length > 0) {
          // Collect all unique advisor keys to dispatch
          const dispatchMap = new Map<string, string[]>(); // advisorKey -> questions
          for (const block of dispatchBlocks) {
            for (const advisorKey of block.advisors) {
              const existing = dispatchMap.get(advisorKey) ?? [];
              existing.push(block.question);
              dispatchMap.set(advisorKey, existing);
            }
          }

          const dispatchedCoaches: CoachConfig[] = [];
          for (const key of dispatchMap.keys()) {
            const coach = await getCoachByKey(key);
            if (coach) dispatchedCoaches.push(coach);
          }

          if (dispatchedCoaches.length > 0) {
            send({
              type: "ea_dispatch",
              advisors: dispatchedCoaches.map((c) => ({ key: c.key, name: c.name, icon: c.icon })),
            });

            for (const coach of dispatchedCoaches) {
              send({ type: "coach_start", coachKey: coach.key, coachName: coach.name, isLead: false });
            }

            const advisorPromises = dispatchedCoaches.map(async (coach) => {
              const questions = dispatchMap.get(coach.key) ?? [];
              const advisorQuestion = questions.join("\n\n");
              const behaviors = await getActiveBehaviors(user.id, projectId, coach.key);
              const behaviorCtx = formatBehaviorDirectives(behaviors);
              const advisorContext = [...contextParts, behaviorCtx].filter(Boolean).join("\n\n");
              const advisorMessage = `${advisorContext}\n\n[EA Dispatch — Targeted Question]\n${advisorQuestion}\n\n[Original User Request for Context]\n${message}`;

              let advisorResponse = "";
              try {
                const sessionId = await getOrCreateSession(convId!, coach, anthropicKey);
                for await (const event of streamCoachResponse(sessionId, advisorMessage, coach.key, anthropicKey)) {
                  switch (event.type) {
                    case "text":
                      advisorResponse += event.content;
                      send({ type: "text", content: event.content, coachKey: coach.key });
                      break;
                    case "tool_use":
                      send({ type: "tool_use", tool: event.content, coachKey: coach.key });
                      activityProvider.add(user.id, convId!, coach.key, "tool_use", { tool: event.content, input: event.toolInput }, orgId);
                      break;
                    case "tool_result":
                      send({ type: "tool_result", content: event.content, coachKey: coach.key, toolName: event.toolName });
                      break;
                    case "thinking":
                      send({ type: "thinking", coachKey: coach.key });
                      break;
                    case "usage":
                      send({ type: "usage", coachKey: coach.key, usage: event.usage });
                      activityProvider.add(user.id, convId!, coach.key, "usage", event.usage as Record<string, unknown>, orgId);
                      break;
                    case "error":
                      send({ type: "error", content: event.content, coachKey: coach.key });
                      break;
                  }
                }
              } catch (err) {
                send({ type: "error", content: String(err), coachKey: coach.key });
              }

              if (advisorResponse) {
                await addMessage(convId!, "assistant", advisorResponse, coach.key, activeMode);
                advisorResponses.set(coach.key, advisorResponse);
                coachResponses.set(coach.key, advisorResponse);
              }
              send({ type: "coach_done", coachKey: coach.key });
            });

            await Promise.all(advisorPromises);

            // Phase 3: EA synthesis with advisor responses
            if (advisorResponses.size > 0) {
              send({ type: "ea_synthesis_start", coachKey: "ea" });

              const advisorSummary = dispatchedCoaches
                .map((c) => {
                  const resp = advisorResponses.get(c.key);
                  return resp ? `## ${c.name}\n\n${resp}` : null;
                })
                .filter(Boolean)
                .join("\n\n---\n\n");

              const synthesisQuestion = `The user's request was: "${message}"\n\nYou dispatched advisors and received their responses:\n\n${advisorSummary}\n\nNow synthesize these into a clear, unified response for the user. Highlight agreements, surface tensions and tradeoffs, and give concrete next steps. Reference advisors by name when drawing on their input.`;

              let eaSynthesis = "";
              try {
                const sessionId = await getOrCreateSession(convId!, eaCoach, anthropicKey);
                for await (const event of streamCoachResponse(sessionId, synthesisQuestion, eaCoach.key, anthropicKey)) {
                  switch (event.type) {
                    case "text":
                      eaSynthesis += event.content;
                      send({ type: "synthesis_text", content: event.content, streaming: true });
                      break;
                    case "usage":
                      send({ type: "usage", coachKey: "ea", usage: event.usage });
                      break;
                    case "error":
                      send({ type: "error", content: event.content, coachKey: "ea" });
                      break;
                  }
                }
              } catch (err) {
                send({ type: "error", content: `EA synthesis failed: ${err}` });
              }

              if (eaSynthesis) {
                await addMessage(convId!, "assistant", eaSynthesis, "ea-synthesis", activeMode);
                coachResponses.set("ea-synthesis", eaSynthesis);
              }
              send({ type: "ea_synthesis_done" });
            }
          }
        }

        // Save EA planning response (strip block syntax before persisting)
        if (eaPlanningResponse) {
          const cleanResponse = stripEaBlocks(eaPlanningResponse);
          if (cleanResponse) {
            await addMessage(convId!, "assistant", eaPlanningResponse, "ea", activeMode);
            coachResponses.set("ea", eaPlanningResponse);
          }
        }

        send({ type: "coach_done", coachKey: "ea" });

      } else {
        // ── STANDARD ADVISOR PATH ─────────────────────────────────────────────
        const coachPromises = coaches.map(async (coach) => {
          const behaviors = await getActiveBehaviors(user.id, projectId, coach.key);
          const behaviorContext = formatBehaviorDirectives(behaviors);

          const fullContext = [...contextParts];
          if (behaviorContext) fullContext.push(behaviorContext);

          const contextualMessage = fullContext.join("\n\n") + `\n\n${message}`;

          let fullResponse = "";
          try {
            const sessionId = await getOrCreateSession(convId!, coach, anthropicKey);

            for await (const event of streamCoachResponse(sessionId, contextualMessage, coach.key, anthropicKey)) {
              switch (event.type) {
                case "text":
                  fullResponse += event.content;
                  send({ type: "text", content: event.content, coachKey: coach.key });
                  break;
                case "tool_use":
                  send({ type: "tool_use", tool: event.content, coachKey: coach.key });
                  activityProvider.add(user.id, convId!, coach.key, "tool_use", { tool: event.content, input: event.toolInput }, orgId);
                  break;
                case "tool_result":
                  send({ type: "tool_result", content: event.content, coachKey: coach.key, toolName: event.toolName });
                  activityProvider.add(user.id, convId!, coach.key, "tool_result", { tool: event.toolName, result: event.content }, orgId);
                  break;
                case "thinking":
                  send({ type: "thinking", coachKey: coach.key });
                  break;
                case "usage":
                  send({ type: "usage", coachKey: coach.key, usage: event.usage });
                  activityProvider.add(user.id, convId!, coach.key, "usage", event.usage as Record<string, unknown>, orgId);
                  break;
                case "context_compacted":
                  send({ type: "context_compacted", coachKey: coach.key });
                  activityProvider.add(user.id, convId!, coach.key, "context_compacted", {}, orgId);
                  break;
                case "error":
                  send({ type: "error", content: event.content, coachKey: coach.key });
                  break;
                case "done":
                  break;
              }
            }
          } catch (err) {
            send({ type: "error", content: String(err), coachKey: coach.key });
          }

          if (fullResponse) {
            await addMessage(convId!, "assistant", fullResponse, coach.key, activeMode);
            coachResponses.set(coach.key, fullResponse);
          }

          send({ type: "coach_done", coachKey: coach.key });
        });

        await Promise.all(coachPromises);

        let finalSynthesisText: string | null = null;

        if (synthesize && coaches.length > 1 && coachResponses.size > 1) {
          const leadCoach = coaches.find((c) => c.key === leadKey) || coaches[0];
          send({ type: "synthesis_start", leadKey: leadCoach.key, leadName: leadCoach.name });

          try {
            const client = new Anthropic({ apiKey: anthropicKey });

            const coachResponseText = coaches
              .map((c) => {
                const resp = coachResponses.get(c.key);
                return resp ? `## ${c.name}\n\n${resp}` : null;
              })
              .filter(Boolean)
              .join("\n\n---\n\n");

            const modeGuidance = activeMode === "plan"
              ? "Structure the synthesis as a unified action plan with clear ownership and timeline."
              : activeMode === "execute"
                ? "Focus on what was decided and what actions were taken or need to be taken."
                : activeMode === "assist"
                  ? "Combine the drafted artifacts and flag all decision points clearly."
                  : activeMode === "coach"
                    ? "Synthesize the key questions and frameworks from each advisor."
                    : "Provide a unified recommendation with clear rationale.";

            const synthStream = await client.messages.stream({
              model: "claude-sonnet-4-6",
              max_tokens: 3000,
              system:
                `You are the ${leadCoach.name}, acting as the lead synthesizer for this advisory team. ` +
                `You've received perspectives from ${coaches.length} advisors. ` +
                `Operating in ${activeMode.toUpperCase()} mode. ${modeGuidance} ` +
                "Highlight where advisors agree, flag any tensions or tradeoffs, and give a clear " +
                "unified response. Speak in first person as the lead, referencing other advisors " +
                "by name when citing their input. Be direct and concise.",
              messages: [
                {
                  role: "user",
                  content: `The user asked: "${message}"\n\nHere are the responses from the advisory team:\n\n${coachResponseText}\n\nAs ${leadCoach.name}, provide a synthesized response.`,
                },
              ],
            });

            let synthesisText = "";

            for await (const event of synthStream) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                synthesisText += event.delta.text;
                send({ type: "synthesis_text", content: event.delta.text, streaming: true });
              }
            }

            if (synthesisText) {
              await addMessage(convId!, "assistant", synthesisText, "synthesis", activeMode);
              finalSynthesisText = synthesisText;
            }
          } catch (err) {
            send({ type: "error", content: `Synthesis failed: ${err}` });
          }

          send({ type: "synthesis_done" });
        }
      } // end standard advisor path

      // ── POST-RESPONSE PROCESSING (both paths) ───────────────────────────────
      if (coachResponses.size > 0) {
        try {
          send({ type: "extraction_start" });

          const extractionResult = await extractFromConversation(
            message,
            coachResponses,
            null,
            user.id,
            projectId,
            convId!,
            orgId
          );

          send({
            type: "extraction_done",
            facts: extractionResult.facts,
            knowledge: extractionResult.knowledge,
          });
        } catch {
          send({ type: "extraction_done", facts: [], knowledge: [] });
        }

        if (!isEaOrchestration) {
          try {
            const reviewResult = await detectReviewNeed(message, coachResponses, activeMode);
            if (reviewResult.shouldSuggest) {
              send({
                type: "review_suggestion",
                reason: reviewResult.reason,
                domain: reviewResult.domain,
                urgency: reviewResult.urgency,
              });
            }
          } catch {
            // review detection is non-critical
          }
        }

        try {
          for (const [coachKey, responseText] of coachResponses) {
            const tasks = parseTaskBlocks(responseText);
            for (const task of tasks) {
              const { createAgentTask } = await import("@/lib/db");
              const agentTask = await createAgentTask({
                orgId,
                userId: user.id,
                projectId,
                conversationId: convId!,
                taskType: task.type,
                coachKey,
                triggerAt: task.triggerAt,
                repeatInterval: task.repeatInterval || null,
                context: {
                  title: task.title,
                  originalMessage: message,
                  ...(task.contextKey ? { contextKey: task.contextKey } : {}),
                },
              });
              send({
                type: "task_created",
                taskId: agentTask.id,
                title: task.title,
                triggerDescription: task.triggerDescription,
              });
            }
          }
        } catch {
          // task creation is non-critical
        }
      }

      send({ type: "done", conversationId: convId });
      controller.close();
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
