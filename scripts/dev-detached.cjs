/* eslint-disable no-console */
/**
 * Starts `scripts/dev-single.cjs` in a detached child process so the shell tool call can return.
 * Writes stdout/stderr into .next-dev.out.log / .next-dev.err.log in the project root.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const cwd = process.cwd();
const outPath = path.join(cwd, ".next-dev.out.log");
const errPath = path.join(cwd, ".next-dev.err.log");
const scriptPath = path.join(cwd, "scripts", "dev-single.cjs");
const pidPath = path.join(cwd, ".next-dev.pid");

function isPidRunning(pid) {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Avoid spawning duplicates: if an existing dev server is already running, do nothing.
if (fs.existsSync(pidPath)) {
  const existingPid = Number(String(fs.readFileSync(pidPath, "utf8")).trim());
  if (isPidRunning(existingPid)) {
    console.log(`[dev-detached] dev server already running (pid ${existingPid})`);
    process.exit(0);
  }
  // Stale pid file.
  try {
    fs.unlinkSync(pidPath);
  } catch {
    // ignore
  }
}

const outFd = fs.openSync(outPath, "a");
const errFd = fs.openSync(errPath, "a");

// Next dev can grow memory over time; raise the V8 heap limit for the detached server
// to avoid frequent "approaching used memory threshold" restarts during local development.
const maxOldSpaceMb = String(process.env.NEXT_DEV_MAX_OLD_SPACE_MB || "4096").trim();
const nodeArgs = [];
if (maxOldSpaceMb && /^\d+$/.test(maxOldSpaceMb)) {
  nodeArgs.push(`--max-old-space-size=${maxOldSpaceMb}`);
}
nodeArgs.push(scriptPath);

const child = spawn(process.execPath, nodeArgs, {
  cwd,
  detached: true,
  stdio: ["ignore", outFd, errFd],
  env: process.env,
  windowsHide: true
});

child.unref();

// Close the parent file descriptors so this launcher can exit immediately.
try {
  fs.closeSync(outFd);
  fs.closeSync(errFd);
} catch {
  // ignore
}

try {
  fs.writeFileSync(pidPath, String(child.pid), "utf8");
} catch {
  // ignore
}

console.log(`[dev-detached] started pid ${child.pid}`);
console.log(`[dev-detached] pid file: ${pidPath}`);
console.log(`[dev-detached] logs: ${outPath}`);
console.log(`[dev-detached] logs: ${errPath}`);

