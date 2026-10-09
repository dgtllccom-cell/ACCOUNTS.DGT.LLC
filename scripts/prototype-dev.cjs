const { spawn } = require("node:child_process");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const PORT = 8765;
const HOST = "0.0.0.0";

process.env.DGT_PROTOTYPE_MODE = "1";
process.env.NEXT_PUBLIC_DGT_PROTOTYPE_MODE = "1";
process.env.APP_ENV = "development";
process.env.NEXT_PUBLIC_APP_ENV = "development";
process.env.ALLOW_DEMO_AUTH = "true";
process.env.NEXT_TELEMETRY_DISABLED = "1";
process.env.NODE_ENV = "development";

// Keep Next from re-loading any live .env.local credentials: existing process
// values win over dotenv, so explicitly blank every live integration key family.
for (const key of Object.keys(process.env)) {
  if (/(DATABASE|SUPABASE|OPENAI|ANTHROPIC|GEMINI|GOOGLE_.*API|TWILIO|WHATSAPP|META_|SMTP|IMAP|MAIL_|RESEND|SENDGRID|AWS_|AZURE_|STRIPE|PAYPAL|BOOTSTRAP_|ERP_SESSION_SECRET)/i.test(key)) {
    process.env[key] = "";
  }
}
// Re-assert prototype flags after the scrub.
process.env.DGT_PROTOTYPE_MODE = "1";
process.env.NEXT_PUBLIC_DGT_PROTOTYPE_MODE = "1";
process.env.APP_ENV = "development";
process.env.NEXT_PUBLIC_APP_ENV = "development";
process.env.ALLOW_DEMO_AUTH = "true";

function lanIp() {
  for (const group of Object.values(os.networkInterfaces())) {
    for (const item of group || []) {
      if (item && item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254.")) return item.address;
    }
  }
  return null;
}

function waitForServer(url, attempts = 120) {
  return new Promise((resolve) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 400) return resolve(true);
        if (--attempts <= 0) return resolve(false);
        setTimeout(tick, 1000);
      });
      req.on("error", () => {
        if (--attempts <= 0) return resolve(false);
        setTimeout(tick, 1000);
      });
      req.setTimeout(900, () => req.destroy());
    };
    tick();
  });
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", "-H", HOST, "-p", String(PORT)], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
  shell: false,
});

child.on("exit", (code) => process.exit(code ?? 0));

(async () => {
  const local = `http://127.0.0.1:${PORT}/prototype`;
  const ok = await waitForServer(local);
  if (!ok) {
    console.error("\n[Prototype] Server did not become ready. Keep this window open and review the error above.");
    return;
  }
  const ip = lanIp();
  console.log("\n============================================================");
  console.log(" DGT ERP FULL UI PROTOTYPE IS READY");
  console.log(" DESIGN ONLY - NO LIVE DATABASE / LEDGER / STOCK WRITES");
  console.log("============================================================");
  console.log("Computer (Design Studio with device selector):", local);
  console.log("Direct ERP view (without design controls):", `http://127.0.0.1:${PORT}/dashboard`);
  if (ip) {
    console.log("Phone / iPad / Samsung:", `http://${ip}:${PORT}/dashboard`);
    console.log("Use the SAME Wi-Fi. Keep this window open while testing.");
  } else {
    console.log("Phone link: no LAN IPv4 detected. Connect this computer to Wi-Fi/Ethernet and restart.");
  }
  console.log("============================================================\n");
  openBrowser(local);
})();
