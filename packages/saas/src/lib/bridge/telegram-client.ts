/**
 * Telegram Bot API client for the bridge.
 * Uses TELEGRAM_BOT_TOKEN env var.
 * Webhook-only (no polling) — suitable for serverless/Vercel deployment.
 */

const BASE_URL = "https://api.telegram.org";

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

async function callApi<T = unknown>(method: string, body?: Record<string, unknown>): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json() as { ok: boolean; result: T; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram API error for ${method}: ${data.description || "unknown error"}`);
  }
  return data.result;
}

/**
 * Sends a text message to a Telegram chat.
 * Tries Markdown first, falls back to plain text on parse error.
 * Returns the message_id of the sent message.
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
  options?: { parseMode?: "Markdown" | "HTML"; replyToMessageId?: number }
): Promise<number> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (options?.parseMode) {
    payload.parse_mode = options.parseMode;
  }
  if (options?.replyToMessageId) {
    payload.reply_to_message_id = options.replyToMessageId;
  }

  try {
    const result = await callApi<{ message_id: number }>("sendMessage", payload);
    return result.message_id;
  } catch (err) {
    // If markdown parsing failed, retry as plain text
    if (options?.parseMode && String(err).includes("parse")) {
      const { parseMode: _pm, ...rest } = payload;
      const result = await callApi<{ message_id: number }>("sendMessage", rest);
      return result.message_id;
    }
    throw err;
  }
}

/**
 * Edits an existing message in-place.
 * Best-effort — silently swallows errors (e.g. message too old to edit, identical text).
 */
export async function editMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  options?: { parseMode?: "Markdown" | "HTML" }
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
  };
  if (options?.parseMode) {
    payload.parse_mode = options.parseMode;
  }
  try {
    await callApi("editMessageText", payload);
  } catch {
    // Silently ignore — edit failures are non-fatal (message may be too old, text identical, etc.)
  }
}

/**
 * Deletes a message. Best-effort — silently ignores failures.
 */
export async function deleteMessage(
  chatId: string | number,
  messageId: number
): Promise<void> {
  try {
    await callApi("deleteMessage", { chat_id: chatId, message_id: messageId });
  } catch {
    // Silently ignore
  }
}

/**
 * Sends a "typing" action to show the bot is processing.
 */
export async function sendTyping(chatId: string | number): Promise<void> {
  await callApi("sendChatAction", { chat_id: chatId, action: "typing" });
}

/**
 * Registers a webhook URL with Telegram. Call once during setup.
 */
export async function setWebhook(url: string, secretToken: string): Promise<void> {
  await callApi("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

/**
 * Removes the registered webhook.
 */
export async function deleteWebhook(): Promise<void> {
  await callApi("deleteWebhook", { drop_pending_updates: false });
}

/**
 * Returns the currently registered webhook info.
 */
export async function getWebhookInfo(): Promise<{ url: string; has_custom_certificate: boolean; pending_update_count: number }> {
  return callApi("getWebhookInfo");
}

/**
 * Returns the bot's own user info (useful for getting the bot's username).
 */
export async function getMe(): Promise<{ id: number; username: string; first_name: string }> {
  return callApi("getMe");
}

// ── Telegram update types (minimal subset) ──────────────────────────────────

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number; type: string; username?: string; first_name?: string };
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}
