/**
 * AuthZ Client for Busibox Apps
 *
 * Zero Trust Authentication — uses busibox-session cookie (RS256 JWT from authz)
 * as subject_token. No client credentials required for user operations.
 */

import {
  exchangeTokenZeroTrust,
  getAuthHeaderZeroTrust,
  type AuthzAudience as SharedAuthzAudience,
} from "@jazzmind/busibox-app";

export type AuthzAudience = SharedAuthzAudience;

export interface AuthzTokenResponse {
  accessToken: string;
  tokenType: "bearer";
  expiresIn: number;
  scope: string;
}

function getAuthzBaseUrl(): string {
  return process.env.AUTHZ_BASE_URL || "http://authz-api:8010";
}

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

export async function getApiToken(
  sessionJwt: string,
  audience: AuthzAudience,
  scopes?: string[],
  resourceId?: string | null,
): Promise<string> {
  const result = await exchangeForAuthzToken(sessionJwt, audience, scopes, resourceId);
  return result.accessToken;
}

export async function getApiTokenForTestUser(
  audience: AuthzAudience,
  scopes?: string[],
): Promise<string> {
  const testSessionJwt = process.env.TEST_SESSION_JWT;

  if (!testSessionJwt) {
    throw new Error(
      "TEST_SESSION_JWT not configured. Set TEST_SESSION_JWT to a valid session JWT from the authz service.",
    );
  }

  const result = await exchangeForAuthzToken(testSessionJwt, audience, scopes);
  return result.accessToken;
}

export async function getAuthorizationHeader(
  sessionJwt: string,
  audience: AuthzAudience,
  scopes?: string[],
): Promise<string> {
  const appName = process.env.APP_NAME || "ai-native";

  return getAuthHeaderZeroTrust(
    { sessionJwt, audience, scopes, purpose: appName },
    { authzBaseUrl: getAuthzBaseUrl(), verbose: process.env.VERBOSE_AUTHZ_LOGGING === "true" },
  );
}
