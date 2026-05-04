import { NextResponse } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { listOrganizationMembers, getUserMembership, listPendingInvitations } from "@/lib/db";

export async function GET() {
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
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }

  const [members, invitations] = await Promise.all([
    listOrganizationMembers(org.id),
    listPendingInvitations(org.id),
  ]);

  return NextResponse.json({
    members: members.map(m => ({
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt,
      isCurrentUser: m.userId === user.id,
    })),
    invitations: invitations.map(i => ({
      id: i.id,
      email: i.email,
      role: i.role,
      invitedBy: i.invitedBy,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
    })),
    currentUserRole: membership.role,
  });
}
