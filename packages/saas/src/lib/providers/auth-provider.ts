import type { AuthContext, AuthOrg, AuthProvider, AuthUser } from "@ai-native/core";
import { auth, getRequiredUserAndOrg, AuthError } from "@/lib/auth";
import { getOrganization, getUserMembership } from "@/lib/db";
import { resolveAnthropicKey } from "@/lib/api-key-resolver";

/**
 * SaasAuthProvider wraps NextAuth v5 (lib/auth.ts) + Drizzle org queries to
 * implement the shared AuthProvider contract.
 *
 * All methods ignore the `Request` argument — NextAuth's `auth()` reads the
 * session from cookies via async local context, matching the existing
 * `getRequiredUser`/`getRequiredUserAndOrg` behavior this class wraps.
 */
export class SaasAuthProvider implements AuthProvider {
  readonly type = "saas";

  private async buildContext(): Promise<AuthContext> {
    const { user, org } = await getRequiredUserAndOrg();

    const session = await auth();
    const image = (session?.user as { image?: string | null } | undefined)?.image ?? null;

    const fullOrg = await getOrganization(org.id);
    const membership = await getUserMembership(user.id, org.id);

    const authUser: AuthUser = {
      id: user.id,
      name: user.name || null,
      email: user.email,
      image,
    };

    const authOrg: AuthOrg = {
      id: org.id,
      name: fullOrg?.name ?? "",
      slug: fullOrg?.slug ?? "",
      plan: org.plan,
      userRole: (membership?.role as AuthOrg["userRole"]) ?? "member",
    };

    return { user: authUser, org: authOrg };
  }

  async getAuth(_request: Request): Promise<AuthContext | null> {
    try {
      return await this.buildContext();
    } catch (err) {
      if (err instanceof AuthError) return null;
      throw err;
    }
  }

  async requireAuth(_request: Request): Promise<AuthContext> {
    return this.buildContext();
  }

  /**
   * SaaS has no Zero Trust token exchange — the Anthropic API key resolved
   * for the caller's org/plan (platform key, or BYO key override) IS the
   * bearer credential used directly against Anthropic. `audience` is unused.
   */
  async exchangeToken(request: Request, _audience: string): Promise<string> {
    const { user, org } = await this.requireAuth(request);
    return resolveAnthropicKey(org.id, user.id, org.plan as "free" | "pro" | "team");
  }
}
