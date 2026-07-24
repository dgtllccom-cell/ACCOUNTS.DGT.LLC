import fs from 'fs';
import path from 'path';
import { parseSync } from '@swc/core';

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git' && file !== '_review-conflicts') {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

const allFiles = [
  ...getAllFiles('app'),
  ...getAllFiles('features'),
  ...getAllFiles('lib'),
  ...getAllFiles('components')
];

console.log(`Checking SWC parse on ${allFiles.length} files...`);

let errorCount = 0;
const syntaxErrors = [];

for (const filePath of allFiles) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const isJsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
    const isTs = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

    parseSync(code, {
      syntax: isTs ? 'typescript' : 'ecmascript',
      tsx: isJsx,
      jsx: isJsx
    });
  } catch (err) {
    errorCount++;
    console.error(`❌ Syntax Error in ${filePath}:`, err.message);
    syntaxErrors.push({ file: filePath, error: err.message });
  }
}

console.log('\n================ PARSE SUMMARY ================');
console.log(`Total Files Checked: ${allFiles.length}`);
console.log(`Total Syntax Errors Found: ${errorCount}`);

if (syntaxErrors.length > 0) {
  console.log('\nFiles with errors:');
  syntaxErrors.forEach(e => console.log(`- ${e.file}: ${e.error}`));
}
