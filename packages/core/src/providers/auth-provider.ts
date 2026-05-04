/**
 * AuthProvider abstracts authentication and identity resolution.
 *
 * SaaS implementation: NextAuth v5 sessions + Drizzle org queries
 * Busibox implementation: Busibox SSO SessionProvider + requireAuthWithTokenExchange
 */

export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

/** Minimal org/tenant context needed by the app */
export interface AuthOrg {
  id: string;
  name: string;
  slug: string;
  /** Opaque plan string; 'default' when tenancy is not applicable (Busibox) */
  plan: string;
  /** Role of the current user in this org */
  userRole: 'owner' | 'admin' | 'member';
}

export interface AuthContext {
  user: AuthUser;
  org: AuthOrg;
}

export interface AuthProvider {
  readonly type: string;

  /** Resolves auth context from a server-side request. Returns null when unauthenticated. */
  getAuth(request: Request): Promise<AuthContext | null>;

  /** Same as getAuth but throws/redirects on failure — use in API route guards. */
  requireAuth(request: Request): Promise<AuthContext>;

  /**
   * Exchange the current auth for a service-scoped bearer token.
   * SaaS: returns the same JWT (Anthropic uses it directly via api key).
   * Busibox: does Zero Trust token exchange via authz.
   */
  exchangeToken(request: Request, audience: string): Promise<string>;
}
