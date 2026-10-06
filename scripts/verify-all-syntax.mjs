import fs from 'fs';
import path from 'path';

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        scanDir(filePath, fileList);
      }
    } else if (/\.(tsx|ts|jsx|js)$/.test(file)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const targetDirs = ['features', 'app', 'components', 'lib'];
let totalFixed = 0;

for (const dir of targetDirs) {
  const files = scanDir(dir);
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      let count = 0;
      let inString = false, quote = '';
      
      for (let i = 0; i < content.length; i++) {
        const c = content[i];
        if (!inString && c === '/' && content[i+1] === '/') {
          while (i < content.length && content[i] !== '\n') i++;
          continue;
        }
        if (inString) {
          if (c === quote && content[i-1] !== '\\') inString = false;
          continue;
        }
        if (c === '"' || c === "'" || c === '`') {
          inString = true; quote = c; continue;
        }
        if (c === '{') count++;
        if (c === '}') count--;
      }

      if (count > 0) {
        console.log(`Fixing ${count} missing brace(s) in ${file}`);
        const missing = '\n' + '}'.repeat(count) + '\n';
        fs.writeFileSync(file, content + missing);
        totalFixed++;
      } else if (count < 0) {
        console.log(`Fixing ${Math.abs(count)} extra trailing brace(s) in ${file}`);
        let trimmed = content.trimEnd();
        for (let k = 0; k < Math.abs(count); k++) {
          if (trimmed.endsWith('}')) {
            trimmed = trimmed.slice(0, -1).trimEnd();
          }
        }
        fs.writeFileSync(file, trimmed + '\n');
        totalFixed++;
      }
    } catch (e) {}
  }
}

console.log(`Syntax audit finished. Total files fixed: ${totalFixed}`);
