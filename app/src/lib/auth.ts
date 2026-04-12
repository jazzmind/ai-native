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

// Allowed emails from env (comma-separated). If set, only these can sign in.
const allowedEmails = process.env.AUTH_ADMIN_EMAILS
  ? process.env.AUTH_ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase())
  : null;

// Credentials provider for local/email-based auth
providers.push(
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "you@example.com" },
      name: { label: "Name", type: "text", placeholder: "Your Name" },
    },
    async authorize(credentials) {
      if (!credentials?.email) return null;
      const email = String(credentials.email).toLowerCase().trim();

      if (allowedEmails && !allowedEmails.includes(email)) {
        return null;
      }

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
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as any).id = token.userId as string;
      }
      return session;
    },
    signIn({ user }) {
      // If allowed emails are configured, enforce for all providers
      if (allowedEmails && user.email) {
        return allowedEmails.includes(user.email.toLowerCase().trim());
      }
      return true;
    },
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;

      if (pathname.startsWith("/api/auth")) return true;
      if (pathname.startsWith("/login")) return true;

      if (session?.user) return true;

      // Not logged in — redirect to login
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
  return {
    id: (session.user as any).id || session.user.email || "unknown",
    email: session.user.email || "",
    name: session.user.name || "",
  };
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
