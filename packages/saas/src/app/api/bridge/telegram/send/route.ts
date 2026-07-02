/**
 * Internal route for proactively sending a Telegram message to a user.
 * Used by the notification dispatcher and other server-side callers.
 * Authenticated via CRON_SECRET (same as cron routes).
 */

import { NextRequest } from "next/server";
import { sendMessage } from "@/lib/bridge/telegram-client";
import { getVerifiedExternalId } from "@/lib/db/queries/channel-bindings";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId: string; message: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, message } = body;
  if (!userId || !message) {
    return Response.json({ error: "userId and message are required" }, { status: 400 });
  }

  const chatId = await getVerifiedExternalId(userId, "telegram");
  if (!chatId) {
    return Response.json({ sent: false, reason: "no_telegram_binding" });
  }

  try {
    await sendMessage(chatId, message, { parseMode: "Markdown" });
    return Response.json({ sent: true });
  } catch (err) {
    console.error("[bridge/telegram/send] send error:", err);
    return Response.json({ sent: false, reason: String(err) }, { status: 500 });
  }
}
