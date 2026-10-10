#!/usr/bin/env node
/**
 * DigiTic mobile app — choose which ERP the app talks to. ONE ERP, three separately configured connections:
 *   production (default; the only target a store release may use) → https://api.dgt.llc
 *   eps        → the EPS test server, URL supplied by the developer in DIGITIC_EPS_URL (https only)
 *   local      → the developer's own ERP (http://10.0.2.2:3000 = the PC's localhost:3000 seen from an Android emulator);
 *                plain http is allowed ONLY in debug builds (android/app/src/debug network security config)
 *
 *   node scripts/mobile-env.mjs production            writes capacitor.config.json
 *   node scripts/mobile-env.mjs eps|local             developer / tester builds (debug only)
 *   node scripts/mobile-env.mjs production --release  refuses anything but production (used before bundleRelease / archive)
 * then: npx cap sync android   (or: npx cap copy ios on a Mac)
 */
import fs from "node:fs";

const envName = (process.argv[2] || "production").toLowerCase();
const release = process.argv.includes("--release");
const envs = JSON.parse(fs.readFileSync("mobile/environments.json", "utf8"));
const e = envs[envName];
if (!e) { console.error(`Unknown environment "${envName}". Use: ${Object.keys(envs).join(", ")}`); process.exit(2); }
if (release && envName !== "production") { console.error("A store release must be built against production only."); process.exit(2); }

let url = e.url;
if (e.urlEnv) {
  url = process.env[e.urlEnv];
  if (!url) { console.error(`Set ${e.urlEnv} to the ${envName} ERP URL first.`); process.exit(2); }
}
if (e.requireHttps && !/^https:\/\//i.test(url)) { console.error(`${envName} must use https://`); process.exit(2); }
if (envName === "production" && url !== "https://api.dgt.llc") { console.error("production URL is fixed to https://api.dgt.llc"); process.exit(2); }
const host = new URL(url).hostname;

const cfg = JSON.parse(fs.readFileSync("capacitor.config.json", "utf8"));
cfg.appId = "com.dgt.digitic";
cfg.appName = "DigiTic";
cfg.webDir = "mobile-shell";
cfg.server = {
  url,
  androidScheme: "https",
  iosScheme: "https",
  allowNavigation: e.allowNavigation || [host],
  errorPath: "offline.html",
  ...(e.cleartext ? { cleartext: true } : {}),
};
cfg.android = { ...cfg.android, allowMixedContent: false, captureInput: true };
fs.writeFileSync("capacitor.config.json", JSON.stringify(cfg, null, 2) + "\n");
console.log(`DigiTic → ${envName}: ${url}`);
