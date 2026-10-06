import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  // In some Windows/sandboxed environments, spawning esbuild can fail with EPERM.
  // We disable Vite's built-in esbuild transforms and use SWC for TS/JS transforms instead.
  esbuild: false,
  plugins: [
    swc.vite({
      // Avoid inheriting a module type from any external swc config.
      module: { type: "es6" },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    pool: "threads",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },

  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
