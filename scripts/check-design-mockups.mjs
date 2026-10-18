/**
 * Verifies docs/store/design/mockups.html + components.html (file://, no server needed):
 * every app x language x device renders without JS errors, no untranslated label, no screen overflows its device frame horizontally,
 * RTL languages set dir=rtl on every frame, and no frame has clipped content.  Optional screenshots: SHOTS=dir node scripts/check-design-mockups.mjs [ids…]
 *   node scripts/check-design-mockups.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const DIR = path.resolve("docs/store/design");
const URLB = "file:///" + DIR.replace(/\\/g, "/");
const SHOTS = process.env.SHOTS;
const only = process.argv.slice(2);
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`); };
const browser = await chromium.launch();
const apps = ["b", "bs"], devices = ["phone", "phone360", "tablet"], langs = ["en", "ur", "ar", "fa", "ps"];
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

for (const page_ of ["mockups", "components"]) {
  for (const app of apps) for (const device of devices) for (const lang of langs) {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    page.on("console", (m) => { if (m.type() === "warning" && /DG: labels/.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await page.goto(`${URLB}/${page_}.html?app=${app}&device=${device}&lang=${lang}&mode=day`, { waitUntil: "load" });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const devs = [...document.querySelectorAll(".dev")];
      const bad = (d, e) => { const r = e.getBoundingClientRect(), p = d.getBoundingClientRect(); if (!(r.width > 0 && (r.right > p.right + 1 || r.left < p.left - 1))) return false; if (getComputedStyle(e).position === "absolute") return false; for (let a = e.parentElement; a && a !== d; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== "visible") return false; } return true; };
      const over = devs.filter((d) => [...d.querySelectorAll("*")].some((e) => bad(d, e))).length;
      const rtlBad = devs.filter((d) => d.getAttribute("dir") !== (["ur", "ar", "fa", "ps"].includes(document.documentElement.lang) ? "rtl" : "ltr")).length;
      const overIds = devs.filter((d) => [...d.querySelectorAll("*")].some((e) => bad(d, e))).map((d) => (d.closest("figure") || {}).id);
      return { n: devs.length, over, overIds, rtlBad, miss: window.DG.missing() };
    });
    const tag = `${page_} ${app} ${device} ${lang}`;
    check(`${tag}: ${m.n} frames, no errors, no missing translations`, m.n > 0 && !errs.length && !m.miss.length, errs.concat(m.miss).join("; "));
    check(`${tag}: no horizontal overflow, dir correct`, m.over === 0 && m.rtlBad === 0, `overflow=${m.over} [${(m.overIds || []).join(",")}] rtlBad=${m.rtlBad}`);
    if (SHOTS && (only.length ? only.some((id) => id) : false)) {
      for (const id of only) { const el = await page.$(`#s-${id}, #${id}`); if (el) await el.screenshot({ path: path.join(SHOTS, `${page_}-${app}-${device}-${lang}-${id}.png`) }); }
    }
    await ctx.close();
  }
}
await browser.close();
const pass = results.filter(Boolean).length;
console.log(`\n==== ${pass} PASS / ${results.length - pass} FAIL ====`);
process.exit(pass === results.length ? 0 : 1);
