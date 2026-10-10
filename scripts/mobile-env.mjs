#!/usr/bin/env node
/**
 * DGT.llc mobile apps — which ERP they talk to. TWO store apps ("DGT.llc B" = Business, "DGT.llc BS" = Business Shipping),
 * ONE ERP (same backend, database, login, permissions). Two connections, kept separate:
 *   production → https://api.dgt.llc  (EPS Production, live) — the only target a store release may use
 *   local      → http://10.0.2.2:3000 (the developer PC's localhost:3000 seen from an Android emulator); plain http is accepted
 *                ONLY by debug builds (android/app/src/debug network security config). Never reachable from a release build.
 *
 *   node scripts/mobile-env.mjs production            writes every app's capacitor.config.json
 *   node scripts/mobile-env.mjs local                 developer / tester builds (debug only)
 *   node scripts/mobile-env.mjs production --release  refuses anything but production (run before bundleRelease / iOS archive)
 * then: npx cap sync android   (iOS, on a Mac: scripts/ios-build-apps.sh)
 */
import fs from "node:fs";
import path from "node:path";

const envName = (process.argv[2] || "production").toLowerCase();
const release = process.argv.includes("--release");
const envs = JSON.parse(fs.readFileSync("mobile/environments.json", "utf8"));
const apps = JSON.parse(fs.readFileSync("mobile/apps.json", "utf8"));
const e = envs[envName];
// local only: DGTLLC_LOCAL_URL=http://10.0.2.2:3260 points an emulator build at a DEV server on another port (http, loopback alias only)
if (envName === "local" && process.env.DGTLLC_LOCAL_URL) {
  if (!/^http:\/\/(10\.0\.2\.2|localhost)(:\d+)?$/.test(process.env.DGTLLC_LOCAL_URL)) { console.error("DGTLLC_LOCAL_URL must be http://10.0.2.2:<port> or http://localhost:<port>"); process.exit(2); }
  e.url = process.env.DGTLLC_LOCAL_URL;
}
if (!e) { console.error(`Unknown environment "${envName}". Use: ${Object.keys(envs).join(", ")}`); process.exit(2); }
if (release && envName !== "production") { console.error("A store release must be built against production only."); process.exit(2); }
if (envName === "production" && e.url !== "https://api.dgt.llc") { console.error("production URL is fixed to https://api.dgt.llc"); process.exit(2); }

const base = JSON.parse(fs.readFileSync("mobile/capacitor.base.json", "utf8"));
const write = (file, obj) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n"); };

for (const [key, app] of Object.entries(apps)) {
  const cfg = {
    appId: app.androidId,
    appName: app.name,
    webDir: "mobile-shell",
    ...base,
    server: {
      url: e.url.replace(/\/$/, "") + app.startPath,
      androidScheme: "https",
      iosScheme: "https",
      allowNavigation: e.allowNavigation,
      errorPath: "offline.html",
      ...(e.cleartext ? { cleartext: true } : {}),
    },
  };
  // the User-Agent tag is a PLATFORM option in Capacitor (top-level appendUserAgent is ignored) — the server reads it to know which store app is calling
  cfg.android = { ...cfg.android, appendUserAgent: app.userAgent };
  cfg.ios = { ...cfg.ios, appendUserAgent: app.userAgent };
  write(`mobile/generated/capacitor.${key}.json`, cfg);
  write(`android/app/src/${app.androidFlavor}/assets/capacitor.config.json`, cfg);
  if (key === "b") write("capacitor.config.json", cfg); // what `cap sync` / `cap copy` reads by default
}
console.log(`DGT.llc B + BS → ${envName}: ${e.url}`);
