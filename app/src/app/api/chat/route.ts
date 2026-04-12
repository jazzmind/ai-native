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
} from "@/lib/db";
import { getActivityProvider } from "@/lib/activity";
import { getProfileProvider, formatProfileForPrompt } from "@/lib/profile";
import { getKnowledgeProvider } from "@/lib/knowledge";
import { extractFromConversation } from "@/lib/auto-extract";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { getCoachByKey } from "@/lib/coaches-server";
import type { CoachConfig } from "@/lib/coaches";
import { type AgentMode, isValidMode } from "@/lib/modes";
import { loadModeTemplate } from "@/lib/modes-server";

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
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const body = await req.json();
  const { message, conversationId, coachKeys, projectId, mode: requestedMode } = body as {
    message: string;
    conversationId?: string;
    coachKeys?: string[];
    projectId: string;
    mode?: string;
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
  if (!convId || !getConversation(convId, user.id)) {
    convId = uuidv4();
    const title = message.slice(0, 80) + (message.length > 80 ? "..." : "");
    createConversation(convId, title, user.id, projectId);
  }

  addMessage(convId, "user", message, null, explicitMode || null);

  let coaches: CoachConfig[];
  let synthesize = false;
  let routingInfo = "";
  let leadKey: string | undefined;
  let activeMode: AgentMode;

  if (coachKeys && coachKeys.length > 0) {
    const resolved = coachKeys
      .map((k) => getCoachByKey(k))
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

  const modeTemplate = loadModeTemplate(activeMode);
  const expertComments = getExpertComments(convId);

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

      // Search knowledge base for relevant context
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

      // Build contextual message with mode + behaviors + profile + knowledge + expert feedback
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

      const activityProvider = getActivityProvider();

      const coachResponses = new Map<string, string>();

      const coachPromises = coaches.map(async (coach) => {
        // Load per-coach behavioral directives
        const behaviors = getActiveBehaviors(user.id, projectId, coach.key);
        const behaviorContext = formatBehaviorDirectives(behaviors);

        const fullContext = [...contextParts];
        if (behaviorContext) fullContext.push(behaviorContext);

        const contextualMessage = fullContext.join("\n\n") + `\n\n${message}`;

        let fullResponse = "";
        try {
          const sessionId = await getOrCreateSession(convId!, coach);

          for await (const event of streamCoachResponse(sessionId, contextualMessage, coach.key)) {
            switch (event.type) {
              case "text":
                fullResponse += event.content;
                send({ type: "text", content: event.content, coachKey: coach.key });
                break;
              case "tool_use":
                send({ type: "tool_use", tool: event.content, coachKey: coach.key });
                activityProvider.add(user.id, convId!, coach.key, "tool_use", { tool: event.content, input: event.toolInput });
                break;
              case "tool_result":
                send({ type: "tool_result", content: event.content, coachKey: coach.key, toolName: event.toolName });
                activityProvider.add(user.id, convId!, coach.key, "tool_result", { tool: event.toolName, result: event.content });
                break;
              case "thinking":
                send({ type: "thinking", coachKey: coach.key });
                break;
              case "usage":
                send({ type: "usage", coachKey: coach.key, usage: event.usage });
                activityProvider.add(user.id, convId!, coach.key, "usage", event.usage as Record<string, unknown>);
                break;
              case "context_compacted":
                send({ type: "context_compacted", coachKey: coach.key });
                activityProvider.add(user.id, convId!, coach.key, "context_compacted", {});
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
          addMessage(convId!, "assistant", fullResponse, coach.key, activeMode);
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
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
            addMessage(convId!, "assistant", synthesisText, "synthesis", activeMode);
            finalSynthesisText = synthesisText;
          }
        } catch (err) {
          send({ type: "error", content: `Synthesis failed: ${err}` });
        }

        send({ type: "synthesis_done" });
      }

      // Auto-extract profile facts and knowledge from the conversation
      if (coachResponses.size > 0) {
        try {
          send({ type: "extraction_start" });

          const extractionResult = await extractFromConversation(
            message,
            coachResponses,
            finalSynthesisText,
            user.id,
            projectId,
            convId!
          );

          send({
            type: "extraction_done",
            facts: extractionResult.facts,
            knowledge: extractionResult.knowledge,
          });
        } catch {
          send({ type: "extraction_done", facts: [], knowledge: [] });
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
