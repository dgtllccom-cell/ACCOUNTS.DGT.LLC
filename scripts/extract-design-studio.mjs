import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const zipPath = 'C:\\Users\\dgtll\\OneDrive\\Desktop\\Your Design Studio.zip';
const workspaceDir = 'C:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC';
const targetDir = path.join(workspaceDir, '_design_studio');

try {
  console.log(`Checking zip file at: ${zipPath}`);
  if (!fs.existsSync(zipPath)) {
    console.error(`Zip file not found at ${zipPath}`);
    process.exit(1);
  }

  if (fs.existsSync(targetDir)) {
    console.log(`Cleaning old ${targetDir}...`);
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  console.log(`Extracting ${zipPath} to _design_studio...`);
  const psScript = `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force`;
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, { stdio: 'inherit' });
  console.log('Extraction complete!');

  function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      } else {
        arrayOfFiles.push(fullPath);
      }
    });

    return arrayOfFiles;
  }

  const files = getAllFiles(targetDir);
  console.log(`\n=== EXTRACTED DESIGN STUDIO FILES (${files.length}) ===`);
  files.forEach(f => console.log(` - ${path.relative(targetDir, f)}`));

} catch (err) {
  console.error('Error during extraction:', err.message);
}
