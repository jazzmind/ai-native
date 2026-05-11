/**
 * Bridge link management routes.
 * POST   — generate a link code for the current user
 * GET    — return current binding status for all channels
 * DELETE — remove a channel binding
 */

import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import {
  createLinkCode,
  getUserBindings,
  removeBinding,
  type ChannelType,
} from "@/lib/db/queries/channel-bindings";

export const runtime = "nodejs";

export async function GET() {
  let user: { id: string };
  let orgId: string;
  try {
    const result = await getRequiredUserAndOrg();
    user = result.user;
    orgId = result.org.id;
  } catch (err) {
    return handleAuthError(err);
  }

  const bindings = await getUserBindings(user.id);

  return Response.json({
    bindings: bindings.map((b) => ({
      channelType: b.channelType,
      externalId: b.externalId,
      displayName: b.displayName,
      isVerified: !!b.verifiedAt,
      verifiedAt: b.verifiedAt,
      isActive: b.isActive,
    })),
  });
}

export async function POST(req: NextRequest) {
  let user: { id: string };
  let orgId: string;
  try {
    const result = await getRequiredUserAndOrg();
    user = result.user;
    orgId = result.org.id;
  } catch (err) {
    return handleAuthError(err);
  }

  let body: { channelType: ChannelType };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { channelType } = body;
  if (!channelType || !["telegram", "whatsapp", "signal"].includes(channelType)) {
    return Response.json({ error: "Invalid channelType" }, { status: 400 });
  }

  const result = await createLinkCode(user.id, orgId, channelType);

  return Response.json({
    linkCode: result.linkCode,
    expiresAt: result.expiresAt,
  });
}

export async function DELETE(req: NextRequest) {
  let user: { id: string };
  try {
    const result = await getRequiredUserAndOrg();
    user = result.user;
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = new URL(req.url);
  const channelType = searchParams.get("channelType") as ChannelType | null;

  if (!channelType || !["telegram", "whatsapp", "signal"].includes(channelType)) {
    return Response.json({ error: "Invalid channelType" }, { status: 400 });
  }

  await removeBinding(user.id, channelType);
  return Response.json({ unlinked: true });
}
