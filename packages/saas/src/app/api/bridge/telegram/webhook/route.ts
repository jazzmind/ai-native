import { NextRequest } from "next/server";
import {
  sendMessage,
  editMessage,
  deleteMessage,
  type TelegramUpdate,
} from "@/lib/bridge/telegram-client";
import { verifyLinkCode } from "@/lib/db/queries/channel-bindings";
import { processBridgeMessage, type StatusCallback } from "@/lib/bridge/processor";

export const runtime = "nodejs";
export const maxDuration = 300;

const LINK_COMMAND = /^\/link\s+([A-Z0-9]{6})\s*$/i;
const START_COMMAND = /^\/start/;

// ── update_id deduplication ───────────────────────────────────────────────────
// Telegram retries webhooks if a 200 isn't received within ~30s. Long-running
// EA coordinator responses (60-90s) cause the same update_id to be delivered
// multiple times. We keep a rolling TTL set to reject duplicates.
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes
interface DedupEntry { ts: number }
const seenUpdateIds = new Map<number, DedupEntry>();

function isDuplicate(updateId: number): boolean {
  const now = Date.now();
  // Prune expired entries
  for (const [id, entry] of seenUpdateIds) {
    if (now - entry.ts > DEDUP_TTL_MS) seenUpdateIds.delete(id);
  }
  if (seenUpdateIds.has(updateId)) return true;
  seenUpdateIds.set(updateId, { ts: now });
  return false;
}
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validate Telegram webhook secret token
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secretToken) {
    const incoming = req.headers.get("x-telegram-bot-api-secret-token");
    if (incoming !== secretToken) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Deduplicate: Telegram retries if we're slow. Return 200 immediately for
  // any update_id we've already started processing.
  if (update.update_id !== undefined && isDuplicate(update.update_id)) {
    return Response.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text) {
    // Ignore non-text updates (voice, stickers, etc.)
    return Response.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();
  const displayName = [message.from?.first_name, message.from?.last_name]
    .filter(Boolean)
    .join(" ") || message.from?.username || "Telegram user";

  // ── /start command ────────────────────────────────────────────────────────
  if (START_COMMAND.test(text)) {
    await sendMessage(
      chatId,
      "👋 Welcome! To connect this chat to your advisor account:\n\n" +
        "1. Go to the app → Settings → Channels\n" +
        "2. Click *Link Telegram* to get a code\n" +
        "3. Send `/link YOUR_CODE` here\n\n" +
        "Once linked, you can chat with your advisors directly from Telegram.",
      { parseMode: "Markdown" }
    );
    return Response.json({ ok: true });
  }

  // ── /link <code> command ──────────────────────────────────────────────────
  const linkMatch = text.match(LINK_COMMAND);
  if (linkMatch) {
    const code = linkMatch[1].toUpperCase();
    try {
      const result = await verifyLinkCode(code, "telegram", chatId, displayName);
      if (!result) {
        await sendMessage(
          chatId,
          "❌ That code is invalid or has expired. Please generate a new one in the app under Settings → Channels.",
          { parseMode: "Markdown" }
        );
      } else {
        await sendMessage(
          chatId,
          "✅ *Linked successfully!* You can now chat with your advisors directly here.\n\nTry sending a message to get started.",
          { parseMode: "Markdown" }
        );
      }
    } catch (err) {
      console.error("[bridge/telegram/webhook] link error:", err);
      await sendMessage(chatId, "Something went wrong while linking. Please try again.");
    }
    return Response.json({ ok: true });
  }

  // ── Regular message → process through advisor system ─────────────────────
  let statusMessageId: number | null = null;

  try {
    // Send an immediate acknowledgement the user can see
    statusMessageId = await sendMessage(chatId, "⏳ Routing your message...");

    // Debounced status updater — at most one Telegram edit per second
    let lastEditAt = 0;
    let pendingStatus: string | null = null;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const flushStatus = async (msg: string) => {
      if (statusMessageId === null) return;
      await editMessage(chatId, statusMessageId, msg);
      lastEditAt = Date.now();
    };

    const onStatus: StatusCallback = (msg: string) => {
      pendingStatus = msg;
      const now = Date.now();
      const msSinceLastEdit = now - lastEditAt;

      if (msSinceLastEdit >= 1000) {
        // Enough time has passed — edit immediately
        if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
        flushStatus(msg).catch(() => {});
      } else {
        // Schedule an edit for when the debounce window expires
        if (pendingTimer) clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => {
          if (pendingStatus) flushStatus(pendingStatus).catch(() => {});
          pendingTimer = null;
          pendingStatus = null;
        }, 1000 - msSinceLastEdit);
      }
    };

    const result = await processBridgeMessage("telegram", chatId, text, onStatus);

    // Cancel any pending debounced edit
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }

    // Remove the status message before sending the real response
    if (statusMessageId !== null) {
      await deleteMessage(chatId, statusMessageId);
      statusMessageId = null;
    }

    if ("error" in result) {
      await sendMessage(chatId, result.error);
    } else {
      // Telegram has a 4096 character limit per message; chunk if needed
      const chunks = chunkText(result.response, 4000);
      for (const chunk of chunks) {
        await sendMessage(chatId, chunk, { parseMode: "Markdown" });
      }
    }
  } catch (err) {
    console.error("[bridge/telegram/webhook] processing error:", err);
    // Clean up status message if still visible
    if (statusMessageId !== null) {
      await deleteMessage(chatId, statusMessageId).catch(() => {});
    }
    await sendMessage(chatId, "Sorry, something went wrong. Please try again in a moment.");
  }

  return Response.json({ ok: true });
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to break at a paragraph boundary
    let splitAt = remaining.lastIndexOf("\n\n", maxLen);
    if (splitAt < maxLen * 0.5) splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}
