import fs from 'fs';
import path from 'path';

// Let's test compiling purchase-loading-records-view.tsx line by line or section by section using TypeScript compiler API
import ts from 'typescript';

const file = 'features/purchases/components/purchase-loading-records-view.tsx';
const content = fs.readFileSync(file, 'utf8');

const result = ts.transpileModule(content, {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext
  },
  reportDiagnostics: true
});

let log = [];
log.push(`Transpile diagnostics count: ${result.diagnostics ? result.diagnostics.length : 0}`);
if (result.diagnostics && result.diagnostics.length > 0) {
  for (const d of result.diagnostics) {
    if (d.file) {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      const text = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      log.push(`Line ${line + 1}:${character + 1} (Code ${d.code}) - ${text}`);
      const lineText = content.split('\n')[line];
      log.push(`   Code: ${lineText}`);
    } else {
      log.push(`Global error: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    }
  }
}

fs.mkdirSync('.tmp', { recursive: true });
fs.writeFileSync('.tmp/parse-errors.txt', log.join('\n'));
console.log('Written to .tmp/parse-errors.txt');
