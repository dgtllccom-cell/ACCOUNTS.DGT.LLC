// DEV-only codemod: JSX <th> -> <Th> (components/ui/translated-th) so every table heading goes through the 5-language heading
// dictionary. Uses the TypeScript AST, so only real JSX elements change (HTML inside template strings for print is left alone).
// Usage: node codemod-th.mjs [--write]   (dry run by default)
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const WRITE = process.argv.includes("--write");
const roots = ["features", "components", "app"];
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|\.next/.test(p)) walk(p); } else if (/\.(tsx|jsx)$/.test(e.name)) files.push(p); } };
roots.forEach(walk);
const IMPORT = 'import { Th } from "@/components/ui/translated-th";';
let changedFiles = 0, changedTags = 0, skipped = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (!/<th\b/.test(src)) continue;
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TSX);
  // an existing local identifier named Th that is not our import would collide
  let thDeclaredElsewhere = false, hasImport = false, lastImportEnd = 0, firstStmtEnd = 0;
  sf.forEachChild((n) => {
    if (ts.isImportDeclaration(n)) {
      lastImportEnd = n.getEnd();
      const spec = n.moduleSpecifier.getText();
      if (/translated-th/.test(spec)) hasImport = true;
      else if (n.importClause && n.getText().match(/\bTh\b/)) thDeclaredElsewhere = true;
    } else if ((ts.isFunctionDeclaration(n) && n.name?.text === "Th") || (ts.isVariableStatement(n) && n.declarationList.declarations.some((d) => d.name.getText() === "Th"))) thDeclaredElsewhere = true;
  });
  if (thDeclaredElsewhere) { skipped.push(f); continue; }
  const edits = [];
  const visit = (n) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxClosingElement(n)) && n.tagName.getText() === "th") edits.push([n.tagName.getStart(), n.tagName.getEnd()]);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  let out = src;
  for (const [a, b] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + "Th" + out.slice(b);
  if (!hasImport) {
    const nl = src.includes("\r\n") ? "\r\n" : "\n";
    if (lastImportEnd) out = out.slice(0, lastImportEnd) + nl + IMPORT + out.slice(lastImportEnd);
    else { const m = out.match(/^(\s*(?:"use client";?|'use client';?)\s*)/); out = (m ? m[1] : "") + IMPORT + nl + out.slice(m ? m[1].length : 0); }
  }
  changedFiles++; changedTags += edits.length;
  if (WRITE) fs.writeFileSync(f, out, "utf8");
}
console.log(`${WRITE ? "WROTE" : "dry run"}: ${changedFiles} files, ${changedTags} <th> tags (opening/closing counted separately); skipped (own Th symbol): ${skipped.length}`);
for (const s of skipped) console.log("skipped", s);
