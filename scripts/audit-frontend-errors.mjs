import fs from 'fs';
import path from 'path';

function findFiles(dir, matchExt, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', '.tmp', 'dist'].includes(f)) {
        findFiles(full, matchExt, fileList);
      }
    } else if (matchExt.some(ext => f.endsWith(ext))) {
      fileList.push(full);
    }
  }
  return fileList;
}

function scanForFrontendErrors() {
  console.log('=== SCANNING FRONTEND COMPONENTS FOR UNRESOLVED ERRORS ===\n');

  const tsxFiles = findFiles('features', ['.tsx', '.ts']);
  const appFiles = findFiles('app', ['.tsx', '.ts']);
  const allFiles = [...tsxFiles, ...appFiles];

  console.log(`Scanning ${allFiles.length} source files...`);

  const issues = [];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');

    // Check for obvious hardcoded error strings that indicate incomplete UI state
    if (content.includes('TODO: Implement') || content.includes('FIXME') || content.includes('PLACEHOLDER_ERROR')) {
      issues.push({ file, type: 'Incomplete Implementation Flag' });
    }

    // Check for hardcoded invalid UUID fallbacks
    if (content.includes('00000000-0000-0000-0000-000000000000')) {
      issues.push({ file, type: 'Nil UUID Fallback Detected' });
    }
  }

  console.log(`Scan Complete. Issues found: ${issues.length}`);
  if (issues.length === 0) {
    console.log('✅ ZERO unhandled error flags or invalid UUID fallbacks found across all components.');
  } else {
    console.log('Issues:', issues);
  }

  fs.writeFileSync('scripts/audit-frontend-errors.json', JSON.stringify({ totalFiles: allFiles.length, issues }, null, 2));
}

scanForFrontendErrors();
