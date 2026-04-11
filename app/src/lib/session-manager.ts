import Anthropic from "@anthropic-ai/sdk";
import { getEnvironmentId } from "./coaches-server";
import type { CoachConfig } from "./coaches";
import { getCoachSession, setCoachSession } from "./db";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function getOrCreateSession(
  conversationId: string,
  coach: CoachConfig
): Promise<string> {
  const existing = getCoachSession(conversationId, coach.key);
  if (existing) {
    return existing;
  }

  const client = getClient();
  const session = await client.beta.sessions.create({
    agent: coach.agentId,
    environment_id: getEnvironmentId(),
  });

  setCoachSession(conversationId, coach.key, session.id);
  return session.id;
}

export interface StreamEvent {
  type: "text" | "tool_use" | "error" | "done";
  content: string;
  coachKey: string;
}

export async function* streamCoachResponse(
  sessionId: string,
  message: string,
  coachKey: string
): AsyncGenerator<StreamEvent> {
  const client = getClient();

  const stream = await (client.beta.sessions.events as any).stream(sessionId);

  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.message" as const,
        content: [{ type: "text" as const, text: message }],
      },
    ],
  });

  try {
    for await (const event of stream) {
      switch (event.type) {
        case "agent.message":
          for (const block of event.content || []) {
            if (block.type === "text") {
              yield { type: "text", content: block.text, coachKey };
            }
          }
          break;
        case "agent.tool_use":
          yield {
            type: "tool_use",
            content: event.name || "unknown tool",
            coachKey,
          };
          break;
        case "session.status_idle":
          yield { type: "done", content: "", coachKey };
          return;
        case "session.error":
          yield {
            type: "error",
            content: event.error?.message || "Unknown error",
            coachKey,
          };
          return;
      }
    }
  } finally {
    if (typeof stream.close === "function") {
      stream.close();
    }
  }
}
