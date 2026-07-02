import Anthropic from "@anthropic-ai/sdk";
import { getEnvironmentId } from "./coaches-server";
import type { CoachConfig } from "./coaches";
import { getCoachSession, setCoachSession } from "./db";

function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

export async function getOrCreateSession(
  conversationId: string,
  coach: CoachConfig,
  apiKey: string,
  userId: string
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

  const client = makeClient(apiKey);
  const session = await client.beta.sessions.create({
    agent: coach.agentId,
    environment_id: await getEnvironmentId(userId),
  });

  await setCoachSession(conversationId, coach.key, session.id);
  return session.id;
}

export function makeAnthropicClient(apiKey: string): Anthropic {
  return makeClient(apiKey);
}

export interface StreamEvent {
  type:
    | "text"
    | "tool_use"
    | "tool_result"
    | "thinking"
    | "usage"
    | "context_compacted"
    | "error"
    | "done"
    /** Coordinator-specific events */
    | "thread_created"
    | "thread_message"
    | "thread_tool_use"
    | "thread_done"
    /** Outcome/rubric iteration events */
    | "outcome_start"
    | "outcome_iteration"
    | "outcome_pass"
    | "outcome_fail"
    /** ask_user tool: agent wants to pause and ask the human a question */
    | "ask_user_question";
  content: string;
  coachKey: string;
  toolName?: string;
  toolUseId?: string;
  toolInput?: Record<string, unknown>;
  /** For ask_user_question events */
  question?: string;
  options?: string[];
  usage?: { input_tokens: number; output_tokens: number; cache_read?: number; cache_creation?: number };
  /** For thread_* events: which sub-agent thread this came from */
  threadId?: string;
  threadAgentId?: string;
  /** For outcome events */
  iteration?: number;
  score?: number;
  passed?: boolean;
  feedback?: string;
}

// NOTE: CMA sessions API emits `agent.message` events with complete text blocks,
// not token-by-token `content_block_delta` events. Individual advisor responses
// arrive as complete messages. Only the synthesis step (using client.messages.stream
// directly) supports token-level streaming. This is a platform limitation.

export async function* streamCoachResponse(
  sessionId: string,
  message: string,
  coachKey: string,
  apiKey: string
): AsyncGenerator<StreamEvent> {
  const client = makeClient(apiKey);

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
          if (event.name === "ask_user") {
            // Pause the session — yield a question event and return.
            // The caller must send a tool_result back via resumeWithToolResult.
            const input = (event.input || {}) as Record<string, unknown>;
            yield {
              type: "ask_user_question",
              content: String(input.question ?? ""),
              coachKey,
              toolName: "ask_user",
              toolUseId: event.tool_use_id ?? event.id,
              question: String(input.question ?? ""),
              options: Array.isArray(input.options) ? (input.options as string[]) : undefined,
            };
            return;
          }
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

        // ── Coordinator multi-agent thread events ──────────────────────────────

        case "session.thread_created": {
          const threadId = (event as any).thread_id || (event as any).id;
          const agentId = (event as any).agent_id;
          yield {
            type: "thread_created",
            content: `Delegating to ${agentId ?? "sub-agent"}…`,
            coachKey,
            threadId,
            threadAgentId: agentId,
          };
          break;
        }

        case "agent.thread_message_received": {
          const threadId = (event as any).thread_id;
          for (const block of (event as any).content || []) {
            if (block.type === "text") {
              yield {
                type: "thread_message",
                content: block.text,
                coachKey,
                threadId,
              };
            }
          }
          break;
        }

        case "agent.thread_message_sent": {
          const threadId = (event as any).thread_id;
          for (const block of (event as any).content || []) {
            if (block.type === "text") {
              yield {
                type: "thread_message",
                content: block.text,
                coachKey,
                threadId,
              };
            }
          }
          break;
        }

        case "session.thread_status_idle":
        case "session.thread_status_terminated": {
          const threadId = (event as any).thread_id;
          yield {
            type: "thread_done",
            content: event.type === "session.thread_status_terminated" ? "Thread terminated" : "",
            coachKey,
            threadId,
          };
          break;
        }

        // ── Outcome / rubric iteration events ─────────────────────────────────

        case "span.outcome_evaluation_start": {
          const iteration = (event as any).iteration ?? 1;
          yield { type: "outcome_start", content: `Evaluating (iteration ${iteration})…`, coachKey, iteration };
          break;
        }

        case "span.outcome_evaluation_end": {
          const ev = event as any;
          const iteration = ev.iteration ?? 1;
          const passed: boolean = ev.passed ?? ev.result?.passed ?? false;
          const score: number | undefined = ev.score ?? ev.result?.score;
          const feedback: string | undefined = ev.feedback ?? ev.result?.feedback;
          yield {
            type: passed ? "outcome_pass" : "outcome_iteration",
            content: passed ? `Quality check passed (score: ${score ?? "n/a"})` : `Revising… (score: ${score ?? "n/a"})`,
            coachKey,
            iteration,
            score,
            passed,
            feedback,
          };
          if (passed) return;
          break;
        }

        case "span.outcome_evaluation_failed": {
          const ev = event as any;
          yield {
            type: "outcome_fail",
            content: ev.reason || "Outcome evaluation failed",
            coachKey,
          };
          return;
        }

        // ─────────────────────────────────────────────────────────────────────

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

/**
 * Resume a paused session by sending an ask_user tool result, then stream
 * the agent's continued response.
 *
 * Call this when the user has answered an ask_user_question: provide the
 * tool_use_id from that event and the user's answer string.
 */
export async function* resumeWithToolResult(
  sessionId: string,
  toolUseId: string,
  answer: string,
  coachKey: string,
  apiKey: string
): AsyncGenerator<StreamEvent> {
  const client = makeClient(apiKey);

  const stream = await (client.beta.sessions.events as any).stream(sessionId);

  // Send the tool result to satisfy the paused ask_user call
  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.tool_result" as const,
        tool_use_id: toolUseId,
        content: [{ type: "text" as const, text: answer }],
      } as any,
    ],
  });

  // Reuse the same event processing as streamCoachResponse
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
          if (event.name === "ask_user") {
            const input = (event.input || {}) as Record<string, unknown>;
            yield {
              type: "ask_user_question",
              content: String(input.question ?? ""),
              coachKey,
              toolName: "ask_user",
              toolUseId: event.tool_use_id ?? event.id,
              question: String(input.question ?? ""),
              options: Array.isArray(input.options) ? (input.options as string[]) : undefined,
            };
            return;
          }
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

        case "session.thread_created": {
          const threadId = (event as any).thread_id || (event as any).id;
          const agentId = (event as any).agent_id;
          yield { type: "thread_created", content: `Delegating to ${agentId ?? "sub-agent"}…`, coachKey, threadId, threadAgentId: agentId };
          break;
        }

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
          yield { type: "error", content: event.error?.message || "Unknown error", coachKey };
          return;

        case "session.status_terminated":
          yield { type: "error", content: "Session terminated unexpectedly", coachKey };
          return;
      }
    }
  } finally {
    if (typeof stream.close === "function") {
      stream.close();
    }
  }
}
