import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const workspaceDir = 'C:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC';
const tempBaseDir = 'C:\\tmp\\recovery_zips_extracted';

const zipSources = [
  { name: 'ACCOUNTS.DGT.LLC-main.zip', path: 'C:\\Users\\dgtll\\OneDrive\\Desktop\\cods\\ACCOUNTS.DGT.LLC-main.zip' },
  { name: 'dht-nextjs-main.zip', path: 'C:\\Users\\dgtll\\OneDrive\\Desktop\\cods\\dht-nextjs-main.zip' },
  { name: 'vigilant-adventure-main.zip', path: 'C:\\Users\\dgtll\\OneDrive\\Desktop\\cods\\vigilant-adventure-main.zip' }
];

function hashFile(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getRelativeFiles(dirPath, currentDir = '', fileList = []) {
  if (!fs.existsSync(dirPath)) return fileList;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const relPath = path.join(currentDir, entry.name);
    const fullPath = path.join(dirPath, entry.name);

    // Skip ignored patterns
    if (
      entry.name === '.git' ||
      entry.name === 'node_modules' ||
      entry.name === '.next' ||
      entry.name === '.vscode' ||
      entry.name === 'backups' ||
      entry.name === 'scratch' ||
      entry.name === '.tmp' ||
      entry.name.endsWith('.env') ||
      entry.name.endsWith('.env.local') ||
      entry.name.endsWith('.env.production')
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      getRelativeFiles(fullPath, relPath, fileList);
    } else {
      fileList.push(relPath.replace(/\\/g, '/'));
    }
  }
  return fileList;
}

console.log('=== Step 1: Extracting ZIP files ===');
if (!fs.existsSync(tempBaseDir)) {
  fs.mkdirSync(tempBaseDir, { recursive: true });
}

zipSources.forEach((zip, index) => {
  const destDir = path.join(tempBaseDir, `zip_${index + 1}_${zip.name.replace(/\.zip$/i, '')}`);
  console.log(`Extracting ${zip.name} to ${destDir}...`);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    // Use node adm-zip or PowerShell expand-archive
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${zip.path}' -DestinationPath '${destDir}' -Force"`;
    try {
      execSync(psCmd, { stdio: 'inherit' });
      console.log(`Extraction complete for ${zip.name}`);
    } catch (err) {
      console.error(`Failed to extract ${zip.name}:`, err.message);
    }
  } else {
    console.log(`Already extracted: ${destDir}`);
  }
});

console.log('\n=== Step 2: Collecting file lists ===');
const mainFiles = getRelativeFiles(workspaceDir);
console.log(`Main workspace total files: ${mainFiles.length}`);

const zipExtractions = zipSources.map((zip, index) => {
  const destDir = path.join(tempBaseDir, `zip_${index + 1}_${zip.name.replace(/\.zip$/i, '')}`);
  
  // Detect if zip extracts to a single inner root folder (e.g. ACCOUNTS.DGT.LLC-main/)
  let rootFolder = destDir;
  const contents = fs.readdirSync(destDir);
  if (contents.length === 1 && fs.statSync(path.join(destDir, contents[0])).isDirectory()) {
    rootFolder = path.join(destDir, contents[0]);
  }

  const files = getRelativeFiles(rootFolder);
  console.log(`ZIP "${zip.name}" total files: ${files.length} (Root: ${rootFolder})`);
  return {
    name: zip.name,
    rootDir: rootFolder,
    files
  };
});

console.log('\n=== Step 3: Comparative Analysis ===');
const auditSummary = {
  missingInMain: [],
  truncatedInMain: [],
  differentInMain: [],
  identical: [],
  mainOnly: []
};

// Map of all unique files across all zips
const zipFileMap = new Map(); // relPath -> array of { zipName, fullPath, hash, size, mtime }

zipExtractions.forEach(extraction => {
  extraction.files.forEach(relPath => {
    const fullPath = path.join(extraction.rootDir, relPath);
    const hash = hashFile(fullPath);
    const stat = fs.statSync(fullPath);

    if (!zipFileMap.has(relPath)) {
      zipFileMap.set(relPath, []);
    }
    zipFileMap.get(relPath).push({
      zipName: extraction.name,
      fullPath,
      hash,
      size: stat.size,
      mtime: stat.mtime
    });
  });
});

console.log(`Unique files across all 3 ZIPs: ${zipFileMap.size}`);

// Compare each file in ZIPs against main
zipFileMap.forEach((zipVersions, relPath) => {
  const mainFullPath = path.join(workspaceDir, relPath);
  const existsInMain = fs.existsSync(mainFullPath);

  if (!existsInMain) {
    auditSummary.missingInMain.push({
      relPath,
      zipVersions
    });
  } else {
    const mainHash = hashFile(mainFullPath);
    const mainStat = fs.statSync(mainFullPath);

    // Check if any zip version is different
    const matchingZip = zipVersions.find(v => v.hash === mainHash);
    if (matchingZip) {
      auditSummary.identical.push(relPath);
    } else {
      // Different file! Check if main is truncated or empty
      const isTruncated = mainStat.size === 0 || (zipVersions.some(v => v.size > mainStat.size * 2 && mainStat.size < 500));
      if (isTruncated) {
        auditSummary.truncatedInMain.push({
          relPath,
          mainSize: mainStat.size,
          zipVersions
        });
      } else {
        auditSummary.differentInMain.push({
          relPath,
          mainSize: mainStat.size,
          zipVersions
        });
      }
    }
  }
});

// Identify files that are in main but not in any ZIP
mainFiles.forEach(relPath => {
  if (!zipFileMap.has(relPath)) {
    auditSummary.mainOnly.push(relPath);
  }
});

console.log('\n=== Summary Results ===');
console.log(`- Missing in Main: ${auditSummary.missingInMain.length}`);
console.log(`- Truncated/Empty in Main: ${auditSummary.truncatedInMain.length}`);
console.log(`- Different (Both exist): ${auditSummary.differentInMain.length}`);
console.log(`- Identical: ${auditSummary.identical.length}`);
console.log(`- Main Only (Newer production code): ${auditSummary.mainOnly.length}`);

// Write JSON detailed report
const reportPath = path.join(workspaceDir, 'docs', 'RECOVERY_COMPARISON_DATA.json');
if (!fs.existsSync(path.dirname(reportPath))) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
}
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  zipSources,
  counts: {
    missingInMain: auditSummary.missingInMain.length,
    truncatedInMain: auditSummary.truncatedInMain.length,
    differentInMain: auditSummary.differentInMain.length,
    identical: auditSummary.identical.length,
    mainOnly: auditSummary.mainOnly.length
  },
  missingInMain: auditSummary.missingInMain,
  truncatedInMain: auditSummary.truncatedInMain,
  differentInMain: auditSummary.differentInMain
}, null, 2));

console.log(`Detailed comparison saved to: ${reportPath}`);
