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
  // Local OCR / document-parsing libs must be require()d from node_modules at
  // runtime, not bundled — they load internal worker scripts / native binaries
  // by relative path (e.g. tesseract.js → src/worker-script/node/index.js).
  // Bundling rewrites those paths to .next/... which does not exist →
  // "Cannot find module '.next/worker-script/node/index.js'".
  serverExternalPackages: [
    "tesseract.js",
    "pdf-parse",
    "pdfjs-dist",
    "sharp",
    "@napi-rs/canvas",
  ],
  // typedRoutes disabled: enabling it creates a .next/types/link.d.ts symlink
  // which OneDrive cannot sync (EINVAL). Disable to keep .next inside the project.
  typedRoutes: false,
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  async redirects() {
    return [
      {
        source: "/dashboard/super",
        destination: "/dashboard/super-admin",
        permanent: false,
      },
      {
        source: "/dashboard/journal",
        destination: "/dashboard/journal/sales-order-payment/advance",
        permanent: false,
      },
      {
        source: "/dashboard/journal/sales-order-payment",
        destination: "/dashboard/journal/sales-order-payment/advance",
        permanent: false,
      },
      {
        source: "/dashboard/journal/purchase-order-payment",
        destination: "/dashboard/journal/purchase-order-payment/advance",
        permanent: false,
      },
      {
        source: "/dashboard/journal/purchase-order-payment/credit",
        destination: "/dashboard/journal/purchase-order-payment/remaining",
        permanent: false,
      },
      {
        source: "/dashboard/ledgers",
        destination: "/dashboard/ledger",
        permanent: false,
      },
      {
        source: "/dashboard/cash-entry",
        destination: "/dashboard/roznamcha/cash-entry",
        permanent: false,
      },
      {
        source: "/dashboard/daily-payment-entry",
        destination: "/dashboard/roznamcha/cash-entry",
        permanent: false,
      },
      {
        source: "/dashboard/roznamcha/daily-payment",
        destination: "/dashboard/roznamcha/cash-entry",
        permanent: false,
      },
      {
        source: "/dashboard/exchange-rates",
        destination: "/dashboard/reports/exchange-rate",
        permanent: false,
      },
      {
        source: "/dashboard/settings/daily-rates",
        destination: "/dashboard/reports/exchange-rate",
        permanent: false,
      },
      {
        source: "/dashboard/new-entry/advance",
        destination: "/dashboard/journal/sales-order-payment/advance",
        permanent: false,
      },
      {
        source: "/dashboard/sales/payment",
        destination: "/dashboard/journal/sales-order-payment/advance",
        permanent: false,
      },
      {
        source: "/dashboard/sales/reports",
        destination: "/dashboard/reports/sales",
        permanent: false,
      },
      {
        source: "/dashboard/containers",
        destination: "/dashboard/shipping-line",
        permanent: false,
      },
      {
        source: "/dashboard/banks",
        destination: "/dashboard/settings/banks",
        permanent: false,
      },
      {
        source: "/dashboard/users/new",
        destination: "/dashboard/new-entry/users/registration",
        permanent: false,
      },
      {
        source: "/dashboard/communication/whatsapp",
        destination: "/dashboard/communication-center",
        permanent: false,
      },
      {
        source: "/dashboard/communication/email",
        destination: "/dashboard/communication-center",
        permanent: false,
      },
      {
        source: "/dashboard/communication/sms",
        destination: "/dashboard/communication-center",
        permanent: false,
      },
      {
        source: "/dashboard/translations",
        destination: "/dashboard/settings/translations",
        permanent: false,
      },
      {
        source: "/dashboard/purchase/local-purchases",
        destination: "/dashboard/purchase/local-purchase",
        permanent: false,
      },
      {
        source: "/dashboard/purchase/new-purchase-booking",
        destination: "/dashboard/purchase",
        permanent: false,
      },
      {
        source: "/dashboard/purchase/purchase-booking-demo",
        destination: "/dashboard/purchase/new-purchase-booking-order",
        permanent: false,
      },
    ];
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
    preloadEntriesOnStart: true,
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
