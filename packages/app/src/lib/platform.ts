/**
 * Platform bootstrap for ai-native.
 *
 * This file is the single point where the correct adapter bundle is loaded.
 * It must be imported before any code that calls getPlatform().
 *
 * Vercel path:  DATABASE_URL + ANTHROPIC_API_KEY → VercelAIAdapter + VercelDataAdapter
 * Busibox path: AGENT_API_URL + DATA_API_URL     → BusiboxAIAdapter + BusiboxDataAdapter
 */

import { getPlatform, resetPlatform, type Platform } from '@jazzmind/busibox-app/platform';

let initialized = false;

export async function initPlatform(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (process.env.AGENT_API_URL || process.env.DATA_API_URL) {
    const { registerBusiboxAdapters } = await import(
      '@jazzmind/busibox-app/platform/busibox'
    );

    registerBusiboxAdapters({
      getToken: async () => {
        // In Busibox, the token is extracted per-request from the SSO session.
        // This default is a placeholder — routes should call platform.auth.getServiceToken()
        // or use the request-scoped token from requireAuthWithTokenExchange().
        throw new Error('getToken must be called with a request-scoped token');
      },
    });
  } else {
    const { registerVercelAdapters } = await import(
      '@jazzmind/busibox-app/platform/vercel'
    );

    // Lazy-load the Auth.js auth() function to avoid circular imports
    registerVercelAdapters({
      getSession: async (request) => {
        try {
          const { auth } = await import('./auth');
          // Auth.js v5 auth() can be called with a request
          return (auth as unknown as (req: Request) => Promise<{ user?: { id?: string; email?: string | null; name?: string | null } } | null>)(request);
        } catch {
          return null;
        }
      },
    });
  }
}

export function getPlatformInstance(): Platform {
  return getPlatform();
}

export { resetPlatform };
