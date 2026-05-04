import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { acceptInvitation, getInvitationByToken } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/dashboard?error=invalid_token", req.url));
  }

  const session = await auth();
  if (!session?.user) {
    // Not logged in — redirect to sign-in with the token so they can return after auth
    const signinUrl = new URL("/api/auth/signin", req.url);
    signinUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signinUrl);
  }

  const userId = (session.user as any).id || session.user.email;
  if (!userId) {
    return NextResponse.redirect(new URL("/dashboard?error=invalid_session", req.url));
  }

  // Validate token
  const invitation = await getInvitationByToken(token);
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/dashboard?error=expired_token", req.url));
  }

  const result = await acceptInvitation(token, userId);
  if (!result) {
    return NextResponse.redirect(new URL("/dashboard?error=invite_failed", req.url));
  }

  // Force session refresh so new org is picked up on next request
  return NextResponse.redirect(new URL("/dashboard?joined=1", req.url));
}
