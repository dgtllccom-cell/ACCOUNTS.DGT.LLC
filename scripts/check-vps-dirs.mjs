import { execSync } from "child_process";

const SERVER = "root@72.60.209.121";

try {
  const out = execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "ls -la /var/www && pm2 list"`, {
    encoding: "utf8"
  });
  console.log(out);
} catch (e) {
  console.error("Error:", e.message);
}
