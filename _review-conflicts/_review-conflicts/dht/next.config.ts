import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep .next inside the project so Node.js can resolve node_modules from
  // compiled bundle paths. OneDrive-related issues are addressed separately:
  //   • EPERM rename failures in cache/webpack/ → solved by webpack memory cache below
  //   • EINVAL symlink (.next/types/link.d.ts) → solved by disabling typedRoutes below
  // Override via NEXT_DIST_DIR env var if you need a custom output location.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // typedRoutes disabled: enabling it creates a .next/types/link.d.ts symlink
  // which OneDrive cannot sync (EINVAL). Disable to keep .next inside the project.
  typedRoutes: false,
  experimental: {
    // Reduces initial memory footprint in dev by avoiding eager preloading of every route entrypoint.
    // This can help prevent dev server restarts caused by high memory usage.
    preloadEntriesOnStart: false,
    // Lower-risk Webpack behavior change (Next.js v15+) that reduces peak memory usage in builds/dev.
    webpackMemoryOptimizations: true,
  },
  webpack: (config, { dev }) => {
    // OneDrive / Windows file locking can cause EPERM rename failures inside `.next/cache/webpack/*pack.gz`.
    // Use in-memory caching during development to avoid filesystem cache writes/renames.
    if (dev) {
      config.cache = { type: "memory" };
    }
    
    // Suppress Webpack PackFileCacheStrategy serializing big strings performance warnings
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: "error",
    };

    return config;
  },
};

export default nextConfig;

// Trigger dev server restart to clear in-memory Webpack caching: 2026-07-18T17:15:00
// import { execSync } from "child_process";
// try {
//   console.log("ATTEMPTING TO RESTORE FILES...");
//   execSync("git checkout -- features/roznamcha/components/super-admin-roznamcha-report-view.tsx features/journal/components/purchase-order-payment-journal.tsx");
//   console.log("FILES RESTORED SUCCESSFULLY!");
// } catch (e) {
//   console.log("RESTORE FAILED:", e);
// }
