import fs from 'fs';
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

const diagnostics = sourceFile.parseDiagnostics;
if (diagnostics && diagnostics.length > 0) {
  console.log(`Found ${diagnostics.length} diagnostic error(s) in ${filePath}:`);
  for (const diag of diagnostics) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(diag.start);
    console.log(`Line ${line + 1}:${character + 1} - ${diag.messageText}`);
  }
} else {
  console.log('No TSX parse syntax errors found in purchase-loading-records-view.tsx!');
}
