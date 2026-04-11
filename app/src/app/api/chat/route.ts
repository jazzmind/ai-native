import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { routeMessage } from "@/lib/router";
import { getOrCreateSession, streamCoachResponse } from "@/lib/session-manager";
import {
  addMessage,
  createConversation,
  getConversation,
} from "@/lib/db";
import { getCoachByKey } from "@/lib/coaches-server";
import type { CoachConfig } from "@/lib/coaches";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, conversationId, coachKey } = body as {
    message: string;
    conversationId?: string;
    coachKey?: string;
  };

  if (!message?.trim()) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  let convId = conversationId;
  if (!convId || !getConversation(convId)) {
    convId = uuidv4();
    const title = message.slice(0, 80) + (message.length > 80 ? "..." : "");
    createConversation(convId, title);
  }

  addMessage(convId, "user", message);

  let coaches: CoachConfig[];
  let synthesize = false;
  let routingInfo = "";

  if (coachKey) {
    const coach = getCoachByKey(coachKey);
    if (!coach) {
      return Response.json({ error: `Unknown coach: ${coachKey}` }, { status: 400 });
    }
    coaches = [coach];
    routingInfo = `Direct: ${coach.name}`;
  } else {
    const decision = await routeMessage(message);
    coaches = decision.coaches;
    synthesize = decision.synthesize;
    routingInfo = decision.reasoning;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({
        type: "routing",
        conversationId: convId,
        coaches: coaches.map((c) => ({ key: c.key, name: c.name, icon: c.icon })),
        reasoning: routingInfo,
        synthesize,
      });

      for (const coach of coaches) {
        send({ type: "coach_start", coachKey: coach.key, coachName: coach.name });

        try {
          const sessionId = await getOrCreateSession(convId!, coach);
          let fullResponse = "";

          for await (const event of streamCoachResponse(sessionId, message, coach.key)) {
            switch (event.type) {
              case "text":
                fullResponse += event.content;
                send({ type: "text", content: event.content, coachKey: coach.key });
                break;
              case "tool_use":
                send({ type: "tool_use", tool: event.content, coachKey: coach.key });
                break;
              case "error":
                send({ type: "error", content: event.content, coachKey: coach.key });
                break;
              case "done":
                break;
            }
          }

          if (fullResponse) {
            addMessage(convId!, "assistant", fullResponse, coach.key);
          }
        } catch (err) {
          send({ type: "error", content: String(err), coachKey: coach.key });
        }

        send({ type: "coach_done", coachKey: coach.key });
      }

      if (synthesize && coaches.length > 1) {
        send({ type: "synthesis_start" });

        try {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

          const msgs = (await import("@/lib/db")).getMessages(convId!);
          const coachResponses = coaches
            .map((c) => {
              const resp = msgs
                .filter((m) => m.role === "assistant" && m.coach_key === c.key)
                .pop();
              return resp ? `## ${c.name}\n\n${resp.content}` : null;
            })
            .filter(Boolean)
            .join("\n\n---\n\n");

          if (coachResponses) {
            const synthesis = await client.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 2000,
              system:
                "You are synthesizing responses from multiple business coaches into a coherent, " +
                "actionable summary. Highlight areas of agreement, flag any conflicts, and present " +
                "a unified recommendation. Be concise.",
              messages: [
                {
                  role: "user",
                  content: `The user asked: "${message}"\n\nHere are the responses from different coaches:\n\n${coachResponses}\n\nPlease synthesize these into a unified response.`,
                },
              ],
            });

            const synthesisText =
              synthesis.content[0].type === "text" ? synthesis.content[0].text : "";
            send({ type: "synthesis_text", content: synthesisText });
            addMessage(convId!, "assistant", `**Synthesis:**\n\n${synthesisText}`, "synthesis");
          }
        } catch (err) {
          send({ type: "error", content: `Synthesis failed: ${err}` });
        }

        send({ type: "synthesis_done" });
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
    },
  });
}
