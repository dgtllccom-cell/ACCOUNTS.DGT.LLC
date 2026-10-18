// Builds the three DGT.llc B / BS mobile concept boards.
//   node docs/design/mobile-concepts/build.mjs [a|b|c ...]      → dist/<concept>-<lang>.html, dist/png/<concept>/<lang>-<screen>.png
// Needs Playwright (already a dev dependency). Pure DOM → no images, so scripts/export-figma-scene.mjs can turn the same pages into editable Figma layers.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { S } from "./lib/core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, "dist");
fs.mkdirSync(path.join(DIST, "png"), { recursive: true });
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ["a", "b", "c"];
const LANGS = ["en", "ur"];
const NAMES = {
  login: "1 · Login", activation: "2 · Device activation", dashB: "3 · Dashboard — B Business", dashBS: "4 · Dashboard — BS Shipping", menu: "5 · Navigation menu",
  order: "6 · Customer order", track: "7 · Shipment tracking", report: "8 · Report", dashTab: "T1 · Tablet dashboard", trackTab: "T2 · Tablet tracking",
};
const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,"Noto Sans Arabic","Segoe UI",Tahoma,sans-serif;background:#D8DEE9;padding:36px}
body[dir=rtl]{font-family:"Noto Sans Arabic","Segoe UI",Tahoma,Inter,sans-serif}
body[dir=rtl] .screen{line-height:1.55}
h1.t{font-size:28px;font-weight:800;margin-bottom:4px}p.tg{font-size:14px;margin-bottom:26px}
.grid{display:flex;flex-wrap:wrap;gap:34px;align-items:flex-start}
figure{display:flex;flex-direction:column;gap:10px}figcaption{font-size:13px;font-weight:700;color:#33415C}
.screen{width:390px;height:844px;overflow:hidden;border-radius:38px;display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(8,20,45,.25);border:1px solid rgba(0,0,0,.08)}
.screen.tablet{width:834px;height:1112px;border-radius:30px}
.sbi{display:flex;align-items:center;gap:3px}.sbb{width:4px;height:7px;background:currentColor;border-radius:1px}.sbb.s2{height:10px}.sbb.s3{height:13px}
.sbbat{width:24px;height:12px;border:1.5px solid currentColor;border-radius:4px;margin-inline-start:6px}
`;

for (const id of wanted) {
  const mod = await import(pathToFileURL(path.join(HERE, "concepts", id + ".mjs")).href);
  for (const lang of LANGS) {
    const rtl = lang !== "en";
    const str = S[lang];
    const ph = mod.screens(lang, str), tb = mod.tablets ? mod.tablets(lang, str) : {};
    const cls = "c" + id.toUpperCase();
    const fig = (k, html, tablet) => `<figure><figcaption>${NAMES[k] || k}</figcaption><div class="screen ${cls} ${tablet ? "tablet" : ""}" data-screen="${k}" dir="${rtl ? "rtl" : "ltr"}" lang="${lang}">${html}</div></figure>`;
    const html = `<!doctype html><html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${mod.meta.name} — ${lang}</title><style>${BASE_CSS}${mod.css}</style></head>
<body dir="${rtl ? "rtl" : "ltr"}" style="background:${mod.meta.bg}"><style>h1.t{color:${mod.meta.ink || "#0B1B3A"}}p.tg{color:${mod.meta.sub || "#51607A"}}figcaption{color:${mod.meta.sub || "#33415C"}}</style><h1 class="t">Concept ${id.toUpperCase()} — ${mod.meta.name} (${lang === "en" ? "English · LTR" : "اردو · RTL"})</h1><p class="tg">${mod.meta.tagline} · ${str.sampleNote}</p>
<div class="grid">${Object.entries(ph).map(([k, h]) => fig(k, h, false)).join("")}${Object.entries(tb).map(([k, h]) => fig(k, h, true)).join("")}</div></body></html>`;
    fs.writeFileSync(path.join(DIST, `${id}-${lang}.html`), html);
  }
}

const browser = await chromium.launch();
for (const id of wanted) {
  fs.mkdirSync(path.join(DIST, "png", id), { recursive: true });
  for (const lang of LANGS) {
    const ctx = await browser.newContext({ viewport: { width: 2000, height: 1200 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(path.join(DIST, `${id}-${lang}.html`)).href);
    await page.waitForTimeout(400);
    const screens = await page.$$(".screen");
    for (const el of screens) {
      const name = await el.getAttribute("data-screen");
      await el.screenshot({ path: path.join(DIST, "png", id, `${lang}-${name}.png`) });
    }
    await page.screenshot({ path: path.join(DIST, "png", id, `${lang}-BOARD.png`), fullPage: true });
    await ctx.close();
    console.log("ok", id, lang, screens.length, "screens");
  }
}
await browser.close();
