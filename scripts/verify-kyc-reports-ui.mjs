import { chromium } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  
  // 1. Desktop test (1440x900)
  const contextDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageDesktop = await contextDesktop.newPage();
  
  console.log("Logging in as Super Admin on desktop...");
  await pageDesktop.goto("http://localhost:3000/auth/login", { waitUntil: "domcontentloaded" });
  await pageDesktop.waitForTimeout(1000);
  const superAdminTab = pageDesktop.locator('button:has-text("Super Admin")').first();
  if (await superAdminTab.count() > 0) {
    await superAdminTab.click();
    await pageDesktop.waitForTimeout(500);
  }
  await pageDesktop.fill('#identifier', "superadmin@damaan.com");
  await pageDesktop.fill('#password', "Admin@123");
  await pageDesktop.click('button[type="submit"]');
  await pageDesktop.waitForTimeout(4000);
  console.log("Logged in URL:", pageDesktop.url());

  console.log("Navigating to KYC Reports on desktop...");
  await pageDesktop.goto("http://localhost:3000/dashboard/kyc-reports", { waitUntil: "domcontentloaded", timeout: 30000 });
  await pageDesktop.waitForTimeout(2500);
  
  await pageDesktop.screenshot({ path: "C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/kyc_reports_desktop_updated.png", fullPage: true });
  console.log("Saved desktop screenshot.");

  const cookies = await contextDesktop.cookies();
  
  // 2. Mobile test (390x844)
  const contextMobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await contextMobile.addCookies(cookies);
  const pageMobile = await contextMobile.newPage();
  
  console.log("Navigating to KYC Reports on mobile...");
  await pageMobile.goto("http://localhost:3000/dashboard/kyc-reports", { waitUntil: "domcontentloaded", timeout: 30000 });
  await pageMobile.waitForTimeout(2500);
  
  await pageMobile.screenshot({ path: "C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/kyc_reports_mobile_updated.png", fullPage: true });
  console.log("Saved mobile screenshot.");

  await browser.close();
  console.log("Verification finished successfully!");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
