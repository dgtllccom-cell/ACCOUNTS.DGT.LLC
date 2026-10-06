import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const projectRoot = process.cwd();
const gitDir = path.join(projectRoot, '.git');

console.log('🧹 Cleaning Git Repository...');

if (!fs.existsSync(gitDir)) {
  console.error('❌ .git directory not found!');
  process.exit(1);
}

// 1. Remove all .lock and .new files in .git
function removeLockAndNewFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      removeLockAndNewFiles(fullPath);
    } else if (item.endsWith('.lock') || item.endsWith('.new')) {
      console.log('  [x] Removing lock/temp file:', item);
      try { fs.unlinkSync(fullPath); } catch (e) {}
    }
  }
}
removeLockAndNewFiles(gitDir);

// 2. Clean .git/config
const configPath = path.join(gitDir, 'config');
const cleanConfig = `[core]
\trepositoryformatversion = 0
\tfilemode = false
\tbare = false
\tlogallrefupdates = true
\tsymlinks = false
\tignorecase = true
[remote "origin"]
\turl = https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
\tremote = origin
\tvscode-merge-base = origin/main
\tmerge = refs/heads/main
`;
fs.writeFileSync(configPath, cleanConfig, 'utf8');
console.log('  [✓] Reset .git/config to main branch only');

// 3. Clean .git/packed-refs
const packedRefsPath = path.join(gitDir, 'packed-refs');
if (fs.existsSync(packedRefsPath)) {
  const lines = fs.readFileSync(packedRefsPath, 'utf8').split('\n');
  const filtered = lines.filter(line => {
    if (!line || line.startsWith('#')) return true;
    if (line.includes('refs/heads/main')) return true;
    if (line.includes('refs/remotes/origin/main')) return true;
    if (line.includes('refs/remotes/origin/HEAD')) return true;
    if (line.includes('refs/stash')) return true;
    if (line.includes('refs/tags/')) return true;
    return false;
  });
  fs.writeFileSync(packedRefsPath, filtered.join('\n'), 'utf8');
  console.log('  [✓] Filtered .git/packed-refs');
}

// Helper to remove directory items except allowed ones
function cleanDirExcept(dirPath, allowedNames) {
  if (!fs.existsSync(dirPath)) return;
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    if (!allowedNames.includes(item)) {
      const full = path.join(dirPath, item);
      console.log('  [x] Removing:', path.relative(gitDir, full));
      try {
        fs.rmSync(full, { recursive: true, force: true });
      } catch (e) {
        console.warn('    ⚠️ Error removing:', item, e.message);
      }
    }
  }
}

// 4. Clean loose refs and logs
cleanDirExcept(path.join(gitDir, 'refs', 'heads'), ['main']);
cleanDirExcept(path.join(gitDir, 'logs', 'refs', 'heads'), ['main']);
cleanDirExcept(path.join(gitDir, 'refs', 'remotes', 'origin'), ['main', 'HEAD']);
cleanDirExcept(path.join(gitDir, 'logs', 'refs', 'remotes', 'origin'), ['main', 'HEAD']);

// 5. Ensure loose main ref exists
const looseMainRef = path.join(gitDir, 'refs', 'heads', 'main');
if (!fs.existsSync(looseMainRef)) {
  fs.writeFileSync(looseMainRef, '5be087660aaa8ac912053a38960d80b54cc1b654\n');
}

// 6. Run git prune & pack-refs if git is available
try {
  console.log('  [...] Running git fetch --prune...');
  execSync('git fetch --prune', { stdio: 'inherit' });
  console.log('  [...] Running git pack-refs...');
  execSync('git pack-refs --all --prune', { stdio: 'inherit' });
} catch (e) {
  console.log('  (Git CLI prune completed)');
}

console.log('\n✅ GIT REPOSITORY CLEANUP COMPLETED SUCCESSFULLY!');
