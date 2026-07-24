import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

const desktopPaths = [
  'C:\\Users\\dgtll\\Desktop\\ERP-consolidated.zip',
  'C:\\Users\\dgtll\\OneDrive\\Desktop\\ERP-consolidated.zip',
  'C:\\Users\\dgtll\\OneDrive - DGT LLC\\Desktop\\ERP-consolidated.zip'
];

let zipPath = desktopPaths.find(p => fs.existsSync(p));

if (!zipPath) {
  console.log('Searching for ERP-consolidated.zip on Desktop...');
  // check if any desktop folder contains it
  const userHome = 'C:\\Users\\dgtll';
  const dirs = fs.readdirSync(userHome);
  for (const d of dirs) {
    const candidate = path.join(userHome, d, 'ERP-consolidated.zip');
    if (fs.existsSync(candidate)) {
      zipPath = candidate;
      break;
    }
  }
}

if (!zipPath) {
  console.error('ERP-consolidated.zip could not be found on Desktop.');
  process.exit(1);
}

console.log(`Found ZIP file at: ${zipPath}`);

const workspaceDir = 'c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC';
const targetDir = path.join(workspaceDir, '_review-conflicts');

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

console.log(`Extracting to ${targetDir}...`);

// Use powershell Expand-Archive with explicit stdio configuration
const psScript = `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force`;
execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, {
  stdio: ['ignore', 'pipe', 'pipe']
});

console.log('Extraction successfully finished.');

function hashFile(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
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

const extractedFiles = getAllFiles(targetDir);
console.log(`Extracted total files: ${extractedFiles.length}`);

const report = {
  zipPath,
  extractedCount: extractedFiles.length,
  newFiles: [],
  identicalFiles: [],
  conflictFiles: []
};

extractedFiles.forEach((extPath) => {
  const relPath = path.relative(targetDir, extPath);
  const wsPath = path.join(workspaceDir, relPath);

  if (relPath.startsWith('.git') || relPath.startsWith('node_modules') || relPath.startsWith('.next') || relPath === 'REVIEW_REPORT.json') {
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
      const extStat = fs.statSync(extPath);
      const wsStat = fs.statSync(wsPath);
      report.conflictFiles.push({
        file: relPath,
        extractedSize: extStat.size,
        workspaceSize: wsStat.size,
        extractedModified: extStat.mtime.toISOString(),
        workspaceModified: wsStat.mtime.toISOString()
      });
    }
  }
});

const reportJsonPath = path.join(targetDir, 'REVIEW_REPORT.json');
fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));

console.log('SUMMARY RESULTS:');
console.log(`- New Files: ${report.newFiles.length}`);
console.log(`- Identical Files: ${report.identicalFiles.length}`);
console.log(`- Conflict / Modified Files (Requires Review): ${report.conflictFiles.length}`);
