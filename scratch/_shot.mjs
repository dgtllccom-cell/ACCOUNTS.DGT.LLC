import { chromium } from "playwright";
import fs from "node:fs";
const htmlPath = process.argv[2], outDir = process.argv[3];
const html = fs.readFileSync(htmlPath, "utf8");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
// A4 @ 96dpi = 794 x 1123
const page = await browser.newPage({ viewport: { width: 820, height: 1160 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
await page.addStyleTag({ content: ".wrap{padding:0!important}.page{box-shadow:none!important;border:none!important;width:210mm!important;padding:11mm!important}" });
// full page screenshot
await page.screenshot({ path: `${outDir}/cb-print-full.png`, fullPage: true });
// measure heights to report where the natural break lands
const m = await page.evaluate(() => {
  const pmm = (() => { const d=document.createElement('div'); d.style.cssText='width:100mm;position:absolute;left:-9999px'; document.body.appendChild(d); const w=d.getBoundingClientRect().width/100; d.remove(); return w; })();
  const page = document.querySelector('.page');
  const printH = (297-22)*pmm;
  const brk = document.querySelector('.section-card--break');
  const brkTop = brk ? brk.getBoundingClientRect().top + scrollY - (page.getBoundingClientRect().top+scrollY) : null;
  return { pxPerMm:+pmm.toFixed(2), printablePageHpx:Math.round(printH), totalContentHpx: page.scrollHeight,
           page1FillPct: brkTop!=null ? Math.round(brkTop/printH*100) : null,
           page2ContentHpx: brkTop!=null ? Math.round(page.scrollHeight - brkTop) : null,
           page2FillPct: brkTop!=null ? Math.round((page.scrollHeight-brkTop)/printH*100) : null };
});
console.log(JSON.stringify(m,null,1));
await browser.close();
