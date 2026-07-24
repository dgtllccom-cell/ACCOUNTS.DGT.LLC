import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

const zipPath = 'C:\\Users\\dgtll\\Desktop\\ERP-consolidated.zip';
const targetDir = 'c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC\\_review-conflicts';
const workspaceDir = 'c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC';

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getAllFiles(dirPath, arrayOfFiles = []) {
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

try {
  if (!fs.existsSync(zipPath)) {
    console.error(`Zip file not found at: ${zipPath}`);
    process.exit(1);
  }

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  console.log(`Extracting ${zipPath} to ${targetDir}...`);
  const psCommand = `powershell -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force"`;
  execSync(psCommand, { stdio: 'inherit' });
  console.log('Extraction complete.');

  const extractedFiles = getAllFiles(targetDir);
  console.log(`Found ${extractedFiles.length} extracted files.`);

  const report = {
    newFiles: [],
    identicalFiles: [],
    conflictFiles: []
  };

  extractedFiles.forEach((extPath) => {
    const relPath = path.relative(targetDir, extPath);
    const wsPath = path.join(workspaceDir, relPath);

    if (relPath.startsWith('.git') || relPath.startsWith('node_modules') || relPath.startsWith('.next')) {
      return;
    }

    if (!fs.existsSync(wsPath)) {
      report.newFiles.push(relPath);
    } else {
      const extHash = hashFile(extPath);
      const wsHash = hashFile(wsPath);
      if (extHash === wsHash) {
        report.identicalFiles.push(relPath);
      } else {
        report.conflictFiles.push({
          relPath,
          extSize: fs.statSync(extPath).size,
          wsSize: fs.statSync(wsPath).size,
          extTime: fs.statSync(extPath).mtime,
          wsTime: fs.statSync(wsPath).mtime
        });
      }
    }
  });

  console.log('--- COMPARISON SUMMARY ---');
  console.log(`New Files: ${report.newFiles.length}`);
  console.log(`Identical Files: ${report.identicalFiles.length}`);
  console.log(`Conflicts / Modified Files requiring review: ${report.conflictFiles.length}`);

  const reportMdPath = path.join(targetDir, 'REVIEW_REPORT.json');
  fs.writeFileSync(reportMdPath, JSON.stringify(report, null, 2));

} catch (err) {
  console.error('Error during extraction/inspection:', err);
  process.exit(1);
}
