/**
 * DEV probe — runs the AI Document Intake pipeline (the same LocalDocumentAiProvider: OCR → classify → extract) on a file and
 * prints the OCR text per page, the classification, every extracted field and the goods lines. Nothing is written anywhere.
 *   node_modules/.bin/vite-node --config vitest.config.mjs scripts/dev/intake-ocr-probe.mts (PROBE_FILE=<file.pdf|png|jpg>)
 */
import fs from "node:fs";
import { LocalDocumentAiProvider } from "@/lib/document-intelligence/providers/local";
import { withReadPg } from "@/lib/db/local-postgres";

const file = process.env.PROBE_FILE || process.argv.slice(2).find((a) => !a.startsWith("-") && fs.existsSync(a));
if (!file) throw new Error("usage: intake-ocr-probe.mts -- <file>");
const buffer = fs.readFileSync(file);
const provider = new LocalDocumentAiProvider();
const t0 = Date.now();
const ingest = await provider.ingest({
  buffer, mimeType: file.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png", filename: file,
  onProgress: (p, n) => { process.stderr.write(`ocr page ${p}/${n} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`); }
});
console.log(`engine=${ingest.engine} pages=${ingest.pageCount} digital=${ingest.isDigital} conf=${ingest.meanConfidence?.toFixed?.(2)} lang=${ingest.languageDetected} ms=${ingest.ocrMs}`);
for (const p of ingest.pages) console.log(`--- page ${p.pageNumber} (${p.text.replace(/\s/g, "").length} chars)\n${p.text.slice(0, 1800)}`);
const registry = ((await withReadPg((sql) => sql`SELECT code, name, operational_domain, category, target_module, classifier_keywords, min_confidence::float AS min_confidence, requires_qvc, expected_fields FROM public.document_type_registry WHERE deleted_at IS NULL AND is_active ORDER BY rank_order`)) ?? []) as any[];
const cls = await provider.classify(ingest.fullText, registry, "business");
console.log("classified:", cls.code, cls.confidence, JSON.stringify(cls.scores?.slice?.(0, 4)));
const docType = registry.find((d) => d.code === "purchase_contract") ?? registry[0];
const ex = await provider.extract({ text: ingest.fullText, pages: ingest.pages, docType });
console.log(`fields (${ex.fields.length}):`);
for (const f of ex.fields) console.log(`  ${f.key.padEnd(22)} = ${JSON.stringify(f.normalizedValue ?? f.rawValue).slice(0, 110)}  [${f.validationStatus ?? ""} ${f.confidence ?? ""}]`);
console.log(`line items (${ex.lineItems.length}):`);
for (const li of ex.lineItems) console.log("  ", JSON.stringify(li).slice(0, 300));
process.exit(0);
