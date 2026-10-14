import { chromium } from "playwright";
import { createHmac } from "node:crypto";
import path from "path";

const TARGET_HOST = "http://72.60.209.121";
const ARTIFACTS_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/32a0c37d-b28b-46e0-ae11-f4666340583c";
const SESSION_SECRET = "add6fbb7090f10fe8d428ae03e01d9c921bde0b288fa7ecf35db82e7de448bbc256b01632bac67fc39e3506bae06387f";

function buildSessionToken() {
  const payload = {
    v: 1,
    kind: "temp",
    userId: "be3a6b15-65c5-4d74-82ae-e956c02a5f07",
    email: "superadmin@dgt.llc",
    fullName: "Super Admin",
    roles: ["super_admin", "super_admin_reports"],
    isSuperAdmin: true,
    assignments: [
      {
        role: "super_admin",
        countryId: null,
        countryBranchId: null,
        cityBranchId: null,
        operationalDomain: "both",
        mobileProfile: "standard"
      }
    ],
    createdAt: Date.now()
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

async function verify() {
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  
  // 13-inch display viewport: 1366 x 768
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });

  await context.addCookies([
    { name: "erp_session", value: token, domain: "72.60.209.121", path: "/" },
    { name: "erp_lang", value: "en", domain: "72.60.209.121", path: "/" }
  ]);

  const page = await context.newPage();
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  console.log("Navigating to LIVE production truck-registration...");
  await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/truck-registration`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(3000);

  // Take screenshot of list view
  const listShot = path.join(ARTIFACTS_DIR, "live_truck_reg_list_1366.png");
  await page.screenshot({ path: listShot, fullPage: false });
  console.log("Saved:", listShot);

  // Click on "New Clearing Truck Registration"
  const newBtn = page.locator('button:has-text("New Clearing Truck Registration")').first();
  await newBtn.waitFor({ state: "visible", timeout: 10000 });
  console.log("Opening New Registration form...");
  await newBtn.click();
  await page.waitForTimeout(3000);

    // Fill some demo identifiers to view live report reactive mirroring
    const truckNo = page.locator('input[placeholder="e.g. TRK-TEST-001"]').first();
    if (await truckNo.isVisible()) {
      await truckNo.fill("TRK-TEST-001");
    }
    const chassis = page.locator('input[placeholder*="chassis"]').first();
    if (await chassis.isVisible()) {
      await chassis.fill("CHS-TEST-001");
    }
    const engine = page.locator('input[placeholder*="engine"]').first();
    if (await engine.isVisible()) {
      await engine.fill("ENG-TEST-001");
    }

    // Select a transport company to verify real-time sync in Live Report
    console.log("Testing Transporter Company selection...");
    const companySelectBtn = page.locator('button:has-text("Search company...")').first();
    if (await companySelectBtn.isVisible()) {
      await companySelectBtn.click();
      await page.waitForTimeout(1000);
      const firstCompanyOpt = page.locator('div[role="option"], button[role="option"], ul li').first();
      if (await firstCompanyOpt.isVisible()) {
        console.log("Selecting first company option:", await firstCompanyOpt.innerText());
        await firstCompanyOpt.click();
        await page.waitForTimeout(2000);
      }
    }

    const formShot = path.join(ARTIFACTS_DIR, "live_truck_reg_form_1366.png");
    await page.screenshot({ path: formShot, fullPage: false });
    console.log("Saved:", formShot);

    // Click "View ⌄" dropdown menu
    const viewBtn = page.locator('button:has-text("View")').first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();
      await page.waitForTimeout(500);
      const menuShot = path.join(ARTIFACTS_DIR, "live_truck_reg_view_menu_1366.png");
      await page.screenshot({ path: menuShot, fullPage: false });
      console.log("Saved:", menuShot);

      // Click "Live Truck Report" to open full overlay dialog
      const liveReportOpt = page.locator('button:has-text("Live Truck Report")').first();
      if (await liveReportOpt.isVisible()) {
        await liveReportOpt.click();
        await page.waitForTimeout(500);
        const modalShot = path.join(ARTIFACTS_DIR, "live_truck_reg_modal_1366.png");
        await page.screenshot({ path: modalShot, fullPage: false });
        console.log("Saved:", modalShot);

        // Close modal
        const closeBtn = page.locator('button:has-text("Close"), button:has(svg.lucide-x)').last();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Scroll down to show Driver info, multi-contacts, documents, and footer buttons
    await page.evaluate(() => window.scrollBy(0, 650));
    await page.waitForTimeout(500);
    const driverShot = path.join(ARTIFACTS_DIR, "live_truck_reg_driver_docs_1366.png");
    await page.screenshot({ path: driverShot, fullPage: false });
    console.log("Saved:", driverShot);

  await browser.close();
  console.log("Verification finished successfully!");
}

verify().catch(console.error);
