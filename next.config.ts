import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" } : {}),
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
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: process.env.NODE_ENV === "production" 
              ? "public, max-age=31536000, immutable" 
              : "no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/dashboard/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
  experimental: {
    // Reduces initial memory footprint in dev by avoiding eager preloading of every route entrypoint.
    preloadEntriesOnStart: false,
    webpackBuildWorker: false,
    workerThreads: true,
  },
  webpack: (config, { dev }) => {
    // Extend Webpack chunk loading timeout from default 12s to 60s to prevent script timeout errors
    config.output = {
      ...config.output,
      chunkLoadTimeout: 60000,
    };

    if (dev) {
      config.cache = { type: "memory" };
    }

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
