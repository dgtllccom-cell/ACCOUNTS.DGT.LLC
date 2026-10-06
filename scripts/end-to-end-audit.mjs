import fs from 'fs';
import path from 'path';
import ts from 'typescript';

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git' && file !== '.codex' && file !== '_review-conflicts') {
        scanDir(filePath, fileList);
      }
    } else if (/\.(tsx|ts)$/.test(file)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = [...scanDir('app'), ...scanDir('features'), ...scanDir('lib'), ...scanDir('components')];
console.log(`Auditing ${allFiles.length} TypeScript / TSX files...`);

let report = [];
let totalErrors = 0;

for (const file of allFiles) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const result = ts.transpileModule(content, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        noEmit: true
      },
      reportDiagnostics: true
    });

    if (result.diagnostics && result.diagnostics.length > 0) {
      report.push(`\n❌ ERROR IN ${file}:`);
      totalErrors += result.diagnostics.length;
      for (const diag of result.diagnostics) {
        if (diag.file) {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
          const text = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
          report.push(`  Line ${line + 1}:${character + 1} - ${text}`);
        } else {
          report.push(`  Global - ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`);
        }
      }
    }
  } catch (e) {
    report.push(`\n❌ CRASH PARSING ${file}: ${e.message}`);
    totalErrors++;
  }
}

if (totalErrors === 0) {
  report.push(`\n✅ ALL ${allFiles.length} FILES PASSED TRANSPILE AUDIT WITH ZERO SYNTAX/PARSING ERRORS!`);
} else {
  report.push(`\n⚠️ TOTAL ERRORS FOUND ACROSS PROJECT: ${totalErrors}`);
}

fs.mkdirSync('.tmp', { recursive: true });
fs.writeFileSync('.tmp/audit-report.txt', report.join('\n'));
console.log(`Audit complete. Found ${totalErrors} errors. Written to .tmp/audit-report.txt`);
