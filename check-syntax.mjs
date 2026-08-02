import fs from 'fs';
import typescript from 'typescript';

function checkFile(filepath) {
  console.log(`Checking ${filepath}...`);
  const content = fs.readFileSync(filepath, 'utf8');
  const result = typescript.transpileModule(content, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ESNext
    },
    fileName: filepath
  });
  if (result.diagnostics && result.diagnostics.length > 0) {
    console.error(`❌ Errors in ${filepath}:`);
    for (const d of result.diagnostics) {
      console.error(`  - Line ${d.file ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : '?'}: ${d.messageText}`);
    }
  } else {
    console.log(`✅ No syntax errors in ${filepath}`);
  }
}

checkFile('features/branches/components/city-branch-setup.tsx');
checkFile('features/branches/components/country-branch-setup.tsx');
