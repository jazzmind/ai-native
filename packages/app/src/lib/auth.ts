/**
 * Auth.js v5 configuration for the Vercel deployment path.
 *
 * Configure your providers below. The `auth` function is passed to
 * registerVercelAdapters() in lib/platform.ts so session data flows
 * through platform.auth.getCurrentUser().
 *
 * The Busibox deployment path uses BusiboxAuthAdapter (JWKS-based JWT
 * verification) and this file is not used.
 *
 * -----------------------------------------------------------------------
 * IMPORTANT: Set AUTH_SECRET env var before deploying:
 *   openssl rand -base64 32
 * -----------------------------------------------------------------------
 */

import NextAuth from 'next-auth';
// Add your providers:
// import GitHub from 'next-auth/providers/github';
// import Credentials from 'next-auth/providers/credentials';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role?: string;
    };
  }
  interface User {
    role?: string;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    // Add providers here, e.g.:
    // GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token['role']) {
        session.user.role = token['role'] as string;
      }
      return session;
    },
    jwt({ token, user }) {
      if (user?.role) {
        token['role'] = user.role;
      }
      return token;
    },
  },
});
