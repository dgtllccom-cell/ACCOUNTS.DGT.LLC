import { execSync } from 'child_process';

const SERVER = "root@72.60.209.121";

console.log("Running Supabase DB Probe directly on VPS 72.60.209.121...");

const remoteScript = `
node -e '
const dns = require("dns").promises;
const net = require("net");
const postgres = require("postgres");

const projectRef = "csesvyxqjivnkkozgopt";
const password = "Gulistan%409090";

const hosts = [
  "aws-0-ap-southeast-1.pooler.supabase.com",
  "aws-0-ap-south-1.pooler.supabase.com",
  "aws-0-ap-southeast-2.pooler.supabase.com",
  "aws-1-ap-southeast-2.pooler.supabase.com",
  "aws-0-us-east-1.pooler.supabase.com",
  "aws-0-us-west-1.pooler.supabase.com",
  "aws-0-eu-central-1.pooler.supabase.com",
  "aws-0-eu-west-1.pooler.supabase.com",
  "aws-0-me-central-1.pooler.supabase.com",
  "db.csesvyxqjivnkkozgopt.supabase.co"
];

async function run() {
  for (const host of hosts) {
    let ips = [];
    try {
      ips = await dns.resolve4(host);
    } catch(e) {}
    if (!ips.length) continue;

    for (const port of [6543, 5432]) {
      const connOk = await new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2500);
        socket.on("connect", () => { socket.destroy(); resolve(true); });
        socket.on("error", () => { socket.destroy(); resolve(false); });
        socket.on("timeout", () => { socket.destroy(); resolve(false); });
        socket.connect(port, host);
      });
      if (!connOk) continue;

      for (const user of ["postgres." + projectRef, "postgres"]) {
        const url = "postgresql://" + user + ":" + password + "@" + host + ":" + port + "/postgres?sslmode=require";
        const sql = postgres(url, { idle_timeout: 3, connect_timeout: 4, ssl: { rejectUnauthorized: false } });
        try {
          await sql\`SELECT 1\`;
          console.log("MATCH_FOUND:" + url);
          await sql.end();
          process.exit(0);
        } catch(e) {
          console.log("FAIL: " + host + ":" + port + " (" + user + "): " + e.message);
          await sql.end();
        }
      }
    }
  }
  console.log("NO_MATCH");
}
run();
'
`;

try {
  const out = execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "cd /var/www/dgt-nextjs && ${remoteScript}"`, {
    encoding: 'utf8',
    timeout: 30000
  });
  console.log(out);
} catch (e) {
  console.error("Probe error:", e.stdout || e.stderr || e.message);
}
