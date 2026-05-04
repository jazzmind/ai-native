/**
 * Advisor router — Busibox implementation.
 *
 * Uses busibox agent-api /runs/invoke with a response_schema to get a
 * structured routing decision without a full agent session.
 * This is functionally equivalent to the SaaS router.ts which calls
 * Anthropic Messages API directly.
 */

import type { RoutingDecision, RoutingInput } from "@ai-native/core";
import { COACH_META, isValidMode } from "@ai-native/core";

const ROUTING_SCHEMA = {
  name: "routing_decision",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["coaches", "lead", "mode", "synthesize", "reasoning"],
    properties: {
      coaches: {
        type: "array",
        maxItems: 4,
        items: { type: "string" },
        description: "Advisor keys to engage (1-4)",
      },
      lead: {
        type: "string",
        description: "Key of the lead advisor who will synthesize",
      },
      mode: {
        type: "string",
        enum: ["advise", "coach", "plan", "assist", "execute"],
        description: "Operating mode for this response",
      },
      synthesize: {
        type: "boolean",
        description: "True when 2+ advisors are selected",
      },
      reasoning: {
        type: "string",
        description: "Brief internal reasoning (1-2 sentences)",
      },
    },
  },
};

export interface RawRoutingDecision {
  coaches: string[];
  lead: string;
  mode: string;
  synthesize: boolean;
  reasoning: string;
}

export async function routeMessage(
  agentApiToken: string,
  input: RoutingInput,
): Promise<RoutingDecision> {
  // Build @mention short-circuit
  if (input.explicitCoachKeys && input.explicitCoachKeys.length > 0) {
    const coaches = input.explicitCoachKeys
      .map((k) => COACH_META.find((c) => c.key === k))
      .filter(Boolean) as typeof COACH_META;
    return {
      coaches,
      lead: input.explicitCoachKeys[0]!,
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

  const agentApiUrl = process.env.AGENT_API_URL || "http://localhost:8000";

  const res = await fetch(`${agentApiUrl}/runs/invoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${agentApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_name: "router",
      input: { prompt },
      response_schema: ROUTING_SCHEMA,
      agent_tier: "simple",
    }),
  });

  if (!res.ok) {
    throw new Error(`Router invoke failed: ${res.status} ${await res.text()}`);
  }

  const { output, error } = (await res.json()) as {
    output?: RawRoutingDecision;
    error?: string;
  };

  if (error || !output) {
    throw new Error(`Router returned error: ${error ?? "no output"}`);
  }

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
