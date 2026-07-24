/* eslint-disable no-console */
/**
 * Workaround for environments that block Node IPC (child_process.fork with stdio:'ipc').
 * Next.js `next dev` forks a child process with IPC; in this environment that fails with EPERM.
 *
 * This starts the Next dev server in-process by calling Next's internal `startServer`.
 *
 * Run:
 *   node scripts/dev-single.cjs
 */

const path = require("node:path");
const net = require("node:net");

async function isPortFree(hostname, port) {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (err) => {
      if (err && err.code === "EADDRINUSE") return resolve(false);
      reject(err);
    });
    server.listen(port, hostname, () => {
      server.close(() => resolve(true));
    });
  });
}

async function main() {
  const dir = process.cwd();
  const port = Number(process.env.PORT || 3000);
  // Bind explicitly to IPv4 loopback by default to avoid Windows resolving "localhost" to ::1,
  // which can cause ERR_CONNECTION_REFUSED in some browsers/environments.
  const hostname = process.env.HOSTNAME || "127.0.0.1";

  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  process.env.NEXT_RUNTIME = process.env.NEXT_RUNTIME || "nodejs";
  process.env.NEXT_TELEMETRY_DISABLED = process.env.NEXT_TELEMETRY_DISABLED || "1";

  // Load .env.local / .env.development.local etc the same way Next does.
  try {
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(dir, true);
  } catch (err) {
    console.warn("[dev-single] Failed to load env config:", err?.message || err);
  }

  // Purge stale .next cache to prevent Next.js webpack runtime chunk missing errors (e.g. Cannot find module ./5873.js)
  const fs = require("node:fs");
  const nextDir = path.join(dir, ".next");
  if (process.env.KEEP_NEXT_CACHE !== "1" && fs.existsSync(nextDir)) {
    try {
      fs.rmSync(nextDir, { recursive: true, force: true });
      console.log("[dev-single] Purged stale .next build cache successfully.");
    } catch (cacheErr) {
      console.warn("[dev-single] Cache purge note:", cacheErr?.message || cacheErr);
    }
  }

  const { startServer } = require("next/dist/server/lib/start-server");

  const allowRetry = process.env.NEXT_DEV_ALLOW_RETRY === "1";
  if (!allowRetry) {
    const free = await isPortFree(hostname, port);
    if (!free) {
      console.error(
        `[dev-single] Port ${port} is already in use on ${hostname}. ` +
          `If a dev server is already running, stop it with: npm run dev:stop`
      );
      process.exit(1);
    }
  }

  const displayHost = hostname === "0.0.0.0" ? "localhost" : hostname;
  console.log(`[dev-single] Starting Next.js dev server on http://${displayHost}:${port}`);
  console.log(`[dev-single] Project dir: ${dir}`);
  console.log(`[dev-single] Next binary: ${path.dirname(require.resolve("next/package.json"))}`);

  await startServer({
    dir,
    port,
    hostname,
    allowRetry,
    isDev: true,
  });
}

main().catch((err) => {
  console.error("[dev-single] Failed to start:", err);
  process.exit(1);
});
