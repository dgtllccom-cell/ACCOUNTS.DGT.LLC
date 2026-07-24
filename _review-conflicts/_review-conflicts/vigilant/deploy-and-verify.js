import { execSync } from 'child_process';
import fs from 'fs';
import http from 'http';

const REPO_URL = "https://github.com/dgtllccom-cell/vigilant-adventure.git";
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
  console.log("   DIGITAL DOCK ERP - NON-INTERACTIVE AUTOMATED VPS DEPLOYMENT");
  console.log(`   Repository : ${REPO_URL}`);
  console.log(`   Server IP  : ${SERVER_IP}`);
  console.log("=================================================================\n");

  // Step 1: Verify .gitignore
  try {
    log("Step 1/7: Verifying .gitignore file for security & size exclusions...");
    const gitignorePath = '.gitignore';
    const requiredPatterns = [
      'node_modules/',
      '.next/',
      '.env',
      '.env.*',
      '!.env.example',
      '.codex-backups/',
      '.codex*',
      '_codex*',
      '*.log',
      'logs/',
      'backups/',
      'exports/',
      'dist/',
      'coverage/',
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
      log(".gitignore updated to exclude secrets, node_modules, and build outputs.", 'success');
    } else {
      log(".gitignore file is fully compliant.", 'success');
    }
  } catch (e) {
    log(`.gitignore check warning: ${e.message}`, 'warn');
  }

  // Step 2: Configure Git Remote
  try {
    log("\nStep 2/7: Setting Git remote origin to vigilant-adventure repository...");
    try {
      execSync(`git remote set-url origin ${REPO_URL}`, { stdio: 'pipe' });
    } catch {
      execSync(`git remote add origin ${REPO_URL}`, { stdio: 'pipe' });
    }
    log(`Git remote origin set to: ${REPO_URL}`, 'success');
  } catch (e) {
    log(`Failed to configure Git remote: ${e.message}`, 'error');
    process.exit(1);
  }

  // Step 3: Check & Push Local ERP Code
  let commitHash = "";
  try {
    log("\nStep 3/7: Pushing clean ERP codebase to GitHub origin main...");
    try {
      execSync('git add -A', { stdio: 'pipe' });
      execSync('git commit -m "Upload clean Digital Dock ERP production source code"', { stdio: 'pipe' });
    } catch (e) {}
    execSync(`git push -u origin main --force`, { stdio: 'inherit' });
    commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    log(`GitHub push verified! Commit Hash: ${commitHash}`, 'success');
  } catch (e) {
    log(`GitHub push note: ${e.message}`, 'warn');
  }

  // Step 4: Non-Interactive SSH VPS Deployment (Piping commands directly to bash)
  try {
    log(`\nStep 4/7: Connecting to Hostinger VPS (${SERVER_IP}) & executing non-interactive deployment...`);

    const remoteScript = `
set -e

echo '=== [1/8] Backing Up Environment Files ==='
mkdir -p /var/www/env_backups
cd ${SERVER_DIR}
if [ -f .env ]; then cp -f .env /var/www/env_backups/.env.bak || true; fi
if [ -f .env.local ]; then cp -f .env.local /var/www/env_backups/.env.local.bak || true; fi
echo 'Environment backup complete at /var/www/env_backups.'

echo '=== [2/8] Fetching Latest Source Code from GitHub ==='
if [ ! -d ".git" ]; then
  git init
  git remote add origin ${REPO_URL}
else
  git remote set-url origin ${REPO_URL}
fi
git fetch origin main
git reset --hard origin/main
echo 'Server codebase updated to latest GitHub main.'

echo '=== [3/8] Restoring Environment Files ==='
if [ -f /var/www/env_backups/.env.local.bak ]; then
  cp -f /var/www/env_backups/.env.local.bak .env.local
fi
if [ -f /var/www/env_backups/.env.bak ]; then
  cp -f /var/www/env_backups/.env.bak .env
fi

echo '=== [4/8] Configuring Swap Memory Space ==='
if [ $(free -m | awk '/Swap:/ {print $2}') -eq 0 ]; then
  echo 'Creating 2GB swap space to prevent memory build crash...'
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo '=== [5/8] Installing Dependencies (npm install) ==='
npm install

echo '=== [6/8] Building Next.js Production Application ==='
NODE_OPTIONS='--max-old-space-size=2048' npm run build
echo 'Next.js build completed successfully.'

echo '=== [7/8] Starting PM2 Application & Saving State ==='
pm2 startOrReload ecosystem.config.cjs || pm2 restart ${PM2_NAME} --update-env
pm2 save
pm2 startup systemd -u root --hp /root 2>&1 || true

echo '=== [8/8] Configuring & Reloading Nginx Proxy ==='
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
echo 'Nginx proxy reloaded successfully.'

echo '=== PM2 & Port Status Check ==='
pm2 list
ss -tlnp | grep ${APP_PORT} || echo 'WARNING: Port ${APP_PORT} not listening yet'
`;

    // Execute via piped stdin to prevent interactive shell fallback
    const sshCmd = `ssh -o StrictHostKeyChecking=no root@${SERVER_IP} "bash -s"`;
    execSync(sshCmd, { input: remoteScript, stdio: ['pipe', 'inherit', 'inherit'] });
    log("Server build, PM2 restart, and Nginx reload completed successfully!", 'success');
  } catch (e) {
    log(`SERVER DEPLOYMENT FAILED! ${e.message}`, 'error');
    console.log("\n=================================================================");
    console.log("   ❌ DEPLOYMENT FAILED ON VPS - WEBSITE NOT UPDATED");
    console.log("=================================================================");
    process.stdin.once('data', () => process.exit(1));
    return;
  }

  // Step 5: HTTP Health Check
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
    console.log(`   - Backup Location  : /var/www/env_backups`);
    console.log(`   - Health Check     : HTTP ${health.statusCode} (ONLINE)`);
    console.log(`   - Live Website URL : http://${SERVER_IP}`);
    console.log("=================================================================");
  } else {
    log(`HEALTH CHECK FAILED: Server returned HTTP ${health.statusCode}`, 'error');
    console.log("\n=================================================================");
    console.log("   ❌ DEPLOYMENT INCOMPLETE: Server returned HTTP " + health.statusCode);
    console.log("=================================================================");
    process.exit(1);
  }

  process.stdin.once('data', () => process.exit(0));
}

run();
