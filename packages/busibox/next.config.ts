import type { NextConfig } from "next";
import path from "path";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath,
  assetPrefix: basePath || undefined,
  transpilePackages: ["@ai-native/core", "@jazzmind/busibox-app"],
  turbopack: {
    resolveAlias: {
      "@lib": path.resolve(__dirname, "lib"),
      "@components": path.resolve(__dirname, "components"),
    },
  },
  // Keep webpack config for non-Turbopack builds
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@lib": path.resolve(__dirname, "lib"),
      "@components": path.resolve(__dirname, "components"),
    };
    return config;
  },
};

export default nextConfig;
