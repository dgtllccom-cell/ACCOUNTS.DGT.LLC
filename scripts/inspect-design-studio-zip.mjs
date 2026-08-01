import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const zipPath = 'C:\\Users\\dgtll\\OneDrive\\Desktop\\Your Design Studio.zip';
const workspaceDir = 'C:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC';
const targetDir = path.join(workspaceDir, '_design_studio_temp');

try {
  console.log(`Checking zip file at: ${zipPath}`);
  if (!fs.existsSync(zipPath)) {
    console.error(`Zip file not found at ${zipPath}`);
    process.exit(1);
  }

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  console.log(`Extracting ${zipPath} to _design_studio_temp...`);
  const psScript = `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force`;
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, { stdio: 'inherit' });
  console.log('Extraction complete.');

  function listAll(dir, level = 0) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const rel = path.relative(targetDir, full);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        console.log(`${' '.repeat(level * 2)}[DIR] ${rel}`);
        listAll(full, level + 1);
      } else {
        console.log(`${' '.repeat(level * 2)}[FILE] ${rel} (${stat.size} bytes)`);
      }
    }
  }

  console.log('\n--- EXTRACTED CONTENTS ---');
  listAll(targetDir);

} catch (err) {
  console.error('Error during extraction:', err);
}
