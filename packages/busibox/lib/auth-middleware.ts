/**
 * Authentication Middleware for Busibox Apps (Zero Trust)
 *
 * - Uses SSO token (session JWT) from Busibox Portal for token exchange
 * - NO client credentials required
 */

import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@jazzmind/busibox-app/lib/authz";
import { decodeJwt } from "jose";
import { getApiToken } from "./authz-client";

const DEFAULT_AUDIENCE = (process.env.DEFAULT_API_AUDIENCE || "backend-api") as
  | "agent-api"
  | "data-api"
  | "search-api";

export interface AuthenticatedRequest {
  ssoToken: string | null;
  apiToken: string;
  isTestUser?: boolean;
}

export async function requireAuthWithTokenExchange(
  request: NextRequest,
  audience?: "agent-api" | "data-api" | "search-api",
  scopes?: string[],
): Promise<AuthenticatedRequest | NextResponse> {
  try {
    const ssoToken = getTokenFromRequest(request);
    const targetAudience = audience || DEFAULT_AUDIENCE;
    const resourceId = getAppResourceId(request);

    if (!ssoToken) {
      const testSessionJwt = process.env.TEST_SESSION_JWT;

      if (testSessionJwt) {
        console.log("[AUTH] No SSO token found, using TEST_SESSION_JWT for local development");
        const apiToken = await getApiToken(testSessionJwt, targetAudience, scopes, resourceId);
        return { ssoToken: testSessionJwt, apiToken, isTestUser: true };
      }

      return NextResponse.json(
        {
          error: "Authentication required",
          message:
            "Please log in through the Busibox Portal and try again. For local testing, set TEST_SESSION_JWT.",
        },
        { status: 401 },
      );
    }

    const apiToken = await getApiToken(ssoToken, targetAudience, scopes, resourceId);
    return { ssoToken, apiToken, isTestUser: false };
  } catch (error: unknown) {
    console.error("[AUTH] Token exchange failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Authentication failed",
        message: "Failed to authenticate with the backend service. Please log in again.",
        details: errorMessage,
      },
      { status: 401 },
    );
  }
}

export function getAppResourceId(request: NextRequest): string | null {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return null;
    const payload = decodeJwt(token);
    return (payload.app_id as string) || null;
  } catch {
    return null;
  }
}

export async function optionalAuth(
  request: NextRequest,
  audience?: "agent-api" | "data-api" | "search-api",
  scopes?: string[],
): Promise<AuthenticatedRequest | null> {
  try {
    const ssoToken = getTokenFromRequest(request);
    const targetAudience = audience || DEFAULT_AUDIENCE;
    const resourceId = getAppResourceId(request);

    if (!ssoToken) {
      const testSessionJwt = process.env.TEST_SESSION_JWT;
      if (testSessionJwt) {
        const apiToken = await getApiToken(testSessionJwt, targetAudience, scopes, resourceId);
        return { ssoToken: testSessionJwt, apiToken, isTestUser: true };
      }
      return null;
    }

    const apiToken = await getApiToken(ssoToken, targetAudience, scopes, resourceId);
    return { ssoToken, apiToken, isTestUser: false };
  } catch {
    return null;
  }
}
