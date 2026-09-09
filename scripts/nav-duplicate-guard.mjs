#!/usr/bin/env node
/**
 * Navigation duplicate guard — keeps the rendered Main Menu free of the
 * confusing repeated entries the owner asked us to clean up (2026-09-09).
 *
 * Fails (exit 1) when `components/layout/digital-dock-premium-sidebar.tsx`
 * (DAMAN_SIDEBAR_ITEMS — the ONE rendered sidebar, see
 * components/layout/dashboard-frame.tsx) contains:
 *   1. the SAME leaf `href` on two different menu entries, OR
 *   2. the SAME `key` on two menu groups.
 *
 * A genuinely different tab / filter is fine — it has a distinct `href`
 * (e.g. `/dashboard/crm?tab=today` vs `/dashboard/crm?tab=cheques`). Only an
 * EXACT href match is a duplicate. Add a legitimate exception to ALLOW_DUP_HREF
 * below with a one-line reason if two entries must point to the same place.
 */
import fs from "node:fs";

const FILE = "components/layout/digital-dock-premium-sidebar.tsx";
const src = fs.readFileSync(FILE, "utf8");

// Legit same-destination pairs (label → why). Keep this list SHORT.
const ALLOW_DUP_HREF = new Set([
  // (currently none — every function has exactly one menu home)
]);

const fail = [];

// 1. duplicate leaf href
const hrefRe = /label:\s*"([^"]+)"\s*,\s*href:\s*"([^"]+)"/g;
const byHref = new Map();
let m;
while ((m = hrefRe.exec(src))) {
  const [, label, href] = m;
  if (ALLOW_DUP_HREF.has(href)) continue;
  if (!byHref.has(href)) byHref.set(href, []);
  byHref.get(href).push(label);
}
for (const [href, labels] of byHref) {
  if (labels.length > 1) {
    fail.push(`duplicate destination  ${href}\n     ${labels.map((l) => `"${l}"`).join("  |  ")}`);
  }
}

// 2. duplicate group key
const keyRe = /^\s*key:\s*"([^"]+)"/gm;
const keys = new Map();
while ((m = keyRe.exec(src))) {
  keys.set(m[1], (keys.get(m[1]) ?? 0) + 1);
}
for (const [k, n] of keys) {
  if (n > 1) fail.push(`duplicate menu key  "${k}"  (${n}×)`);
}

const leafCount = [...byHref.values()].reduce((a, b) => a + b.length, 0);
if (fail.length) {
  console.error(`\n✗ nav-duplicate-guard FAILED (${FILE}):\n${fail.map((f) => "  - " + f).join("\n")}\n`);
  console.error("  Keep ONE canonical main-menu entry per destination. A different");
  console.error("  ?tab= / filter is not a duplicate. See docs/main-menu-hierarchy.md.\n");
  process.exit(1);
}
console.log(`✓ nav-duplicate-guard passed — ${byHref.size} distinct destinations, ${leafCount} leaf links, no repeats.`);
