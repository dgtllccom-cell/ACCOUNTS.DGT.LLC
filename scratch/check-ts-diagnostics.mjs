import ts from 'typescript';

const program = ts.createProgram(['lib/navigation/sidebar.ts'], {
  noEmit: true,
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: false,
  skipLibCheck: true
});

const diagnostics = ts.getPreEmitDiagnostics(program);
let count = 0;
for (const d of diagnostics) {
  if (d.file && d.file.fileName.includes('sidebar.ts')) {
    count++;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    console.log(`sidebar.ts (${line + 1},${character + 1}): ${message}`);
  }
}
console.log('Sidebar error count:', count);
