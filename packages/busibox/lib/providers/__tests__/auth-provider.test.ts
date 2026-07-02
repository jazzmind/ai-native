import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted() is required because vi.mock() factories are hoisted above
// top-level const declarations.
const { exchangeTokenZeroTrustMock, getTokenFromRequestMock, getSessionFromRequestMock, parseJWTPayloadMock } =
  vi.hoisted(() => ({
    exchangeTokenZeroTrustMock: vi.fn(),
    getTokenFromRequestMock: vi.fn(),
    getSessionFromRequestMock: vi.fn(),
    parseJWTPayloadMock: vi.fn(),
  }));

vi.mock("@jazzmind/busibox-app/lib/authz", () => ({
  exchangeTokenZeroTrust: exchangeTokenZeroTrustMock,
  getTokenFromRequest: getTokenFromRequestMock,
  getSessionFromRequest: getSessionFromRequestMock,
  parseJWTPayload: parseJWTPayloadMock,
}));

import { BusiboxAuthProvider, exchangeForAuthzToken } from "../auth-provider";

function fakeRequest(): Request {
  return new Request("https://example.com/api/x");
}

describe("BusiboxAuthProvider.getAuth", () => {
  beforeEach(() => {
    getSessionFromRequestMock.mockReset();
    parseJWTPayloadMock.mockReset();
    delete process.env.TEST_SESSION_JWT;
  });

  it("synthesizes a single-user org from the session (org.id === user.id)", async () => {
    getSessionFromRequestMock.mockReturnValue({
      userId: "user-1",
      email: "user@example.com",
      roles: ["Admin"],
      displayName: "Ada Lovelace",
      avatarUrl: "https://example.com/a.png",
    });

    const provider = new BusiboxAuthProvider();
    const ctx = await provider.getAuth(fakeRequest() as never);

    expect(ctx).toEqual({
      user: { id: "user-1", name: "Ada Lovelace", email: "user@example.com", image: "https://example.com/a.png" },
      org: { id: "user-1", name: "default", slug: "default", plan: "default", userRole: "owner" },
    });
  });

  it("falls back to first/last name when displayName is absent", async () => {
    getSessionFromRequestMock.mockReturnValue({
      userId: "user-2",
      email: "u2@example.com",
      roles: [],
      firstName: "Grace",
      lastName: "Hopper",
    });

    const provider = new BusiboxAuthProvider();
    const ctx = await provider.getAuth(fakeRequest() as never);
    expect(ctx?.user.name).toBe("Grace Hopper");
  });

  it("returns null when there is no session and no TEST_SESSION_JWT", async () => {
    getSessionFromRequestMock.mockReturnValue(null);
    const provider = new BusiboxAuthProvider();
    await expect(provider.getAuth(fakeRequest() as never)).resolves.toBeNull();
  });

  it("requireAuth throws when unauthenticated", async () => {
    getSessionFromRequestMock.mockReturnValue(null);
    const provider = new BusiboxAuthProvider();
    await expect(provider.requireAuth(fakeRequest() as never)).rejects.toThrow(/Authentication required/);
  });
});

describe("BusiboxAuthProvider.exchangeToken", () => {
  beforeEach(() => {
    getTokenFromRequestMock.mockReset();
    exchangeTokenZeroTrustMock.mockReset();
  });
  afterEach(() => {
    delete process.env.TEST_SESSION_JWT;
  });

  it("exchanges the SSO token from the request for a downstream access token", async () => {
    getTokenFromRequestMock.mockReturnValue("sso-jwt");
    exchangeTokenZeroTrustMock.mockResolvedValue({
      accessToken: "access-token-xyz",
      tokenType: "bearer",
      expiresIn: 3600,
      scope: "",
      expiresAt: Date.now() + 3600_000,
    });

    const provider = new BusiboxAuthProvider();
    const token = await provider.exchangeToken(fakeRequest() as never, "agent-api");

    expect(token).toBe("access-token-xyz");
    expect(exchangeTokenZeroTrustMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionJwt: "sso-jwt", audience: "agent-api" }),
      expect.any(Object),
    );
  });

  it("throws when there is no session token available", async () => {
    getTokenFromRequestMock.mockReturnValue(undefined);
    const provider = new BusiboxAuthProvider();
    await expect(provider.exchangeToken(fakeRequest() as never, "agent-api")).rejects.toThrow(/No session token/);
  });
});

describe("exchangeForAuthzToken", () => {
  it("passes purpose (APP_NAME) and resourceId through to the zero-trust exchange", async () => {
    exchangeTokenZeroTrustMock.mockReset().mockResolvedValue({
      accessToken: "tok",
      tokenType: "bearer",
      expiresIn: 60,
      scope: "read",
      expiresAt: Date.now(),
    });

    const result = await exchangeForAuthzToken("sso-jwt", "data-api", ["read"], "resource-1");

    expect(result.accessToken).toBe("tok");
    expect(exchangeTokenZeroTrustMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionJwt: "sso-jwt",
        audience: "data-api",
        scopes: ["read"],
        resourceId: "resource-1",
      }),
      expect.any(Object),
    );
  });
});
