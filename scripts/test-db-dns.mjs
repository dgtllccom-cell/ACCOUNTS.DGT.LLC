import dns from 'dns/promises';
import net from 'net';
import postgres from 'postgres';

const projectRef = "csesvyxqjivnkkozgopt";
const password = "Gulistan%409090";

const hosts = [
  "aws-0-ap-southeast-1.pooler.supabase.com",
  "aws-0-ap-south-1.pooler.supabase.com",
  "aws-1-ap-southeast-2.pooler.supabase.com",
  "aws-0-us-east-1.pooler.supabase.com",
  "aws-0-us-west-1.pooler.supabase.com",
  "aws-0-eu-central-1.pooler.supabase.com",
  "aws-0-eu-west-1.pooler.supabase.com",
  "aws-0-me-central-1.pooler.supabase.com",
  "db.csesvyxqjivnkkozgopt.supabase.co"
];

async function testAll() {
  console.log(`\n=== Supabase Connection Diagnostic & Probe for ${projectRef} ===\n`);

  for (const host of hosts) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Testing Host: ${host}`);
    let ips = [];
    try {
      ips = await dns.resolve4(host);
      console.log(`  [DNS v4 OK] IPs: ${ips.join(', ')}`);
    } catch (e) {
      console.log(`  [DNS v4 FAIL] ${e.message}`);
    }

    try {
      const v6s = await dns.resolve6(host);
      console.log(`  [DNS v6 OK] IPv6: ${v6s.join(', ')}`);
    } catch (e) {
      // ignore v6
    }

    if (ips.length === 0) continue;

    const ports = [6543, 5432];
    const userFormats = [`postgres.${projectRef}`, `postgres`];

    for (const port of ports) {
      const connOk = await new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2500);
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('error', () => { socket.destroy(); resolve(false); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.connect(port, host);
      });

      if (!connOk) {
        console.log(`  [TCP ${port}] Closed / Unreachable`);
        continue;
      }
      console.log(`  [TCP ${port}] Open! Testing Auth...`);

      for (const user of userFormats) {
        const dbUrl = `postgresql://${user}:${password}@${host}:${port}/postgres?sslmode=require`;
        const sql = postgres(dbUrl, {
          idle_timeout: 3,
          connect_timeout: 4,
          ssl: { rejectUnauthorized: false }
        });
        try {
          const res = await sql`SELECT 1 as connected;`;
          console.log(`\n==================================================`);
          console.log(`🎉 SUCCESSFUL SUPABASE DATABASE CONNECTION FOUND!`);
          console.log(`   Host     : ${host}`);
          console.log(`   Port     : ${port}`);
          console.log(`   User     : ${user}`);
          console.log(`   DB URL   : postgresql://${user}:****@${host}:${port}/postgres?sslmode=require`);
          console.log(`==================================================\n`);
          await sql.end();
          return { host, port, user, dbUrl };
        } catch (authErr) {
          console.log(`   User '${user}' on port ${port}: ${authErr.message}`);
          await sql.end();
        }
      }
    }
  }

  console.log("\n❌ Probe completed: No active pooler connection authenticated. Please check password or project ref.");
  return null;
}

testAll();
