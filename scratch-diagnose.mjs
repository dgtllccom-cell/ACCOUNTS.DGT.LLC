import { execSync } from 'child_process';
import fs from 'fs';

console.log("=== LOCAL ENV INSPECTION ===");
const envFiles = ['.env', '.env.local', '.env.production'];
envFiles.forEach(f => {
  if (fs.existsSync(f)) {
    console.log(`Found ${f}:`);
    const content = fs.readFileSync(f, 'utf8');
    content.split('\n').forEach(line => {
      if (line.includes('SUPABASE') || line.includes('DATABASE') || line.includes('PORT')) {
        const [k, ...v] = line.split('=');
        console.log(`  ${k}=${v.join('=').substring(0, 15)}... (len: ${v.join('=').length})`);
      }
    });
  } else {
    console.log(`File ${f} does not exist locally.`);
  }
});

console.log("\n=== TESTING LOCAL SUPABASE CONNECTION ===");
try {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (fs.existsSync('.env.local')) {
    const text = fs.readFileSync('.env.local', 'utf8');
    text.split('\n').forEach(l => {
      if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = l.split('=')[1].trim();
      if (l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = l.split('=')[1].trim();
    });
  }
  console.log("Using URL:", url);
  if (url) {
    const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key } });
    console.log("Supabase REST ping status:", res.status, res.statusText);
  }
} catch (e) {
  console.error("Supabase ping error:", e.message);
}

console.log("\n=== VPS INSPECTION (72.60.209.121) ===");
const SERVER = "root@72.60.209.121";
const sshCmd = (cmd) => {
  try {
    const out = execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "${cmd}"`, { encoding: 'utf8', timeout: 15000 });
    console.log(`--- Output for: ${cmd} ---`);
    console.log(out);
  } catch (e) {
    console.error(`--- Error executing ${cmd} ---`);
    console.error(e.stdout || e.stderr || e.message);
  }
};

sshCmd("pm2 status");
sshCmd("pm2 logs dgt-nextjs --lines 40 --nohup");
sshCmd("tail -n 30 /var/log/nginx/error.log");
sshCmd("ls -la /var/www/dgt-nextjs/.env*");
