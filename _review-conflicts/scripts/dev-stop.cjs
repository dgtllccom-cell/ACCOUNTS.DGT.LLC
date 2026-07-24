/* eslint-disable no-console */
/**
 * Stops the Next.js dev server whose PID is stored in `.next-dev.pid`.
 * Intended to pair with `scripts/dev-detached.cjs` (but works for any PID file content).
 *
 * Run:
 *   node scripts/dev-stop.cjs
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const cwd = process.cwd();
const pidPath = path.join(cwd, ".next-dev.pid");

// Self-healing: Find and kill any zombie processes occupying port 3000 on Windows
try {
  const port = 3000;
  const netstatOut = execSync("netstat -ano").toString();
  const lines = netstatOut.split("\n");
  const pidsToKill = new Set();

  for (const line of lines) {
    if (line.includes(`:${port}`) || line.includes(" 3000 ")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const pidStr = parts[parts.length - 1];
        const p = Number(pidStr);
        if (p && !Number.isNaN(p) && p !== process.pid) {
          pidsToKill.add(p);
        }
      }
    }
  }

  for (const p of pidsToKill) {
    console.log(`[dev-stop] Found process ${p} using port ${port}. Terminating...`);
    try {
      execSync(`taskkill /F /PID ${p}`);
      console.log(`[dev-stop] Terminated process ${p}.`);
    } catch (err) {
      // ignore
    }
  }
} catch (e) {
  // ignore
}

function isPidRunning(pid) {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

if (!fs.existsSync(pidPath)) {
  console.log("[dev-stop] No pid file found (.next-dev.pid) or port 3000 cleared. Ready to start.");
  process.exit(0);
}

const raw = String(fs.readFileSync(pidPath, "utf8")).trim();
const pid = Number(raw);
if (!pid || Number.isNaN(pid)) {
  console.log(`[dev-stop] invalid pid file contents: "${raw}". Removing pid file.`);
  safeUnlink(pidPath);
  process.exit(0);
}

if (!isPidRunning(pid)) {
  console.log(`[dev-stop] pid ${pid} is not running. Removing stale pid file.`);
  safeUnlink(pidPath);
  process.exit(0);
}

console.log(`[dev-stop] stopping dev server pid ${pid}...`);

try {
  // Default signal (SIGTERM) on most platforms.
  process.kill(pid);
} catch (err) {
  console.warn("[dev-stop] failed to stop process:", err?.message || err);
  process.exit(1);
}

const start = Date.now();
const timeoutMs = 2500;
const pollMs = 150;

const timer = setInterval(() => {
  if (!isPidRunning(pid)) {
    clearInterval(timer);
    safeUnlink(pidPath);
    console.log("[dev-stop] stopped.");
    return;
  }

  if (Date.now() - start > timeoutMs) {
    clearInterval(timer);
    try {
      process.kill(pid, "SIGKILL");
      safeUnlink(pidPath);
      console.log("[dev-stop] force-stopped.");
    } catch (err) {
      console.warn("[dev-stop] failed to force-stop process:", err?.message || err);
      process.exit(1);
    }
  }
}, pollMs);

