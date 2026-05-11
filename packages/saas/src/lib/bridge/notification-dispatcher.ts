/**
 * Notification dispatcher — pushes notifications to linked external channels.
 *
 * Called after a notification is created in the DB.
 * Currently supports Telegram; designed to be extended to other channels.
 */

import { sendMessage } from "@/lib/bridge/telegram-client";
import { getVerifiedExternalId } from "@/lib/db/queries/channel-bindings";

export interface NotificationPayload {
  userId: string;
  title: string;
  body?: string | null;
  conversationId?: string | null;
}

/**
 * Attempts to push a notification to any linked external channels for a user.
 * Silently ignores failures so in-app notification creation is never blocked.
 */
export async function dispatchNotificationToChannels(
  payload: NotificationPayload
): Promise<void> {
  await dispatchToTelegram(payload);
  // Future: await dispatchToWhatsApp(payload);
  // Future: await dispatchToSignal(payload);
}

async function dispatchToTelegram(payload: NotificationPayload): Promise<void> {
  const telegramEnabled = !!process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramEnabled) return;

  try {
    const chatId = await getVerifiedExternalId(payload.userId, "telegram");
    if (!chatId) return;

    const text = formatNotificationText(payload);
    await sendMessage(chatId, text, { parseMode: "Markdown" });
  } catch (err) {
    // Non-critical — log but don't throw
    console.error("[bridge/notification-dispatcher] Telegram dispatch error:", err);
  }
}

function formatNotificationText(payload: NotificationPayload): string {
  const lines: string[] = [];
  lines.push(`*${escapeMarkdown(payload.title)}*`);
  if (payload.body) {
    lines.push(escapeMarkdown(payload.body));
  }
  return lines.join("\n\n");
}

function escapeMarkdown(text: string): string {
  // Escape special Markdown V1 characters
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, (c) => `\\${c}`);
}
