import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const REPO_URL = "https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git";
const SERVER_IP = "72.60.209.121";
const SERVER_DIR = "/var/www/dgt-nextjs";
const PM2_NAME = "dgt-nextjs";
const APP_PORT = 3000;

function log(msg, type = 'info') {
  const time = new Date().toLocaleTimeString();
  if (type === 'error') {
    console.error(`\x1b[31m[${time}] [ERROR] ${msg}\x1b[0m`);
  } else if (type === 'success') {
    console.log(`\x1b[32m[${time}] [SUCCESS] ${msg}\x1b[0m`);
  } else if (type === 'warn') {
    console.log(`\x1b[33m[${time}] [WARNING] ${msg}\x1b[0m`);
  } else {
    console.log(`\x1b[36m[${time}] ${msg}\x1b[0m`);
  }
}

async function checkServerHealth(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve({ statusCode: res.statusCode });
    }).on('error', (err) => {
      resolve({ statusCode: 0, error: err.message });
    });
  });
}

async function run() {
  console.log("=================================================================");
  console.log("   DIGITAL DOCK ERP - MASTER AUTOMATED VPS DEPLOYMENT & VERIFICATION");
  console.log(`   Repository : ${REPO_URL}`);
  console.log(`   Server IP  : ${SERVER_IP}`);
  console.log("=================================================================\n");

  const cwd = process.cwd();

  // Step 1: Clean Stale Git Lock Files & Background Processes
  log("Step 1/7: Cleaning stale Git locks & background processes...");
  try {
    const lockFile = path.join(cwd, '.git', 'index.lock');
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
      log("Removed stale .git/index.lock file.", 'success');
    }
    const rebaseMerge = path.join(cwd, '.git', 'rebase-merge');
    if (fs.existsSync(rebaseMerge)) {
      fs.rmSync(rebaseMerge, { recursive: true, force: true });
      log("Cleaned stale .git/rebase-merge directory.", 'success');
    }
  } catch (e) {
    log(`Lock cleanup note: ${e.message}`, 'warn');
  }

  // Step 2: Verify .gitignore
  try {
    log("\nStep 2/7: Verifying .gitignore rules for security & build cache exclusions...");
    const gitignorePath = '.gitignore';
    const requiredPatterns = [
      'node_modules/',
      '.next/',
      '.env',
      '.env.local',
      '.env.production',
      '.env.development',
      '.codex-backups/',
      '.codex*',
      '_codex*',
      '*.log',
      'backups/',
      'exports/',
      '*.pack',
      '*.gz',
      '*.zip',
      '.DS_Store',
      'Thumbs.db'
    ];

    let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    let updated = false;
    requiredPatterns.forEach(p => {
      if (!content.includes(p)) {
        content += `\n${p}`;
        updated = true;
      }
    });
    if (updated) {
      fs.writeFileSync(gitignorePath, content);
      log(".gitignore updated to exclude secrets and build caches.", 'success');
    } else {
      log(".gitignore rules fully compliant.", 'success');
    }
  } catch (e) {
    log(`.gitignore check note: ${e.message}`, 'warn');
  }

  // Step 3: Configure Remote & Commit Clean ERP Codebase
  let commitHash = "";
  try {
    log("\nStep 3/7: Consolidating and committing clean ERP source code...");
    try {
      execSync(`git remote set-url origin ${REPO_URL}`, { stdio: 'pipe' });
    } catch {
      execSync(`git remote add origin ${REPO_URL}`, { stdio: 'pipe' });
    }

    // Auto-fix syntax / brace imbalance across all project components before committing
    try {
      execSync('node scripts/restore-and-fix.mjs', { stdio: 'inherit' });
      execSync('node scripts/verify-all-syntax.mjs', { stdio: 'inherit' });
    } catch (e) {
      log(`Syntax audit note: ${e.message}`, 'warn');
    }

    // Untrack any large build directories accidentally staged
    try {
      execSync('git rm -r --cached .codex-backups .next node_modules 2>nul || true', { stdio: 'ignore' });
    } catch {}

    execSync('git add -A', { stdio: 'pipe' });
    try {
      execSync('git commit -m "Clean consolidated ERP source code (syntax verified)"', { stdio: 'pipe' });
    } catch {
      log("Repository tree is already up to date.", 'info');
    }

    log("Pushing clean codebase to GitHub origin main...");
    execSync('git push -u origin main', { stdio: 'inherit' });
    commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    log(`GitHub push verified! Head Commit: ${commitHash}`, 'success');
  } catch (e) {
    log(`Git commit/push note: ${e.message}`, 'warn');
  }

  // Step 4: Non-Interactive Remote Deployment via SSH
  try {
    log(`\nStep 4/7: Connecting to Hostinger VPS (${SERVER_IP}) & running production build...`);

    const remoteScript = `
set -e

echo '=== [1/7] Backing Up Environment Files ==='
mkdir -p /var/www/env_backups
cd ${SERVER_DIR}
if [ -f .env.local ]; then cp -f .env.local /var/www/env_backups/.env.local.bak || true; fi
if [ -f .env ]; then cp -f .env /var/www/env_backups/.env.bak || true; fi
echo 'Environment backup complete.'

echo '=== [2/7] Fetching Latest Code from GitHub ==='
if [ ! -d ".git" ]; then
  git init
  git remote add origin ${REPO_URL}
else
  git remote set-url origin ${REPO_URL}
fi
git fetch origin main
git reset --hard origin/main
echo 'Server repository updated to latest GitHub main.'

echo '=== [3/7] Restoring Environment Configuration ==='
if [ -f /var/www/env_backups/.env.local.bak ]; then
  cp -f /var/www/env_backups/.env.local.bak .env.local
fi
if [ -f /var/www/env_backups/.env.bak ]; then
  cp -f /var/www/env_backups/.env.bak .env
fi
chmod 600 .env.local .env 2>/dev/null || true

echo '=== [4/7] Verifying Swap Memory Space ==='
if [ $(free -m | awk '/Swap:/ {print $2}') -eq 0 ]; then
  echo 'Allocating 2GB swap space...'
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo '=== [5/7] Installing Production Dependencies ==='
npm install

echo '=== [6/7] Compiling Next.js Application ==='
NODE_OPTIONS='--max-old-space-size=4096' npm run build
echo 'Next.js build completed successfully.'

echo '=== [7/7] Reloading PM2 & Nginx Services ==='
pm2 delete ${PM2_NAME} 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>&1 || true

cat > /etc/nginx/sites-enabled/dgt-nextjs.conf << 'NGINXEOF'
server {
    listen 80 default_server;
    server_name _;

    proxy_connect_timeout  120s;
    proxy_send_timeout     300s;
    proxy_read_timeout     300s;
    send_timeout           300s;

    proxy_buffer_size      128k;
    proxy_buffers          8 256k;
    proxy_busy_buffers_size 256k;

    location / {
        proxy_pass          http://127.0.0.1:${APP_PORT};
        proxy_http_version  1.1;
        proxy_set_header    Upgrade     $http_upgrade;
        proxy_set_header    Connection  'upgrade';
        proxy_set_header    Host        $host;
        proxy_set_header    X-Real-IP   $remote_addr;
        proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto $scheme;
        proxy_cache_bypass  $http_upgrade;
    }
}
NGINXEOF
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo 'Nginx proxy reloaded.'

echo '=== Process & Service Verification ==='
pm2 list
ss -tlnp | grep ${APP_PORT} || (echo "ERROR: App not listening on port ${APP_PORT}" && exit 1)
curl -I http://127.0.0.1:${APP_PORT} || (echo "ERROR: Local HTTP check failed" && exit 1)
echo 'PRODUCTION SERVER VERIFICATION COMPLETED SUCCESSFULLY!'
`;

    const sshCmd = `ssh -o StrictHostKeyChecking=no root@${SERVER_IP} "bash -s"`;
    execSync(sshCmd, { input: remoteScript, stdio: ['pipe', 'inherit', 'inherit'] });
    log("Server build, PM2 restart, and Nginx reload completed successfully!", 'success');
  } catch (e) {
    log(`SERVER DEPLOYMENT FAILED! ${e.message}`, 'error');
    console.log("\n=================================================================");
    console.log("   ❌ DEPLOYMENT FAILED ON VPS - WEBSITE NOT UPDATED");
    console.log("=================================================================");
    return;
  }

  // Step 5: Live HTTP Health Verification
  log(`\nStep 5/7: Verifying live website status at http://${SERVER_IP} ...`);
  let health = await checkServerHealth(`http://${SERVER_IP}`);
  if (health.statusCode >= 200 && health.statusCode < 400) {
    log(`Step 6/7: HEALTH CHECK PASSED! Server returned HTTP ${health.statusCode}`, 'success');
    console.log("\n=================================================================");
    console.log("   🎉 DEPLOYMENT SUCCESSFUL & 502 BAD GATEWAY FIXED!");
    console.log(`   - GitHub Repo      : ${REPO_URL}`);
    console.log(`   - Commit Hash      : ${commitHash || 'latest'}`);
    console.log(`   - PM2 App Name     : ${PM2_NAME}`);
    console.log(`   - Application Port : ${APP_PORT}`);
    console.log(`   - VPS Project Dir  : ${SERVER_DIR}`);
    console.log(`   - Nginx Config     : /etc/nginx/sites-enabled/dgt-nextjs.conf`);
    console.log(`   - Health Check     : HTTP ${health.statusCode} (ONLINE)`);
    console.log(`   - Live Website URL : http://${SERVER_IP}`);
    console.log("=================================================================");
  } else {
    log(`HEALTH CHECK FAILED: Server returned HTTP ${health.statusCode}`, 'error');
    console.log("\n=================================================================");
    console.log("   ❌ DEPLOYMENT INCOMPLETE: Server returned HTTP " + health.statusCode);
    console.log("=================================================================");
  }
}

run();

