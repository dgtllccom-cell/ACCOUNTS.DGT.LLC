import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const filePath = 'features/purchases/components/purchase-loading-records-view.tsx';
const fileContent = fs.readFileSync(filePath, 'utf8');

const sourceFile = ts.createSourceFile(
  filePath,
  fileContent,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

let output = [];
const diagnostics = sourceFile.parseDiagnostics;
if (diagnostics && diagnostics.length > 0) {
  output.push(`Found ${diagnostics.length} diagnostic error(s) in ${filePath}:`);
  for (const diag of diagnostics) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(diag.start);
    output.push(`Line ${line + 1}:${character + 1} - ${diag.messageText}`);
    const lineContent = fileContent.split('\n')[line];
    output.push(`  Snippet: ${lineContent}`);
  }
} else {
  output.push('No TSX parse syntax errors found in purchase-loading-records-view.tsx!');
}

// Also check all files in features/
const featuresFiles = [];
function findFiles(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) findFiles(full);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) featuresFiles.push(full);
  }
}
findFiles('features');

for (const f of featuresFiles) {
  const content = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length > 0) {
    output.push(`\n=== ERROR IN ${f} ===`);
    for (const diag of sf.parseDiagnostics) {
      const { line, character } = sf.getLineAndCharacterOfPosition(diag.start);
      output.push(`Line ${line + 1}:${character + 1} - ${diag.messageText}`);
      output.push(`  Snippet: ${content.split('\n')[line]}`);
    }
  }
}

fs.mkdirSync('.tmp', { recursive: true });
fs.writeFileSync('.tmp/check-results.txt', output.join('\n'));
console.log('Results written to .tmp/check-results.txt');
