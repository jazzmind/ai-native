/**
 * AgentProvider — Busibox implementation.
 *
 * Uses BusiboxAIAdapter (from @jazzmind/busibox-app/platform/busibox) for
 * routing, streaming, and synthesis instead of hand-rolled fetches to the
 * agent-api. Also folds in the advisor-definition sync helpers that used to
 * live in lib/sync.ts (Busibox-specific — not part of the core AgentProvider
 * interface, so they're extra methods on this class).
 */

import { z } from "zod";
import { BusiboxAIAdapter } from "@jazzmind/busibox-app/platform/busibox";
import { syncAgentDefinitions, getAgentSyncStatus } from "@jazzmind/busibox-app/lib/agent/sync";
import type { AgentSyncResult, SyncStatus } from "@jazzmind/busibox-app/lib/agent";
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
import { COACH_META, isValidMode } from "@ai-native/core";
import { buildAdvisorDefinitions } from "../advisors";

// Module-level (not per-instance) so "sync once per process" semantics match
// the previous lib/sync.ts behavior regardless of how many provider
// instances get constructed per request.
let syncedOnce = false;

const ROUTING_RESPONSE_SCHEMA = z.object({
  coaches: z.array(z.string()).max(4).describe("Advisor keys to engage (1-4)"),
  lead: z.string().describe("Key of the lead advisor who will synthesize"),
  mode: z.enum(["advise", "coach", "plan", "assist", "execute"]),
  synthesize: z.boolean().describe("True when 2+ advisors are selected"),
  reasoning: z.string().describe("Brief internal reasoning (1-2 sentences)"),
});

interface SyncDocumentIds {
  conversations: string;
  messages: string;
  eaMemory: string;
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

export class BusiboxAgentProvider implements AgentProvider {
  readonly type = "busibox-agent-api";

  private readonly agentApiUrl: string;
  private readonly ai: BusiboxAIAdapter;

  constructor(private readonly token: string, agentApiUrl?: string) {
    this.agentApiUrl = agentApiUrl || process.env.AGENT_API_URL || "http://localhost:8000";
    this.ai = new BusiboxAIAdapter({ agentApiUrl: this.agentApiUrl, getToken: async () => this.token });
  }

  async routeMessage(input: RoutingInput): Promise<RoutingDecision> {
    if (input.explicitCoachKeys && input.explicitCoachKeys.length > 0) {
      const coaches = input.explicitCoachKeys
        .map((k) => COACH_META.find((c) => c.key === k))
        .filter(Boolean) as typeof COACH_META;
      return {
        coaches,
        lead: input.explicitCoachKeys[0],
        mode: input.explicitMode ?? "advise",
        synthesize: coaches.length > 1,
        reasoning: "Explicit advisor selection by user.",
      };
    }

    const historyText =
      input.conversationHistory
        ?.slice(-4)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n") ?? "";

    const prompt = [
      historyText ? `Recent conversation:\n${historyText}\n\n` : "",
      `User message: ${input.message}`,
      input.explicitMode ? `\nRequested mode: ${input.explicitMode}` : "",
      input.projectContext ? `\nProject context: ${input.projectContext}` : "",
    ]
      .filter(Boolean)
      .join("");

    const output = await this.ai.invoke({
      agent: "router",
      input: { prompt },
      responseSchema: ROUTING_RESPONSE_SCHEMA,
    });

    const coaches = output.coaches
      .map((k) => COACH_META.find((c) => c.key === k))
      .filter(Boolean) as typeof COACH_META;

    return {
      coaches: coaches.length > 0 ? coaches : [COACH_META.find((c) => c.key === "strategy")!],
      lead: output.lead,
      mode: isValidMode(output.mode) ? output.mode : "advise",
      synthesize: output.synthesize,
      reasoning: output.reasoning,
    };
  }

  async *streamResponse(
    ctx: AgentSessionContext,
    message: string,
    systemContext: string,
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const stream = await this.ai.streamChat({
      messages: [{ role: "user", content: message }],
      agent: ctx.coachKey,
      systemPrompt: systemContext || undefined,
    });

    const reader = stream.getReader();
    let fullText = "";
    try {
      while (true) {
        if (signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        switch (value.type) {
          case "text-delta": {
            const text = value.content ?? "";
            if (text) {
              fullText += text;
              yield { type: "text", coachKey: ctx.coachKey, text };
            }
            break;
          }
          case "tool-call": {
            if (value.toolCall) {
              yield {
                type: "tool_use",
                coachKey: ctx.coachKey,
                toolName: value.toolCall.name,
                toolInput: value.toolCall.args,
                requiresConfirmation: false,
              };
            }
            break;
          }
          case "tool-result": {
            if (value.toolResult) {
              const output =
                typeof value.toolResult.result === "string"
                  ? value.toolResult.result
                  : JSON.stringify(value.toolResult.result);
              yield { type: "tool_result", coachKey: ctx.coachKey, toolName: "", output };
            }
            break;
          }
          case "error": {
            yield { type: "error", coachKey: ctx.coachKey, message: value.error ?? "Unknown agent error" };
            // Mirror the previous behavior of the hand-rolled fetch: bail out
            // immediately on a connection/agent-level error rather than
            // continuing to emit further events (e.g. coach_done upstream).
            return;
          }
          case "done": {
            if (value.usage) {
              yield {
                type: "usage",
                coachKey: ctx.coachKey,
                inputTokens: value.usage.inputTokens,
                outputTokens: value.usage.outputTokens,
              };
            }
            break;
          }
          default:
            break;
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done", coachKey: ctx.coachKey, fullText };
  }

  async *synthesize(
    coachResponses: Array<{ coachKey: string; coachName: string; response: string }>,
    userMessage: string,
    mode: AgentMode,
    signal?: AbortSignal,
  ): AsyncIterable<StreamEventText | StreamEventDone | StreamEventError> {
    const leadKey = coachResponses[0]?.coachKey ?? "strategy";

    const responseContext = coachResponses
      .map((c) => `## ${c.coachName}\n${c.response}`)
      .join("\n\n---\n\n");

    const synthesisPrompt = `You have received responses from ${coachResponses.length} advisors to this question: "${userMessage}"

${responseContext}

Synthesize these responses into a unified answer that:
1. Highlights where advisors agree (with high confidence)
2. Surfaces tensions or disagreements (and explains them)
3. Gives the user a clear, actionable path forward
4. Cites advisors by name when drawing on their specific expertise
5. Uses the ${mode} mode: ${getSynthesisModeInstruction(mode)}`;

    const stream = await this.ai.streamChat({
      messages: [{ role: "user", content: synthesisPrompt }],
      agent: leadKey,
    });

    const reader = stream.getReader();
    let fullText = "";
    try {
      while (true) {
        if (signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        if (value.type === "text-delta" && value.content) {
          fullText += value.content;
          yield { type: "text", coachKey: leadKey, text: value.content };
        } else if (value.type === "error") {
          yield { type: "error", coachKey: leadKey, message: value.error ?? "Synthesis unavailable" };
          return;
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done", coachKey: leadKey, fullText };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.agentApiUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Advisor definition sync (Busibox-specific; not part of AgentProvider) ──

  async syncAdvisors(documentIds: SyncDocumentIds): Promise<AgentSyncResult> {
    const definitions = buildAdvisorDefinitions(documentIds);
    return syncAgentDefinitions(this.token, definitions, this.agentApiUrl);
  }

  async getAdvisorSyncStatus(): Promise<SyncStatus> {
    const definitions = buildAdvisorDefinitions({ conversations: "", messages: "", eaMemory: "" });
    return getAgentSyncStatus(this.token, definitions, this.agentApiUrl);
  }

  async syncAdvisorsOnce(documentIds: SyncDocumentIds): Promise<void> {
    if (syncedOnce) return;
    syncedOnce = true;
    try {
      await this.syncAdvisors(documentIds);
    } catch (err) {
      console.error("[SYNC] Failed to sync advisors:", err);
      syncedOnce = false; // allow retry
    }
  }
}
