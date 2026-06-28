import type { NextConfig } from 'next';

const isBusibox = !!(process.env.AGENT_API_URL || process.env.DATA_API_URL);

const nextConfig: NextConfig = {
  /**
   * Standalone output for Busibox deployments (Docker/LXC).
   * Vercel uses the default 'export' strategy handled by the Vercel platform.
   */
  output: isBusibox ? 'standalone' : undefined,

  transpilePackages: ['@jazzmind/busibox-app', '@ai-native/core'],

  experimental: {
    serverComponentsExternalPackages: ['@neondatabase/serverless'],
  },

  // Ensure consistent builds regardless of platform
  env: {
    NEXT_PUBLIC_PLATFORM: isBusibox ? 'busibox' : 'vercel',
  },
};

export default nextConfig;
