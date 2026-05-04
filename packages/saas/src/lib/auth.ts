import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { authConfig, isAdmin } from "./auth.config";
export { isAdmin } from "./auth.config";

const providers: NextAuthConfig["providers"] = [];

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  );
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET) {
  providers.push({
    id: "busibox-sso",
    name: process.env.OIDC_NAME || "Busibox SSO",
    type: "oidc" as const,
    issuer: process.env.OIDC_ISSUER,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
  });
}

providers.push(
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      name: { label: "Name", type: "text" },
      verificationToken: { label: "Verification Token", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.email) return null;
      const email = String(credentials.email).toLowerCase().trim();

      const token = credentials.verificationToken ? String(credentials.verificationToken) : null;
      if (!token) return null;

      const { validateVerificationToken } = await import("./verification-codes");
      const verified = validateVerificationToken(token);
      if (!verified || verified.email !== email) return null;

      return {
        id: email,
        email,
        name: String(credentials.name || email),
      };
    },
  })
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.userId = user.email?.toLowerCase().trim() || user.id;
      }

      if (token.email) {
        token.isAdmin = isAdmin(token.email as string);
      }

      if (trigger === "signIn" && token.userId) {
        try {
          const { getUserOrganization, createOrganization, getUserMembership, addOrgMember, listOrganizationMembers } = await import("./db");
          const { consumePendingProfile } = await import("./pending-profiles");
          const userId = token.userId as string;
          let org = await getUserOrganization(userId);

          if (!org) {
            const email = (token.email || userId).toLowerCase();
            const profile = consumePendingProfile(email);
            const orgDisplayName = profile?.companyName || (token.name ? `${token.name}'s Team` : "My Team");
            const slugBase = email.split("@")[0].replace(/[^a-z0-9]/g, "-");
            const slug = `${slugBase}-${Date.now().toString(36)}`;
            org = await createOrganization(orgDisplayName, slug, userId, "free", profile?.companyName || undefined);
            // createOrganization already inserts an owner membership row
          } else {
            // Ensure the user has a membership row. Orgs created before membership
            // rows were introduced may be missing one.
            const membership = await getUserMembership(userId, org.id);
            if (!membership) {
              await addOrgMember(org.id, userId, 'owner');
            } else if (membership.role !== 'owner') {
              // If this user is the sole member, they should be owner.
              const allMembers = await listOrganizationMembers(org.id);
              const hasOwner = allMembers.some(m => m.role === 'owner');
              if (!hasOwner || allMembers.length === 1) {
                const db = (await import("./db")).getDb();
                const { orgMemberships } = await import("./db/schema");
                const { eq, and } = await import("drizzle-orm");
                await db.update(orgMemberships)
                  .set({ role: 'owner' })
                  .where(and(eq(orgMemberships.orgId, org.id), eq(orgMemberships.userId, userId)));
              }
            }
          }

          token.orgId = org.id;
          token.orgPlan = org.plan;

          try {
            const { trackEvent, Events } = await import("./usage-tracking");
            trackEvent(org.id, userId, Events.LOGIN, {});
          } catch {
            // tracking is non-critical
          }
        } catch {
          // DB not available (local dev without DATABASE_URL) - continue without org
        }
      }

      if (trigger === "update" && token.userId) {
        try {
          const { getUserOrganization } = await import("./db");
          const org = await getUserOrganization(token.userId as string);
          if (org) {
            token.orgId = org.id;
            token.orgPlan = org.plan;
          }
        } catch {
          // DB not available
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as any).id = token.userId as string;
        (session.user as any).orgId = token.orgId as string | undefined;
        (session.user as any).orgPlan = token.orgPlan as string | undefined;
        (session.user as any).isAdmin = token.isAdmin as boolean | undefined;
      }
      return session;
    },
    signIn() {
      return true;
    },
  },
});

// Consistent user ID resolution: always prefer email (lowercase), matching the JWT
// callback which sets token.userId = email || id. This ensures write and read paths
// use the same ID so conversation ownership checks never fail.
function resolveUserId(session: { user: { email?: string | null; name?: string | null } & Record<string, unknown> }): string {
  const email = session.user.email?.toLowerCase().trim();
  return email || (session.user as any).id || "unknown";
}

export async function getRequiredUser(): Promise<{ id: string; email: string; name: string }> {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError("Not authenticated");
  }
  const email = session.user.email?.toLowerCase().trim() || "";
  return {
    id: resolveUserId(session as any),
    email,
    name: session.user.name || "",
  };
}

export async function getRequiredUserAndOrg(): Promise<{
  user: { id: string; email: string; name: string };
  org: { id: string; plan: 'free' | 'pro' | 'team' };
}> {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError("Not authenticated");
  }

  const user = {
    id: resolveUserId(session as any),
    email: session.user.email?.toLowerCase().trim() || "",
    name: session.user.name || "",
  };

  const orgId = (session.user as any).orgId;
  const orgPlan = (session.user as any).orgPlan || 'free';

  if (!orgId) {
    // Fallback: look up org from DB
    const { getUserOrganization, createOrganization } = await import("./db");
    let org = await getUserOrganization(user.id);
    if (!org) {
      const name = user.name ? `${user.name}'s Team` : "My Team";
      const slug = `${user.email.split("@")[0].replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;
      org = await createOrganization(name, slug, user.id, "free");
    }
    return { user, org: { id: org.id, plan: org.plan as 'free' | 'pro' | 'team' } };
  }

  return { user, org: { id: orgId, plan: orgPlan as 'free' | 'pro' | 'team' } };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function handleAuthError(err: unknown): Response {
  if (err instanceof AuthError) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  throw err;
}
