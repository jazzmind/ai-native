import type {
  AgentMode,
  AgentProvider,
  AgentSessionContext,
  RoutingDecision,
  RoutingInput,
  StreamEvent,
  StreamEventDone,
  StreamEventError,
  StreamEventText,
} from "@ai-native/core";
import { routeMessage as localRouteMessage } from "@/lib/router";
import { getOrCreateSession, streamCoachResponse, makeAnthropicClient } from "@/lib/session-manager";
import { getCoachByKey } from "@/lib/coaches-server";

function getModeGuidance(mode: AgentMode): string {
  switch (mode) {
    case "plan":
      return "Structure the synthesis as a unified action plan with clear ownership and timeline.";
    case "execute":
      return "Focus on what was decided and what actions were taken or need to be taken.";
    case "assist":
      return "Combine the drafted artifacts and flag all decision points clearly.";
    case "coach":
      return "Synthesize the key questions and frameworks from each advisor.";
    default:
      return "Provide a unified recommendation with clear rationale.";
  }
}

/**
 * SaasAgentProvider wraps the CMA Sessions API glue (lib/session-manager.ts)
 * and the LLM router (lib/router.ts) to implement the shared AgentProvider
 * contract.
 *
 * Unlike the stateless singleton pattern used by the Knowledge/Activity/
 * Profile providers, an instance is scoped to one request's resolved
 * Anthropic API key and authenticated userId — both are needed by
 * lib/router.ts and lib/session-manager.ts but aren't part of the
 * per-call method signatures on AgentProvider (routeMessage's RoutingInput
 * has no userId; streamResponse's method signature has no apiKey).
 */
export class SaasAgentProvider implements AgentProvider {
  readonly type = "saas";

  constructor(
    private readonly apiKey: string,
    private readonly userId: string
  ) {}

  async routeMessage(input: RoutingInput): Promise<RoutingDecision> {
    // lib/router.ts's routeMessage() doesn't use projectContext,
    // conversationHistory, or explicitCoachKeys today — routing is driven
    // purely by the message text, an @mention, and the userId's deployed
    // coach set.
    const decision = await localRouteMessage(input.message, this.userId, input.explicitMode);
    return {
      coaches: decision.coaches,
      lead: decision.lead,
      mode: decision.mode,
      synthesize: decision.synthesize,
      reasoning: decision.reasoning,
    };
  }

  async *streamResponse(
    ctx: AgentSessionContext,
    message: string,
    systemContext: string,
    signal?: AbortSignal
  ): AsyncIterable<StreamEvent> {
    const coach = await getCoachByKey(ctx.coachKey, ctx.userId);
    if (!coach) {
      yield { type: "error", coachKey: ctx.coachKey, message: `Unknown or undeployed coach "${ctx.coachKey}"` };
      return;
    }

    const sessionId = await getOrCreateSession(ctx.conversationId, coach, this.apiKey, ctx.userId);
    const fullMessage = systemContext ? `${systemContext}\n\n${message}` : message;

    let fullText = "";
    for await (const event of streamCoachResponse(sessionId, fullMessage, ctx.coachKey, this.apiKey)) {
      if (signal?.aborted) return;

      switch (event.type) {
        case "text":
          fullText += event.content;
          yield { type: "text", coachKey: ctx.coachKey, text: event.content };
          break;
        case "tool_use":
          yield {
            type: "tool_use",
            coachKey: ctx.coachKey,
            toolName: event.toolName ?? "unknown",
            toolInput: event.toolInput ?? {},
            requiresConfirmation: false,
          };
          break;
        case "tool_result":
          yield {
            type: "tool_result",
            coachKey: ctx.coachKey,
            toolName: event.toolName ?? "",
            output: event.content,
          };
          break;
        case "usage":
          yield {
            type: "usage",
            coachKey: ctx.coachKey,
            inputTokens: event.usage?.input_tokens ?? 0,
            outputTokens: event.usage?.output_tokens ?? 0,
          };
          break;
        case "error":
          yield { type: "error", coachKey: ctx.coachKey, message: event.content };
          return;
        case "done":
          yield { type: "done", coachKey: ctx.coachKey, fullText };
          return;
        // "thinking", "context_compacted", "ask_user_question", and the
        // coordinator thread_*/outcome_* events have no equivalent in the
        // shared StreamEvent union. Callers that need that richer event set
        // (e.g. the chat route's EA orchestration path) use
        // streamCoachResponse()/resumeWithToolResult() from
        // lib/session-manager.ts directly instead of going through this
        // generic streamResponse().
        default:
          break;
      }
    }
  }

  /**
   * Synthesizes multiple advisor responses into one unified answer, in the
   * voice of the first entry in `coachResponses` (callers that have a
   * distinct "lead" advisor should place it first in the array — the shared
   * interface has no separate lead parameter).
   */
  async *synthesize(
    coachResponses: Array<{ coachKey: string; coachName: string; response: string }>,
    userMessage: string,
    mode: AgentMode,
    signal?: AbortSignal
  ): AsyncIterable<StreamEventText | StreamEventDone | StreamEventError> {
    const lead = coachResponses[0];
    const leadName = lead?.coachName ?? "Lead Advisor";

    const coachResponseText = coachResponses
      .map((c) => `## ${c.coachName}\n\n${c.response}`)
      .join("\n\n---\n\n");

    const modeGuidance = getModeGuidance(mode);

    try {
      const client = makeAnthropicClient(this.apiKey);
      const synthStream = await client.messages.stream(
        {
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          system:
            `You are the ${leadName}, acting as the lead synthesizer for this advisory team. ` +
            `You've received perspectives from ${coachResponses.length} advisors. ` +
            `Operating in ${mode.toUpperCase()} mode. ${modeGuidance} ` +
            "Highlight where advisors agree, flag any tensions or tradeoffs, and give a clear " +
            "unified response. Speak in first person as the lead, referencing other advisors " +
            "by name when citing their input. Be direct and concise.",
          messages: [
            {
              role: "user",
              content: `The user asked: "${userMessage}"\n\nHere are the responses from the advisory team:\n\n${coachResponseText}\n\nAs ${leadName}, provide a synthesized response.`,
            },
          ],
        },
        signal ? { signal } : undefined
      );

      let fullText = "";
      for await (const event of synthStream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          yield { type: "text", coachKey: "synthesis", text: event.delta.text };
        }
      }

      yield { type: "done", coachKey: "synthesis", fullText };
    } catch (err) {
      yield { type: "error", coachKey: "synthesis", message: String(err) };
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
