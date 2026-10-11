/**
 * Side-by-side proof images: approved preview (left) vs the real ERP page on DEV (right).
 *   PACK=<.../previews> ERP=<dir with <page>-desktop-en-light.png> OUT=<dir> node scripts/dev/purchase-side-by-side.mjs
 * The preview HTML is only rendered to an image here; nothing from it is used in the ERP.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const { PACK, ERP, OUT } = process.env;
if (!PACK || !ERP || !OUT) throw new Error("PACK, ERP and OUT are required");
fs.mkdirSync(OUT, { recursive: true });
const PAGES = [
  ["booking", "DGT_ERP_02_PURCHASE_BOOKING_DETAILS_PREVIEW.html", "Purchase Booking Details"],
  ["payments", "DGT_ERP_03_PURCHASE_PAYMENT_PREVIEW.html", "Purchase Payments"],
  ["orders", "DGT_ERP_04_PURCHASE_ORDER_PAYMENT_PREVIEW.html", "Purchase Orders Payment"],
  ["country", "DGT_ERP_05_COUNTRY_BILL_PAYMENT_PREVIEW.html", "Country Bill Payment"],
  ["loading", "DGT_ERP_06_PURCHASE_LOADING_REPORT_PREVIEW.html", "Purchase Loading Records"],
];
const browser = await chromium.launch();
for (const [key, html, title] of PAGES) {
  const pv = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await pv.goto("file:///" + path.join(PACK, html).replace(/\\/g, "/"));
  await pv.waitForTimeout(500);
  const left = (await pv.screenshot()).toString("base64");
  await pv.close();
  const rightPath = path.join(ERP, `${key}-desktop-en-light.png`);
  if (!fs.existsSync(rightPath)) { console.log("missing", rightPath); continue; }
  const right = fs.readFileSync(rightPath).toString("base64");
  const page = await browser.newPage({ viewport: { width: 2920, height: 990 } });
  await page.setContent(`<body style="margin:0;background:#0b1730;font:600 16px Arial;color:#fff">
    <div style="padding:10px 16px">${title} — left: approved design (preview, sample data) · right: real ERP page (DEV data)</div>
    <div style="display:flex;gap:10px;padding:0 10px"><img style="width:1440px" src="data:image/png;base64,${left}"><img style="width:1440px" src="data:image/png;base64,${right}"></div></body>`);
  await page.screenshot({ path: path.join(OUT, `side-by-side-${key}.png`) });
  await page.close();
  console.log("ok", key);
}
await browser.close();
