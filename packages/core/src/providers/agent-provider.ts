import type { AgentMode } from '../modes/index';
import type { CoachMeta } from '../coaches/index';

/**
 * AgentProvider abstracts the AI execution backend.
 *
 * SaaS implementation: Anthropic CMA Sessions API + Messages API for routing
 * Busibox implementation: busibox agent-api (/agents, /runs/invoke, /sessions streaming)
 */

// ── Stream Events ──────────────────────────────────────────
// Platform-normalized event shapes emitted by streamResponse()

export interface StreamEventText {
  type: 'text';
  coachKey: string;
  text: string;
}

export interface StreamEventToolUse {
  type: 'tool_use';
  coachKey: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  requiresConfirmation: boolean;
}

export interface StreamEventToolResult {
  type: 'tool_result';
  coachKey: string;
  toolName: string;
  output: string;
}

export interface StreamEventUsage {
  type: 'usage';
  coachKey: string;
  inputTokens: number;
  outputTokens: number;
}

export interface StreamEventDone {
  type: 'done';
  coachKey: string;
  fullText: string;
}

export interface StreamEventError {
  type: 'error';
  coachKey: string;
  message: string;
}

export type StreamEvent =
  | StreamEventText
  | StreamEventToolUse
  | StreamEventToolResult
  | StreamEventUsage
  | StreamEventDone
  | StreamEventError;

// ── Routing ────────────────────────────────────────────────

export interface RoutingDecision {
  coaches: CoachMeta[];
  lead: string;
  mode: AgentMode;
  synthesize: boolean;
  reasoning: string;
}

export interface RoutingInput {
  message: string;
  projectContext?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  explicitCoachKeys?: string[];
  explicitMode?: AgentMode;
}

// ── Agent Session ──────────────────────────────────────────

export interface AgentSessionContext {
  conversationId: string;
  coachKey: string;
  orgId: string;
  userId: string;
  projectId?: string;
}

// ── The Provider Interface ─────────────────────────────────

export interface AgentProvider {
  readonly type: string;

  /**
   * Route an incoming message to one or more advisors.
   * Returns a stable routing decision for the message.
   */
  routeMessage(input: RoutingInput): Promise<RoutingDecision>;

  /**
   * Stream a response from a single advisor.
   * Yields normalized StreamEvent objects.
   * Manages session state internally (create/resume sessions).
   */
  streamResponse(
    ctx: AgentSessionContext,
    message: string,
    systemContext: string,
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent>;

  /**
   * Synthesize multiple advisor responses into a single coherent answer.
   * Used after parallel advisor turns.
   */
  synthesize(
    coachResponses: Array<{ coachKey: string; coachName: string; response: string }>,
    userMessage: string,
    mode: AgentMode,
    signal?: AbortSignal,
  ): AsyncIterable<StreamEventText | StreamEventDone | StreamEventError>;

  /**
   * Return true if the backend is reachable and agent definitions are deployed.
   */
  isAvailable(): Promise<boolean>;
}
