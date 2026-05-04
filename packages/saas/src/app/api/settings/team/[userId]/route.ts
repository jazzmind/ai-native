import { NextRequest, NextResponse } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { getUserMembership, removeOrgMember, revokeInvitation } from "@/lib/db";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  let user: { id: string };
  let org: { id: string };
  try {
    const result = await getRequiredUserAndOrg();
    user = result.user;
    org = result.org;
  } catch (err) {
    return handleAuthError(err);
  }

  const membership = await getUserMembership(user.id, org.id);
  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: "Only owners can remove members" }, { status: 403 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  // Check if this is an invitation ID (revoke) or a member userId (remove)
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type === "invitation") {
    await revokeInvitation(userId, org.id);
  } else {
    const targetMembership = await getUserMembership(userId, org.id);
    if (targetMembership?.role === 'owner') {
      return NextResponse.json({ error: "Cannot remove another owner" }, { status: 400 });
    }
    await removeOrgMember(org.id, userId);
  }

  return NextResponse.json({ success: true });
}
