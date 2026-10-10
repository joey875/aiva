import type { NextConfig } from "next";

// Cache Components is off on purpose: nearly every screen is per-user and
// session-dependent, so plain dynamic rendering keeps the auth story simple.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
