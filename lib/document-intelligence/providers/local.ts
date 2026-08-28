/**
 * AI Document Intake — LOCAL provider (default + complete path).
 *
 *   * Digital PDFs  → pdf-parse (text layer, no OCR)
 *   * Scanned PDFs / images / photos → tesseract.js WASM OCR (+ sharp pre-process:
 *     auto-rotate, grayscale, normalise, upscale small scans)
 *   * classification + extraction → local heuristic rules (extractors.ts)
 *
 * No network calls for processing. The tesseract WASM core + language data are
 * loaded from a local vendor path when present (scripts/vendor-ocr-assets.mjs),
 * otherwise from the packaged tesseract.js defaults on first run (cached locally).
 */

import path from "node:path";
import fs from "node:fs";
import type {
  DocumentAiProvider, IngestResult, OcrPage, ClassificationResult, ExtractionResult, RegistryDocType, OperationalDomain,
} from "../types";
import { classifyByKeywords, extractFields, extractLineItems } from "../extractors";

const VENDOR_DIR = path.join(process.cwd(), "vendor", "ocr");
const hasVendor = (f: string) => {
  try { return fs.existsSync(path.join(VENDOR_DIR, f)); } catch { return false; }
};

const OCR_LANGS = process.env.DOC_INTAKE_OCR_LANGS || "eng+ara";

function detectLanguage(text: string): string | null {
  const t = text.slice(0, 4000);
  if (/[؀-ۿ]/.test(t)) {
    // Arabic-script block covers ar / ur / fa / ps — pick by distinctive letters
    if (/[پچژگںھی]/.test(t)) return "ur"; // pe/che/zhe/gaf/nun-ghunna/heh-doachashmee/farsi-yeh
    if (/[ګہ]/.test(t)) return "ps";
    if (/[یک]/.test(t)) return "fa";
    return "ar";
  }
  if (/[ऀ-ॿ]/.test(t)) return "hi";
  return "en";
}

async function ingestPdf(buffer: Buffer): Promise<{ pages: OcrPage[]; fullText: string; isDigital: boolean }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const res = await parser.getText();
    const pages: OcrPage[] = (res.pages ?? []).map((p: any, i: number) => ({
      pageNumber: i + 1,
      text: String(p.text ?? ""),
    }));
    const fullText = pages.map((p) => p.text).join("\n\n").trim();
    // digital if there is a meaningful text layer
    const isDigital = fullText.replace(/\s/g, "").length > 40;
    return { pages: pages.length ? pages : [{ pageNumber: 1, text: fullText }], fullText, isDigital };
  } finally {
    await parser.destroy?.();
  }
}

async function preprocessImage(buffer: Buffer, mime: string): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    let img = sharp(buffer, { failOn: "none" }).rotate(); // auto-orient from EXIF
    const meta = await img.metadata();
    if ((meta.width ?? 0) < 1400) img = img.resize({ width: 1800, withoutEnlargement: false });
    return await img.grayscale().normalise().sharpen().toFormat("png").toBuffer();
  } catch {
    return buffer;
  }
}

async function ocrImage(buffer: Buffer): Promise<{ text: string; meanConfidence: number; words: OcrPage["wordBoxes"] }> {
  const { createWorker, PSM } = await import("tesseract.js");
  const opts: Record<string, unknown> = {};
  if (hasVendor("tesseract-core.wasm")) opts.corePath = VENDOR_DIR;
  if (fs.existsSync(path.join(VENDOR_DIR, "eng.traineddata")) || fs.existsSync(path.join(VENDOR_DIR, "eng.traineddata.gz"))) {
    opts.langPath = VENDOR_DIR;
  }
  const worker = await createWorker(OCR_LANGS, 1, opts as never);
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await worker.recognize(buffer);
    const words = (data.words ?? []).map((w: any) => ({
      text: w.text, x: w.bbox?.x0 ?? 0, y: w.bbox?.y0 ?? 0,
      w: (w.bbox?.x1 ?? 0) - (w.bbox?.x0 ?? 0), h: (w.bbox?.y1 ?? 0) - (w.bbox?.y0 ?? 0),
      confidence: (w.confidence ?? 0) / 100,
    }));
    return { text: data.text || "", meanConfidence: (data.confidence ?? 0) / 100, words };
  } finally {
    await worker.terminate();
  }
}

export class LocalDocumentAiProvider implements DocumentAiProvider {
  readonly name = "local";

  async ingest(input: { buffer: Buffer; mimeType: string; filename: string }): Promise<IngestResult> {
    const started = Date.now();
    const mime = (input.mimeType || "").toLowerCase();
    const isPdf = mime.includes("pdf") || input.filename.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      const { pages, fullText, isDigital } = await ingestPdf(input.buffer);
      if (isDigital) {
        return {
          engine: "pdf-parse", isDigital: true, pageCount: pages.length, fullText, pages,
          languageDetected: detectLanguage(fullText), ocrMs: Date.now() - started, meanConfidence: null,
        };
      }
      // scanned PDF with no text layer — OCR is not run on PDF pages directly here
      // (needs pdf→image raster). Return the (empty) text so the caller routes to
      // QVC "document unreadable" unless an image is provided instead.
      return {
        engine: "pdf-parse(no-text-layer)", isDigital: false, pageCount: pages.length,
        fullText, pages, languageDetected: null, ocrMs: Date.now() - started, meanConfidence: 0,
      };
    }

    // image / photo
    const pre = await preprocessImage(input.buffer, mime);
    const { text, meanConfidence, words } = await ocrImage(pre);
    const pages: OcrPage[] = [{ pageNumber: 1, text, wordBoxes: words }];
    return {
      engine: `tesseract.js@${OCR_LANGS}`, isDigital: false, pageCount: 1, fullText: text, pages,
      languageDetected: detectLanguage(text), ocrMs: Date.now() - started, meanConfidence,
    };
  }

  async classify(text: string, registry: RegistryDocType[], domainHint?: OperationalDomain | null): Promise<ClassificationResult> {
    return classifyByKeywords(text, registry, domainHint ?? null);
  }

  async extract(input: { text: string; pages: OcrPage[]; docType: RegistryDocType }): Promise<ExtractionResult> {
    const fields = extractFields(input.text, input.pages, input.docType.code);
    const lineItems = extractLineItems(input.text, input.pages);
    const summary: Record<string, unknown> = {};
    for (const f of fields) summary[f.key] = f.normalizedValue ?? f.rawValue;
    return { fields, lineItems, summary };
  }
}
