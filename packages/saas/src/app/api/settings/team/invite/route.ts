import { NextRequest, NextResponse } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { getUserMembership, createInvitation } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  let user: { id: string; email: string; name: string };
  let org: { id: string };
  try {
    const result = await getRequiredUserAndOrg();
    user = result.user;
    org = result.org;
  } catch (err) {
    return handleAuthError(err);
  }

  const membership = await getUserMembership(user.id, org.id);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return NextResponse.json({ error: "Only owners and admins can invite members" }, { status: 403 });
  }

  const body = await req.json();
  const email = (body.email || "").toLowerCase().trim();
  const role: 'admin' | 'member' = body.role === 'admin' ? 'admin' : 'member';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const invitation = await createInvitation(org.id, email, role, user.id);

  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const acceptUrl = `${baseUrl}/api/auth/accept-invite?token=${invitation.token}`;
  const inviterName = user.name || user.email;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:0">
  <div style="max-width:560px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a">
    <div style="background:#7c3aed;padding:24px 32px">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff">You've been invited to join a team</h1>
    </div>
    <div style="padding:32px">
      <p style="color:#a3a3a3;font-size:14px;line-height:1.6;margin:0 0 24px">
        <strong style="color:#e5e5e5">${inviterName}</strong> has invited you to join their advisory team as a <strong style="color:#e5e5e5">${role}</strong>.
      </p>
      <a href="${acceptUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">
        Accept Invitation →
      </a>
      <p style="color:#525252;font-size:12px;margin:24px 0 0">
        This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    await sendEmail(email, `You've been invited to join a team`, html);
  } catch (err) {
    console.error("Failed to send invite email:", err);
    // Don't fail the request — invitation is created, user can resend
  }

  return NextResponse.json({
    success: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
  });
}
