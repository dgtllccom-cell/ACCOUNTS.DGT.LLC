import { spawnSync } from 'child_process';

const remoteCmd = process.argv.slice(2).join(' ');
const proc = spawnSync('ssh', [
  '-i', 'C:\\Users\\dgtll\\.ssh\\id_rsa',
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=no',
  'root@72.60.209.121',
  remoteCmd
], {
  encoding: 'utf8',
  timeout: 180000
});

if (proc.stdout) process.stdout.write(proc.stdout);
if (proc.stderr) process.stderr.write(proc.stderr);
process.exit(proc.status || 0);
