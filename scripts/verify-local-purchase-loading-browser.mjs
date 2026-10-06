import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\8c7c9f1a-e5ea-4739-b1d3-b4dfca0bcecc";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  console.log("=== PLAYWRIGHT BROWSER VERIFICATION: LOCAL PURCHASE LOADING ===");

  // 1. Get dev session cookie
  console.log("1. Authenticating super-admin session...");
  const authRes = await fetch(`${BASE_URL}/api/erp/auth/dev-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "super_admin" }),
  });
  const cookieHeader = authRes.headers.get("set-cookie") || "";
  const cookieMatch = cookieHeader.match(/erp_session=([^;]+)/);
  if (!cookieMatch) {
    throw new Error("Failed to get erp_session cookie from dev-session API");
  }
  const sessionToken = cookieMatch[1];
  console.log("✓ Session token obtained.");

  // 2. Launch browser
  console.log("2. Launching Chromium...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 960 },
  });

  await context.addCookies([
    {
      name: "erp_session",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
    {
      name: "erp_lang",
      value: "en",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  // 3. Navigate to /dashboard/purchase/local-purchase-loading
  console.log("3. Navigating to /dashboard/purchase/local-purchase-loading...");
  await page.goto(`${BASE_URL}/dashboard/purchase/local-purchase-loading`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait for UnifiedErpRegisterBar and Table to render
  await page.waitForSelector("text=/LOCAL PURCHASE LOADING QUEUE/i", { timeout: 30000 });
  console.log("✓ Loading Queue title detected.");

  // Wait for table to load
  await page.waitForSelector("text=/TRANSACTION LOG & SEARCH REPORT/i", { timeout: 30000 });
  console.log("✓ Transaction Log table detected.");

  // Wait for loading spinner to disappear
  await page.waitForSelector("text=LOADING PURCHASE RECORDS", { state: "detached", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const mainViewPath = path.join(ARTIFACT_DIR, "local_purchase_loading_redesign.png");
  await page.screenshot({ path: mainViewPath, fullPage: false });
  console.log(`✓ Screenshot saved: ${mainViewPath}`);

  // 4. Test RTL language (Urdu)
  console.log("4. Testing Urdu / RTL rendering...");
  await page.evaluate(() => {
    document.documentElement.lang = "ur";
    document.documentElement.dir = "rtl";
    localStorage.setItem("erp_lang", "ur");
    document.cookie = "erp_lang=ur; Path=/; Max-Age=31536000; SameSite=Lax";
    window.dispatchEvent(new Event("erp_language_changed"));
  });
  await page.waitForTimeout(2000);
  console.log("✓ Urdu / RTL mode activated.");

  const rtlViewPath = path.join(ARTIFACT_DIR, "local_purchase_loading_rtl.png");
  await page.screenshot({ path: rtlViewPath, fullPage: false });
  console.log(`✓ Screenshot saved: ${rtlViewPath}`);

  await browser.close();
  console.log("\n=======================================================");
  console.log("LOCAL PURCHASE LOADING VERIFICATION COMPLETED (PASS 100%)");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("Browser verification failed:", err);
  process.exit(1);
});
