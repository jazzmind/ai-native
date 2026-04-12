import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError, isAdmin } from "@/lib/auth";
import { updateExpertProfile } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  if (!isAdmin(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { approved, isFoundingExpert } = body as {
    approved: boolean;
    isFoundingExpert?: boolean;
  };

  const updates: Record<string, any> = {
    isActive: approved,
  };

  if (isFoundingExpert) {
    updates.isFoundingExpert = true;
    updates.platformFeeRate = 0.10;
  }

  await updateExpertProfile(id, updates);

  return Response.json({ ok: true });
}
