import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: { 
    remotePatterns: [{ protocol:'https', hostname:'**' }] 
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
  turbopack: {
    root: path.resolve("."),
    resolveAlias: {
      'fs': './lib/empty.ts'
    }
  }
};

export default nextConfig;
