import fs from 'fs';
import typescript from 'typescript';

function checkFile(filepath) {
  console.log(`Checking ${filepath}...`);
  const content = fs.readFileSync(filepath, 'utf8');
  const sourceFile = typescript.createSourceFile(
    filepath,
    content,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TSX
  );

  const diagnostics = sourceFile.parseDiagnostics || [];
  if (diagnostics.length > 0) {
    console.error(`❌ Parse Errors in ${filepath}:`);
    for (const d of diagnostics) {
      const lineChar = sourceFile.getLineAndCharacterOfPosition(d.start);
      console.error(`  - Line ${lineChar.line + 1}, Col ${lineChar.character + 1}: ${d.messageText}`);
    }
  } else {
    console.log(`✅ ${filepath} parsed with ZERO syntax/JSX errors!`);
  }
}

checkFile('features/branches/components/city-branch-setup.tsx');
checkFile('features/branches/components/country-branch-setup.tsx');
