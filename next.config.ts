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
          // Production build filenames are content-hashed, so caching forever is safe
          // and correct there. In `next dev`, chunk filenames (e.g. page.js) are STABLE
          // across rebuilds — an immutable/max-age=1yr rule here means the browser never
          // re-requests the file again after the first load, no matter how many times the
          // dev server recompiles it, silently serving a stale bundle for the rest of the
          // browser session (confirmed: this caused edited component output to never
          // reach the DOM even after full dev-server restarts and brand-new tabs, since
          // the stale copy lived in the browser's own HTTP cache, not in any
          // server/service-worker layer).
          {
            key: "Cache-Control",
            value:
              process.env.NODE_ENV === "production"
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
    // This can help prevent dev server restarts caused by high memory usage.
    preloadEntriesOnStart: false,
    // NOTE: `webpackMemoryOptimizations` was removed — it caused faulty server-chunk
    // splitting where in-module bindings (e.g. getTableHeader) were separated from
    // their usages and became `undefined` at runtime, 500-ing some pages.
  },
  webpack: (config, { dev }) => {
    // Extend Webpack chunk loading timeout from default 12s to 60s to prevent script timeout errors
    config.output = {
      ...config.output,
      chunkLoadTimeout: 60000,
    };

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
