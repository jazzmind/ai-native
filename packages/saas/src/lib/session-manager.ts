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
  coach: CoachConfig,
  apiKey?: string
): Promise<string> {
  const existing = await getCoachSession(conversationId, coach.key);
  if (existing) {
    return existing;
  }

  if (!coach.agentId) {
    throw new Error(
      `Agent "${coach.key}" has not been deployed yet. Go to Settings → Deploy Agents to deploy your advisory team.`
    );
  }

  const client = apiKey ? new Anthropic({ apiKey }) : getClient();
  const session = await client.beta.sessions.create({
    agent: coach.agentId,
    environment_id: getEnvironmentId(),
  });

  await setCoachSession(conversationId, coach.key, session.id);
  return session.id;
}

export interface StreamEvent {
  type: "text" | "tool_use" | "tool_result" | "thinking" | "usage" | "context_compacted" | "error" | "done";
  content: string;
  coachKey: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  usage?: { input_tokens: number; output_tokens: number; cache_read?: number; cache_creation?: number };
}

// NOTE: CMA sessions API emits `agent.message` events with complete text blocks,
// not token-by-token `content_block_delta` events. Individual advisor responses
// arrive as complete messages. Only the synthesis step (using client.messages.stream
// directly) supports token-level streaming. This is a platform limitation.

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
            toolName: event.name,
            toolInput: event.input,
          };
          break;

        case "agent.tool_result":
          yield {
            type: "tool_result",
            content: typeof event.content === "string"
              ? event.content.slice(0, 500)
              : JSON.stringify(event.content).slice(0, 500),
            coachKey,
            toolName: event.name,
          };
          break;

        case "agent.mcp_tool_use":
          yield {
            type: "tool_use",
            content: `mcp:${event.name || "unknown"}`,
            coachKey,
            toolName: event.name,
            toolInput: event.input,
          };
          break;

        case "agent.mcp_tool_result":
          yield {
            type: "tool_result",
            content: typeof event.content === "string"
              ? event.content.slice(0, 500)
              : JSON.stringify(event.content).slice(0, 500),
            coachKey,
            toolName: event.name,
          };
          break;

        case "agent.thinking":
          yield { type: "thinking", content: "", coachKey };
          break;

        case "agent.thread_context_compacted":
          yield { type: "context_compacted", content: "Context compacted", coachKey };
          break;

        case "span.model_request_end": {
          const usage = (event as any).usage;
          if (usage) {
            yield {
              type: "usage",
              content: "",
              coachKey,
              usage: {
                input_tokens: usage.input_tokens || 0,
                output_tokens: usage.output_tokens || 0,
                cache_read: usage.cache_read_input_tokens,
                cache_creation: usage.cache_creation_input_tokens,
              },
            };
          }
          break;
        }

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

        case "session.status_terminated":
          yield {
            type: "error",
            content: "Session terminated unexpectedly",
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
