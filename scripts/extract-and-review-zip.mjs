import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

const zipPath = 'C:\\Users\\dgtll\\OneDrive\\Desktop\\ERP-consolidated.zip';
const workspaceDir = 'C:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC';
const targetDir = path.join(workspaceDir, '_review-conflicts');

function hashFile(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

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

  console.log(`Extracting ${zipPath} to _review-conflicts...`);
  const psScript = `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force`;
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, { stdio: 'inherit' });
  console.log('Extraction complete.');

  const extractedFiles = getAllFiles(targetDir);
  console.log(`Analyzing ${extractedFiles.length} extracted files...`);

  const report = {
    newFiles: [],
    identicalFiles: [],
    conflictFiles: []
  };

  extractedFiles.forEach((extPath) => {
    const relPath = path.relative(targetDir, extPath);
    const wsPath = path.join(workspaceDir, relPath);

    if (relPath.startsWith('.git') || relPath.startsWith('node_modules') || relPath.startsWith('.next') || relPath.endsWith('REVIEW_REPORT.md')) {
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
          zipSize: extStat.size,
          workspaceSize: wsStat.size,
          zipTime: extStat.mtime.toISOString(),
          workspaceTime: wsStat.mtime.toISOString()
        });
      }
    }
  });

  // Write Markdown Report
  let md = `# ERP-consolidated.zip Review & Conflict Report\n\n`;
  md += `**Zip Source**: \`${zipPath}\`  \n`;
  md += `**Extracted Folder**: \`_review-conflicts/\`  \n`;
  md += `**Total Extracted Files**: ${extractedFiles.length}  \n`;
  md += `**New Files**: ${report.newFiles.length} | **Identical Files**: ${report.identicalFiles.length} | **Conflict Files Needing Review**: ${report.conflictFiles.length}\n\n`;

  md += `## ⚠️ Conflict Files Needing Review (${report.conflictFiles.length})\n`;
  if (report.conflictFiles.length === 0) {
    md += `*No file conflicts found.*\n\n`;
  } else {
    md += `| File Path | ZIP Version Size | Workspace Version Size | ZIP Modified Time | Workspace Modified Time |\n`;
    md += `| --- | --- | --- | --- | --- |\n`;
    report.conflictFiles.forEach(c => {
      md += `| \`${c.file}\` | ${c.zipSize} B | ${c.workspaceSize} B | ${c.zipTime} | ${c.workspaceTime} |\n`;
    });
    md += `\n`;
  }

  md += `## 🆕 New Files (${report.newFiles.length})\n`;
  report.newFiles.forEach(f => {
    md += `- \`${f}\`\n`;
  });
  md += `\n`;

  md += `## ✅ Identical Files (${report.identicalFiles.length})\n`;
  report.identicalFiles.forEach(f => {
    md += `- \`${f}\`\n`;
  });

  const reportPath = path.join(targetDir, 'REVIEW_REPORT.md');
  fs.writeFileSync(reportPath, md, 'utf8');

  console.log('\n================ REVIEW REPORT SUMMARY ================');
  console.log(`New Files: ${report.newFiles.length}`);
  console.log(`Identical Files: ${report.identicalFiles.length}`);
  console.log(`CONFLICTS / MODIFIED FILES (NEEDS REVIEW): ${report.conflictFiles.length}`);
  console.log(`Full report saved to: ${reportPath}`);

} catch (err) {
  console.error('Error during processing:', err);
}
