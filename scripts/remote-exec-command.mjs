import { execSync } from 'child_process';

const remoteCmd = `cd /var/www/dgt-nextjs && cp package.json /root/dgt-nextjs-package.json.backup && npm pkg set scripts.start="next start -p 3000" && pm2 delete dgt-nextjs && pm2 start npm --name dgt-nextjs -- start && pm2 save && curl -I http://127.0.0.1:3000`;

console.log('Connecting to root@72.60.209.121 and running remote commands...');

try {
  const output = execSync(`ssh -o StrictHostKeyChecking=no root@72.60.209.121 "${remoteCmd}"`, {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('================ REMOTE OUTPUT ================');
  console.log(output);
  console.log('===============================================');
} catch (err) {
  console.error('Remote execution failed / returned output:');
  if (err.stdout) console.log('STDOUT:\n', err.stdout);
  if (err.stderr) console.error('STDERR:\n', err.stderr);
}
