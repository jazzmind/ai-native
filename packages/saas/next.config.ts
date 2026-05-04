import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@anthropic-ai/sdk"],
  transpilePackages: ["@ai-native/core"],
};

export default nextConfig;
