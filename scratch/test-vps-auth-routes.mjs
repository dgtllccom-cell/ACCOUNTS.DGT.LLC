import { spawnSync } from 'child_process';

const cmd = `
cd /var/www/dgt-nextjs
node -e '
(async () => {
  const http = require("http");

  // First create a session token using erp_session_secret
  const crypto = require("crypto");
  const fs = require("fs");
  const envContent = fs.readFileSync(".env.local", "utf8");
  let secret = "";
  for (const line of envContent.split("\\n")) {
    if (line.startsWith("ERP_SESSION_SECRET=")) {
      secret = line.split("=")[1].trim();
    }
  }

  // Helper to make request
  function request(path, cookie) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: "127.0.0.1",
        port: 3000,
        path: path,
        method: "GET",
        headers: cookie ? { "Cookie": cookie } : {}
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve({ status: res.statusCode, data: data.substring(0, 200), headers: res.headers }));
      });
      req.on("error", (e) => resolve({ status: 500, error: e.message }));
      req.end();
    });
  }

  // Let us test login
  console.log("=== Testing with login API ===");
  // Let us inspect superadmin in DB or login endpoint
})();
'
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'bash -s'], {
  input: cmd,
  encoding: 'utf8'
});

console.log("STDOUT:\n", res.stdout);
console.log("STDERR:\n", res.stderr);
