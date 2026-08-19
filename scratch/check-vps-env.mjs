import { spawnSync } from 'child_process';

const cmd = `
cd /var/www/dgt-nextjs
echo "=== VPS .env.local KEY CHECK ==="
node -e '
const fs = require("fs");
if (fs.existsSync(".env.local")) {
  const lines = fs.readFileSync(".env.local", "utf8").split("\\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        console.log(k + ": length=" + v.length + ", startsWith=" + v.substring(0, 15) + "...");
      }
    }
  }
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
