/**
 * AuthProvider — Busibox implementation.
 *
 * Built directly on @jazzmind/busibox-app's Zero Trust authz exports.
 * Supersedes the old lib/authz-client.ts wrapper (deleted).
 *
 * Busibox has no real multi-tenancy, so `org` is synthesized from the
 * user's own identity (org.id === user.id) rather than sourced from a
 * separate tenant record.
 */

import type { NextRequest } from "next/server";
import {
  exchangeTokenZeroTrust,
  getTokenFromRequest,
  getSessionFromRequest,
  parseJWTPayload,
  type AuthzAudience,
} from "@jazzmind/busibox-app/lib/authz";
import type { AuthContext, AuthOrg, AuthProvider, AuthUser } from "@ai-native/core";

function getAuthzBaseUrl(): string {
  return process.env.AUTHZ_BASE_URL || "http://authz-api:8010";
}

export interface AuthzTokenResponse {
  accessToken: string;
  tokenType: "bearer";
  expiresIn: number;
  scope: string;
}

/**
 * Exchange a Busibox session JWT for a downstream service access token.
 *
 * Thin wrapper around busibox-app's Zero Trust token exchange with
 * ai-native's app name / authz base URL conventions. Shared by
 * lib/auth-middleware.ts and app/api/auth/refresh/route.ts so both call
 * sites stay in sync without duplicating the exchange plumbing.
 */
export async function exchangeForAuthzToken(
  sessionJwt: string,
  audience: AuthzAudience,
  scopes?: string[],
  resourceId?: string | null,
): Promise<AuthzTokenResponse> {
  const appName = process.env.APP_NAME || "ai-native";

  const result = await exchangeTokenZeroTrust(
    { sessionJwt, audience, scopes, purpose: appName, resourceId: resourceId || undefined },
    { authzBaseUrl: getAuthzBaseUrl(), verbose: process.env.VERBOSE_AUTHZ_LOGGING === "true" },
  );

  return {
    accessToken: result.accessToken,
    tokenType: result.tokenType,
    expiresIn: result.expiresIn,
    scope: result.scope,
  };
}

interface SessionInfo {
  userId: string;
  email: string;
  roles: string[];
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

/** Fall back to TEST_SESSION_JWT (local development) when no session cookie/header is present. */
function sessionFromTestToken(): SessionInfo | null {
  const testJwt = process.env.TEST_SESSION_JWT;
  if (!testJwt) return null;
  const payload = parseJWTPayload(testJwt);
  if (!payload) return null;
  return {
    userId: (payload.sub as string) || (payload.user_id as string) || "unknown",
    email: (payload.email as string) || "",
    roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
    displayName: payload.displayName as string | undefined,
    firstName: payload.firstName as string | undefined,
    lastName: payload.lastName as string | undefined,
    avatarUrl: payload.avatarUrl as string | undefined,
  };
}

function toAuthContext(session: SessionInfo): AuthContext {
  const name =
    session.displayName || [session.firstName, session.lastName].filter(Boolean).join(" ") || null;

  const user: AuthUser = {
    id: session.userId,
    name: name || null,
    email: session.email,
    image: session.avatarUrl ?? null,
  };

  // No real multi-tenancy in Busibox — synthesize a single-user "org".
  const org: AuthOrg = {
    id: session.userId,
    name: "default",
    slug: "default",
    plan: "default",
    userRole: "owner",
  };

  return { user, org };
}

export class BusiboxAuthProvider implements AuthProvider {
  readonly type = "busibox-zero-trust";

  async getAuth(request: NextRequest): Promise<AuthContext | null> {
    const session = getSessionFromRequest(request) ?? sessionFromTestToken();
    if (!session) return null;
    return toAuthContext(session);
  }

  async requireAuth(request: NextRequest): Promise<AuthContext> {
    const ctx = await this.getAuth(request);
    if (!ctx) {
      throw new Error("Authentication required");
    }
    return ctx;
  }

  async exchangeToken(request: NextRequest, audience: string): Promise<string> {
    const ssoToken = getTokenFromRequest(request) || process.env.TEST_SESSION_JWT;
    if (!ssoToken) {
      throw new Error("No session token available for exchange");
    }
    const result = await exchangeForAuthzToken(ssoToken, audience as AuthzAudience);
    return result.accessToken;
  }
}
