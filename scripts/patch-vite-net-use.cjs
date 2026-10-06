/**
 * Patch Vite's Windows safeRealpath optimization that calls `child_process.exec("net use")`.
 *
 * In restricted environments (e.g. Codex Windows sandbox), Node's child_process spawning
 * can be blocked, causing Vitest/Vite config loading to fail with `spawn EPERM`.
 *
 * This patch disables the network-drive mapping optimization and falls back to
 * `fs.realpathSync.native` (or `fs.realpathSync` when native has the EISDIR issue).
 *
 * Idempotent: safe to run multiple times.
 */

const fs = require("node:fs");
const path = require("node:path");

const target = path.join(
  process.cwd(),
  "node_modules",
  "vite",
  "dist",
  "node",
  "chunks",
  "config.js",
);

const MARK = "CODEX_PATCH_NO_NET_USE";

function main() {
  if (!fs.existsSync(target)) {
    // Nothing to patch (deps not installed or different layout)
    return;
  }

  const src = fs.readFileSync(target, "utf8");
  if (src.includes(MARK)) return;

  const needle = 'exec("net use", (error$1, stdout) => {';
  const start = src.indexOf(needle);
  if (start === -1) {
    // Unexpected Vite build; don't fail installs/tests.
    return;
  }

  // Find the close of the exec(...) call. In current Vite builds it's a single `});` line.
  const endLine = "\n\t});";
  const end = src.indexOf(endLine, start);
  if (end === -1) return;

  const replacement =
    `\n\t// ${MARK}: disable child_process exec('net use') in restricted environments.\n` +
    `\t// Fall back to native realpath (network drive mapping won't be normalized).\n` +
    `\tsafeRealpathSync = fs.realpathSync.native;\n`;

  const patched = src.slice(0, start) + replacement + src.slice(end + endLine.length);
  fs.writeFileSync(target, patched, "utf8");
}

main();

