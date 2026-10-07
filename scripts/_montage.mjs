// DEV-only: build one contact-sheet PNG from many screenshots. Usage: node _montage.mjs OUT.png COLS CELL_W file1 file2 ...
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
const [out, cols, cellW, ...files] = process.argv.slice(2);
const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:6px;padding:6px;font:11px sans-serif;color:#ddd">` +
  files.map((f) => `<div><div style="padding:2px 4px;white-space:nowrap;overflow:hidden">${path.basename(f).replace(/^_dashboard_/, "").slice(0, 70)}</div><img src="file:///${path.resolve(f).split(String.fromCharCode(92)).join("/")}" style="width:${cellW}px;display:block"></div>`).join("") + "</body></html>";
const tmp = path.join(path.dirname(path.resolve(out)), "_montage.html"); fs.writeFileSync(tmp, html);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Number(cols) * (Number(cellW) + 6) + 6, height: 800 } });
await p.goto("file:///" + tmp.split(String.fromCharCode(92)).join("/")); await p.waitForTimeout(800);
await p.screenshot({ path: out, fullPage: true }); await b.close(); console.log("montage", out);
