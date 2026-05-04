import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, isTokenExpired } from "@jazzmind/busibox-app/lib/authz";
import { exchangeForAuthzToken, type AuthzAudience } from "@lib/authz-client";

/**
 * POST /api/auth/refresh
 *
 * Refreshes the access token if it's expired or about to expire.
 */
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: "No session token found", requiresReauth: true },
        { status: 401 }
      );
    }

    if (isTokenExpired(token)) {
      return NextResponse.json(
        { error: "Session expired", requiresReauth: true },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const audience = (body.audience || "backend-api") as AuthzAudience;
    const scopes = body.scopes as string[] | undefined;

    const result = await exchangeForAuthzToken(token, audience, scopes);

    return NextResponse.json({
      token: result.accessToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    console.error("[Auth/Refresh] Error:", error);
    const message = error instanceof Error ? error.message : "Token refresh failed";
    return NextResponse.json(
      { error: "Token refresh failed", message, requiresReauth: true },
      { status: 401 }
    );
  }
}
