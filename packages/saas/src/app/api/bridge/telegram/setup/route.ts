/**
 * Admin-only route to register the Telegram webhook URL.
 *
 * POST /api/bridge/telegram/setup
 *   Body: { url?: string }  — optional override for the base URL (useful for local dev tunnels)
 *   If url is omitted, falls back to NEXT_PUBLIC_APP_URL env var.
 *   Auth: Admin session required
 *
 * GET  /api/bridge/telegram/setup  — returns current webhook registration info
 *
 * DELETE /api/bridge/telegram/setup — removes the webhook registration
 */

import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { isAdmin } from "@/lib/auth.config";
import { setWebhook, deleteWebhook, getWebhookInfo } from "@/lib/bridge/telegram-client";

export const runtime = "nodejs";

async function requireAdmin() {
  const result = await getRequiredUserAndOrg();
  if (!isAdmin(result.user.email)) {
    throw new Error("Admin access required");
  }
  return result.user;
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    const msg = String(err);
    if (msg.includes("Admin")) return Response.json({ error: msg }, { status: 403 });
    return handleAuthError(err);
  }

  try {
    const info = await getWebhookInfo();
    return Response.json({ webhookInfo: info });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (err) {
    const msg = String(err);
    if (msg.includes("Admin")) return Response.json({ error: msg }, { status: 403 });
    return handleAuthError(err);
  }

  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* body is optional */ }

  const baseUrl = body.url || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (!baseUrl) {
    return Response.json({ error: "Provide a url in the request body or set NEXT_PUBLIC_APP_URL" }, { status: 400 });
  }

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json({ error: "TELEGRAM_WEBHOOK_SECRET is not set" }, { status: 500 });
  }

  // Strip trailing slash
  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/bridge/telegram/webhook`;

  try {
    await setWebhook(webhookUrl, webhookSecret);
    const info = await getWebhookInfo();
    return Response.json({ registered: true, webhookUrl, info });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
  } catch (err) {
    const msg = String(err);
    if (msg.includes("Admin")) return Response.json({ error: msg }, { status: 403 });
    return handleAuthError(err);
  }

  try {
    await deleteWebhook();
    return Response.json({ deleted: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
