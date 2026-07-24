/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const { chromium } = require("playwright");
  const base = process.env.ERP_BASE_URL || "http://localhost:3000";
  const outDir = path.resolve(".tmp", "ui-verify");
  fs.mkdirSync(outDir, { recursive: true });

  const chromeCandidates = [
    "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
    "C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"
  ];
  const chromePath = chromeCandidates.find((p) => fs.existsSync(p)) || undefined;
  const browser = await chromium.launch(chromePath ? { executablePath: chromePath } : undefined);
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  async function shot(name) {
    const p = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: p, fullPage: true });
    console.log("SHOT", p);
  }

  await page.goto(`${base}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await shot("01-login");

  const idInput = await page.$('input[placeholder*="user" i],input[placeholder*="email" i]');
  const pwInput = await page.$('input[type="password"]');
  if (!idInput || !pwInput) {
    throw new Error("Login inputs not found (check selectors).");
  }

  await idInput.fill("superadmin");
  await pwInput.fill("admin123");

  const btn = await page.$(
    'button:has-text("Sign In"),button:has-text("Sign in"),button:has-text("Login"),button:has-text("Log in")'
  );
  if (!btn) {
    throw new Error("Sign in button not found (check selectors).");
  }
  await btn.click();
  await page.waitForTimeout(1500);

  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await shot("02-dashboard");

  const pages = [
    ["/dashboard/new-entry/users/registration", "03-user-registration"],
    ["/dashboard/roznamcha/cash-entry", "04-cash-entry"],
    ["/dashboard/new-entry/branches/super-admin", "05-super-admin-branch"],
    ["/dashboard/new-entry/branch-entry/country-branch", "06-country-branch"],
    ["/dashboard/new-entry/branch-entry/city-branch", "07-city-branch"],
    ["/dashboard/ledger/super-admin", "08-ledger-super-admin"],
    ["/dashboard/ledger/country", "09-ledger-country"],
    ["/dashboard/ledger/branch", "10-ledger-branch"]
  ];

  for (const [route, name] of pages) {
    await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await shot(name);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
