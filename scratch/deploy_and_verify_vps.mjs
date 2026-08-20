import { Client } from 'ssh2';
import fetch from 'node-fetch';

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH Connection established');

  const remoteCmd = `
    set -e
    cd /var/www/accounts-dgt-llc || cd /var/www/ACCOUNTS.DGT.LLC || cd /var/www/html
    echo "Current dir: $(pwd)"
    
    # 1. Update Nginx configuration if using localhost:3000
    if grep -q "localhost:3000" /etc/nginx/sites-enabled/*; then
      echo "Fixing Nginx proxy_pass localhost:3000 to 127.0.0.1:3000..."
      sed -i 's/localhost:3000/127.0.0.1:3000/g' /etc/nginx/sites-available/* /etc/nginx/sites-enabled/* 2>/dev/null || true
      nginx -t && systemctl reload nginx
    fi

    # 2. Git fetch and checkout latest main
    git fetch origin main
    git reset --hard origin/main
    git status

    # 3. Build Next.js
    NODE_OPTIONS='--max-old-space-size=4096' npm run build

    # 4. Restart PM2
    pm2 restart dgt-nextjs || pm2 restart all
    pm2 save
    
    echo "DEPLOYMENT COMPLETE"
  `;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log(`Remote command exited with code ${code}`);
      conn.end();
      if (code === 0) {
        console.log("Successfully built and deployed on VPS!");
      }
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host: '72.60.209.121',
  port: 22,
  username: 'root',
  privateKey: undefined, // Uses default ssh-agent or password if configured
});
