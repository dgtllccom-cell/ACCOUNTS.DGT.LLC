// One comparison sheet: the same three screens (login · dashboard · shipment tracking) in the three concepts, English and Urdu.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url"; import { chromium } from "playwright";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const D = path.join(HERE, "dist");
const NAMES = { a: "A — Harbour Ledger", b: "B — Night Dock", c: "C — Manifest" };
for (const lang of ["en", "ur"]) {
  const rows = ["a", "b", "c"].map((id) => `<div class="r"><div class="t">${NAMES[id]}</div><div class="s">${["login", "activation", "dashB", "menu", "order", "track"].map((n) => `<img src="${pathToFileURL(path.join(D, "png", id, lang + "-" + n + ".png")).href}">`).join("")}</div></div>`).join("");
  const html = `<body style="margin:0;background:#fff;font-family:Inter,Segoe UI,sans-serif;padding:30px;width:2760px"><h1 style="margin:0 0 6px;font-size:34px">DGT.llc B / BS — three design concepts · ${lang === "en" ? "English (LTR)" : "اردو (RTL)"}</h1><div style="color:#667;margin-bottom:24px">Login · Device activation · Dashboard · Menu · Customer order · Shipment tracking — sample data for design review</div>${rows}<style>.r{margin-bottom:34px}.t{font-size:22px;font-weight:800;margin-bottom:12px}.s{display:flex;gap:22px}img{width:420px;height:auto;border-radius:30px;box-shadow:0 10px 30px rgba(0,0,0,.18)}</style></body>`;
  fs.writeFileSync(path.join(D, `compare-${lang}.html`), html);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2820, height: 1000 } });
  await p.goto(pathToFileURL(path.join(D, `compare-${lang}.html`)).href); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(D, `COMPARE-${lang}.png`), fullPage: true }); await b.close(); console.log("ok", lang);
}
