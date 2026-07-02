/**
 * Bridge message processor.
 *
 * Handles inbound messages from external channels (Telegram, etc.) and produces
 * a plain-text response by routing through the advisor system.
 *
 * Shares the same underlying libraries as the HTTP chat route (routeMessage,
 * streamCoachResponse, etc.) but operates outside the SSE streaming context:
 * it collects the full response text and returns it as a string.
 */

import { v4 as uuidv4 } from "uuid";
import { routeMessage } from "@/lib/router";
import { getOrCreateSession, streamCoachResponse } from "@/lib/session-manager";
import {
  addMessage,
  createConversation,
  getConversation,
  getActiveBehaviors,
  listEaMemory,
  formatEaMemoryForPrompt,
  upsertEaMemory,
  getOrCreateDefaultProject,
  getUserOrganization,
} from "@/lib/db";
import { resolveAnthropicKey } from "@/lib/api-key-resolver";
import { getProfileProvider, formatProfileForPrompt } from "@/lib/profile";
import { parseMemoryBlocks, stripEaBlocks } from "@/lib/parse-dispatch";
import {
  lookupBinding,
  setBridgeConversationId,
  getUserBinding,
  type ChannelType,
} from "@/lib/db/queries/channel-bindings";
import { getCurrentTimeContext } from "@/lib/time-context";

// ── Rate limiter ─────────────────────────────────────────────────────────────

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MESSAGES = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(senderKey: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(senderKey);

  if (!entry || entry.resetAt < now) {
    rateLimits.set(senderKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MESSAGES) return false;
  entry.count++;
  return true;
}

// ── Main processor ────────────────────────────────────────────────────────────

export interface BridgeProcessorResult {
  response: string;
  conversationId: string;
}

/**
 * Called during processing with human-readable status strings so the caller
 * can update a live indicator (e.g. an editable Telegram message).
 * Failures are silently ignored — status updates are best-effort.
 */
export type StatusCallback = (status: string) => void | Promise<void>;

/**
 * Processes an inbound text message from an external channel.
 *
 * Returns the advisor's plain-text response, or an error string if the
 * message cannot be processed (unlinked account, agents not deployed, etc.).
 *
 * The optional `onStatus` callback receives human-readable progress strings
 * (routing decision, which advisor is thinking, tool calls, etc.) so the
 * caller can surface live feedback to the user.
 */
export async function processBridgeMessage(
  channelType: ChannelType,
  externalId: string,
  text: string,
  onStatus?: StatusCallback
): Promise<BridgeProcessorResult | { error: string }> {
  async function status(msg: string) {
    if (!onStatus) return;
    try { await onStatus(msg); } catch { /* non-fatal */ }
  }
  // Resolve user from channel binding
  const senderKey = `${channelType}:${externalId}`;

  if (!checkRateLimit(senderKey)) {
    return { error: "Rate limit exceeded. Please wait a minute before sending more messages." };
  }

  const userContext = await lookupBinding(channelType, externalId);
  if (!userContext) {
    return {
      error:
        "Your account is not linked yet. Visit the app at Settings → Channels to get a link code, then send `/link <code>` here.",
    };
  }

  const { userId, orgId } = userContext;

  // Resolve org + plan
  const org = await getUserOrganization(userId);
  if (!org) {
    return { error: "Account error: organization not found." };
  }
  const orgPlan = (org.plan as "free" | "pro" | "team") || "free";

  // Resolve API key
  let anthropicKey: string;
  try {
    anthropicKey = await resolveAnthropicKey(orgId, userId, orgPlan);
  } catch {
    return {
      error:
        "No API key configured. Please add your Anthropic API key in the app under Settings → API Key.",
    };
  }

  // Get default project
  const project = await getOrCreateDefaultProject(userId, orgId);
  const projectId = project.id;

  // Get or create a persistent bridge conversation for this binding
  const binding = await getUserBinding(userId, channelType);
  let convId = binding?.bridgeConversationId ?? null;

  if (convId) {
    // Verify the conversation still exists
    const existing = await getConversation(convId, userId);
    if (!existing) convId = null;
  }

  if (!convId) {
    convId = uuidv4();
    const channelLabel = channelType.charAt(0).toUpperCase() + channelType.slice(1);
    await createConversation(convId, `${channelLabel} Bridge`, userId, projectId, orgId);
    await setBridgeConversationId(userId, channelType, convId);
  }

  // Persist the incoming user message
  await addMessage(convId, "user", text, null, null);

  await status("🔀 Routing your message...");

  // Route the message through the advisor system
  const decision = await routeMessage(text, userId, undefined);
  const { coaches, synthesize: _synthesize, lead: leadKey } = decision;
  const activeMode = decision.mode;

  const isEaOrchestration = coaches.length === 1 && coaches[0].key === "ea";

  if (isEaOrchestration) {
    await status("🤔 Chief of Staff is planning...");
  } else {
    const names = coaches.map((c) => c.name).join(", ");
    await status(`🤔 ${names} is thinking...`);
  }

  // Build context parts
  const profileProvider = getProfileProvider();
  const profileEntries = await profileProvider.list(userId);
  const profileContext = formatProfileForPrompt(profileEntries);

  const contextParts: string[] = [];
  contextParts.push(getCurrentTimeContext());
  if (profileContext) contextParts.push(`[User Profile Context]${profileContext}`);

  let fullResponse = "";

  try {
    if (isEaOrchestration) {
      // ── EA ORCHESTRATION PATH (native coordinator) ──────────────────────────
      const eaCoach = coaches[0];

      let eaMemoryContext = "";
      try {
        const memoryEntries = await listEaMemory(userId, projectId);
        const formatted = formatEaMemoryForPrompt(memoryEntries);
        if (formatted) {
          eaMemoryContext = `\n\n[EA Memory — Your Stored Templates & Context]\n${formatted}`;
        }
      } catch {
        // non-critical
      }

      const eaFullContext = [...contextParts];
      if (eaMemoryContext) eaFullContext.push(eaMemoryContext);
      const eaBehaviors = await getActiveBehaviors(userId, projectId, "ea");
      if (eaBehaviors.length > 0) {
        eaFullContext.push(
          "\n\n[Behavioral Directives]\n" +
            eaBehaviors.map((d) => `- ${d.directive}`).join("\n") + "\n"
        );
      }

      const eaMessage = eaFullContext.join("\n\n") + `\n\n${text}`;

      let eaFullResponse = "";
      const sessionId = await getOrCreateSession(convId, eaCoach, anthropicKey, userId);

      for await (const event of streamCoachResponse(sessionId, eaMessage, eaCoach.key, anthropicKey)) {
        switch (event.type) {
          case "text":
            eaFullResponse += event.content;
            break;
          case "thinking":
            await status("💭 Chief of Staff is thinking...");
            break;
          case "tool_use": {
            const toolLabel = event.content || event.toolName || "tool";
            await status(`🔧 Using ${toolLabel}...`);
            break;
          }
          // Coordinator thread events — surface sub-agent activity as status updates
          case "thread_created":
            await status(`📋 Delegating to specialist...`);
            break;
          case "thread_message":
            // Sub-agent responses arrive here; they're synthesized into the EA's
            // final top-level message. We surface a status update but don't
            // accumulate them separately — the coordinator handles synthesis.
            await status(`📝 Advisor responding...`);
            break;
          case "thread_done":
            await status(`✅ Specialist complete. Synthesizing...`);
            break;
        }
      }

      // Persist EA memory blocks
      const memoryBlocks = parseMemoryBlocks(eaFullResponse);
      for (const block of memoryBlocks) {
        try {
          await upsertEaMemory({
            orgId,
            userId,
            projectId,
            memoryType: block.type,
            key: block.key,
            title: block.title,
            content: block.content,
          });
        } catch (memErr) {
          console.error("[bridge/processor] Failed to persist memory block:", block.key, memErr);
        }
      }

      // Store and return the clean (stripped) response
      const cleanResponse = stripEaBlocks(eaFullResponse);
      if (cleanResponse) {
        await addMessage(convId!, "assistant", cleanResponse, "ea", activeMode);
      }
      fullResponse = cleanResponse || eaFullResponse;
    } else {
      // ── STANDARD ADVISOR PATH ─────────────────────────────────────────────
      const coach = coaches.find((c) => c.key === leadKey) || coaches[0];
      const behaviors = await getActiveBehaviors(userId, projectId, coach.key);
      const behaviorCtx =
        behaviors.length > 0
          ? "\n\n[Behavioral Directives]\n" +
            behaviors.map((d) => `- ${d.directive}`).join("\n") + "\n"
          : "";

      const contextualMessage =
        [...contextParts, behaviorCtx].filter(Boolean).join("\n\n") + `\n\n${text}`;

      const sessionId = await getOrCreateSession(convId!, coach, anthropicKey, userId);
      for await (const event of streamCoachResponse(
        sessionId,
        contextualMessage,
        coach.key,
        anthropicKey
      )) {
        if (event.type === "text") {
          fullResponse += event.content;
        } else if (event.type === "thinking") {
          await status(`💭 ${coach.name} is thinking...`);
        } else if (event.type === "tool_use") {
          const toolLabel = event.content || event.toolName || "tool";
          await status(`🔧 ${coach.name}: using ${toolLabel}...`);
        }
      }

      if (fullResponse) {
        await addMessage(convId!, "assistant", fullResponse, coach.key, activeMode);
      }
    }
  } catch (err) {
    const msg = String(err);
    if (msg.includes("not been deployed")) {
      return {
        error:
          "Your advisors haven't been deployed yet. Go to Settings → Deploy Agents in the app to set them up.",
      };
    }
    console.error("[bridge/processor] error:", err);
    return { error: "Something went wrong processing your message. Please try again." };
  }

  if (!fullResponse) {
    return { error: "No response was generated. Please try again." };
  }

  return { response: fullResponse, conversationId: convId! };
}
