import { spawnSync } from 'child_process';

const cmd = `
cd /var/www/dgt-nextjs
echo "=== VPS GIT REVISION ==="
git rev-parse HEAD
git log -n 3 --oneline

echo "=== VPS .env.local KEY CHECK ==="
node -e '
const fs = require("fs");
const dotenv = require("dotenv");
if (fs.existsSync(".env.local")) {
  const parsed = dotenv.parse(fs.readFileSync(".env.local"));
  console.log("NEXT_PUBLIC_SUPABASE_URL:", parsed.NEXT_PUBLIC_SUPABASE_URL ? "SET (" + parsed.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) + "...)" : "MISSING");
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET (prefix: " + parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 15) + "...)" : "MISSING");
  console.log("SUPABASE_SERVICE_ROLE_KEY:", parsed.SUPABASE_SERVICE_ROLE_KEY ? "SET (prefix: " + parsed.SUPABASE_SERVICE_ROLE_KEY.substring(0, 15) + "...)" : "MISSING");
  console.log("DATABASE_URL:", parsed.DATABASE_URL ? "SET" : "MISSING");
} else {
  console.log(".env.local not found");
}
'
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'bash -s'], {
  input: cmd,
  encoding: 'utf8'
});

console.log("STDOUT:\n", res.stdout);
console.log("STDERR:\n", res.stderr);
