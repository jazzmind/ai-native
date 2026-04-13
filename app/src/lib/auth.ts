import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

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

const allowedEmails = process.env.AUTH_ADMIN_EMAILS
  ? process.env.AUTH_ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase())
  : null;

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

      // Require a valid verification token (from TOTP flow)
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

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // Always use email as the canonical userId for data consistency
        // across auth providers (credentials, GitHub, Google, OIDC)
        token.userId = user.email?.toLowerCase().trim() || user.id;
      }

      if (token.email) {
        token.isAdmin = isAdmin(token.email as string);
      }

      // On sign-in, ensure the user has an org
      if (trigger === "signIn" && token.userId) {
        try {
          const { getUserOrganization, createOrganization } = await import("./db");
          const userId = token.userId as string;
          let org = await getUserOrganization(userId);

          if (!org) {
            const name = token.name
              ? `${token.name}'s Team`
              : "My Team";
            const email = (token.email || userId).toLowerCase();
            const slugBase = email.split("@")[0].replace(/[^a-z0-9]/g, "-");
            const slug = `${slugBase}-${Date.now().toString(36)}`;
            org = await createOrganization(name, slug, userId, "free");
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

      // Refresh org info periodically (on session updates)
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
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;

      if (pathname === "/") return true;
      if (pathname.startsWith("/api/auth")) return true;
      if (pathname.startsWith("/login")) return true;
      if (pathname.startsWith("/signup")) return true;
      if (pathname.startsWith("/api/billing/webhook")) return true;
      if (pathname.startsWith("/api/marketplace/expert-count")) return true;
      if (pathname.startsWith("/expert/apply")) return true;

      if (session?.user) return true;

      return Response.redirect(new URL("/login", request.nextUrl.origin));
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function getRequiredUser(): Promise<{ id: string; email: string; name: string }> {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError("Not authenticated");
  }
  const email = session.user.email?.toLowerCase().trim() || "";
  return {
    id: email || (session.user as any).id || "unknown",
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
    id: (session.user as any).id || session.user.email || "unknown",
    email: session.user.email || "",
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

export function isAdmin(email: string): boolean {
  if (!allowedEmails) return false;
  return allowedEmails.includes(email.toLowerCase().trim());
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
