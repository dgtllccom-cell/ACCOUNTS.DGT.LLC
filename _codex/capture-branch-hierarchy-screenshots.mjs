import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = "C:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/_codex/previews";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill("#identifier", "superadmin@damaan.com");
  await page.fill("#password", "admin123");
  await page.evaluate(() => {
    const form = document.querySelector("form");
    if (form) form.setAttribute("action", "/api/erp/auth/login?temp=1");
  });
  await Promise.all([
    page.waitForURL("**/dashboard**", { timeout: 30000 }).catch(() => null),
    page.locator("form").first().evaluate((form) => form.requestSubmit())
  ]);

  await page.goto("http://localhost:3000/dashboard/branch-management/general-report", {
    waitUntil: "networkidle",
    timeout: 60000
  });
  await page.screenshot({ path: path.join(outDir, "branch-general-hierarchy.png"), fullPage: true });

  const countrySummary = page.locator("details > summary").first();
  if (await countrySummary.count()) await countrySummary.click();
  await page.waitForTimeout(500);

  const branchSummary = page.locator("details details > summary").first();
  if (await branchSummary.count()) await branchSummary.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, "branch-general-expanded.png"), fullPage: true });

  const firstView = page.getByRole("button", { name: /view/i }).first();
  if (await firstView.count()) {
    await firstView.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(outDir, "branch-general-view-mode.png"), fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    screenshots: [
      path.join(outDir, "branch-general-hierarchy.png"),
      path.join(outDir, "branch-general-expanded.png"),
      path.join(outDir, "branch-general-view-mode.png")
    ]
  }, null, 2));
} finally {
  await browser.close();
}
