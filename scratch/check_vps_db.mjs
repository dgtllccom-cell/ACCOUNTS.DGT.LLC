import { execSync } from 'child_process';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const SERVER = "root@72.60.209.121";

async function checkVPS() {
  console.log("Checking VPS environment and DB...");
  const cmd = `ssh -o StrictHostKeyChecking=no ${SERVER} "grep DATABASE_URL /var/www/dgt-nextjs/.env.local /var/www/dgt-nextjs/.env 2>/dev/null"`;
  try {
    const out = execSync(cmd, { encoding: 'utf8' });
    console.log("VPS env output:\n", out);
  } catch (e) {
    console.error("SSH error:", e.message);
  }
}

checkVPS();
