import { chromium } from "playwright";
import fs from "node:fs";
const html = fs.readFileSync(process.argv[2], "utf8");
const outDir = process.argv[3];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
await page.addStyleTag({ content: ".wrap{padding:0!important}.page{box-shadow:none!important;border:none!important;width:210mm!important;min-height:297mm!important;padding:11mm!important}" });
const pmm = await page.evaluate(() => { const d=document.createElement('div'); d.style.cssText='width:100mm;position:absolute;left:-9999px'; document.body.appendChild(d); const w=d.getBoundingClientRect().width/100; d.remove(); return w; });
const A4w = Math.round(210*pmm), A4h = Math.round(297*pmm);
await page.setViewportSize({ width: A4w, height: A4h * 2 });
// page 1: top A4h ; page 2: from the forced break
const brkTop = await page.evaluate(() => {
  const p = document.querySelector('.page'); const b = document.querySelector('.section-card--break');
  return Math.round(b.getBoundingClientRect().top + scrollY - (p.getBoundingClientRect().top + scrollY));
});
await page.screenshot({ path: `${outDir}/cb-page1.png`, clip: { x: 0, y: 0, width: A4w, height: A4h } });
await page.screenshot({ path: `${outDir}/cb-page2.png`, clip: { x: 0, y: brkTop, width: A4w, height: A4h } });
console.log("A4:", A4w, "x", A4h, "| break at y=", brkTop, "| page1 used", Math.round(brkTop/A4h*100)+"%");
await browser.close();
