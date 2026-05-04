import type { NextAuthConfig } from "next-auth";

const allowedEmails = process.env.AUTH_ADMIN_EMAILS
  ? process.env.AUTH_ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase())
  : null;

export function isAdmin(email: string): boolean {
  if (!allowedEmails) return false;
  return allowedEmails.includes(email.toLowerCase().trim());
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
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

      const loginUrl = new URL("/login", request.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
      return Response.redirect(loginUrl);
    },
  },
};
