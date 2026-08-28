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

async function ingestPdf(buffer: Buffer): Promise<{ pages: OcrPage[]; fullText: string; isDigital: boolean; ocrUsed: boolean; meanConfidence: number | null }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const res = await parser.getText();
    let pages: OcrPage[] = (res.pages ?? []).map((p: any, i: number) => ({
      pageNumber: i + 1,
      text: String(p.text ?? ""),
    }));
    let fullText = pages.map((p) => p.text).join("\n\n").trim();
    const isDigital = fullText.replace(/\s/g, "").length > 40;
    if (isDigital) {
      return { pages: pages.length ? pages : [{ pageNumber: 1, text: fullText }], fullText, isDigital: true, ocrUsed: false, meanConfidence: null };
    }
    // Scanned PDF (no text layer) → render each page to an image and OCR it.
    const maxPages = Number(process.env.DOC_INTAKE_MAX_PAGES || 60);
    const confs: number[] = [];
    const ocrPages: OcrPage[] = [];
    let pageNo = 0;
    while (pageNo < maxPages) {
      pageNo += 1;
      let shot: { buffer?: Buffer } | Buffer | null = null;
      try {
        shot = await (parser as any).getScreenshot({ pages: [pageNo], scale: 2.0 });
      } catch { break; }
      const imgBuf: Buffer | null = Buffer.isBuffer(shot) ? shot : (shot as any)?.pages?.[0]?.buffer ?? (shot as any)?.buffer ?? null;
      if (!imgBuf) break;
      const pre = await preprocessImage(imgBuf, "image/png");
      const r = await ocrImage(pre);
      confs.push(r.meanConfidence);
      ocrPages.push({ pageNumber: pageNo, text: r.text, wordBoxes: r.words });
    }
    if (ocrPages.length) {
      pages = ocrPages;
      fullText = ocrPages.map((p) => p.text).join("\n\n").trim();
      return { pages, fullText, isDigital: false, ocrUsed: true, meanConfidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0 };
    }
    return { pages: pages.length ? pages : [{ pageNumber: 1, text: "" }], fullText, isDigital: false, ocrUsed: false, meanConfidence: 0 };
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
  const opts: Record<string, unknown> = { cachePath: VENDOR_DIR };
  if (hasVendor("tesseract-core.wasm")) opts.corePath = VENDOR_DIR;
  // A vendored, UNcompressed <lang>.traineddata → point langPath there with gzip:false.
  // A vendored <lang>.traineddata.gz → langPath + gzip stays true (default).
  const firstLang = OCR_LANGS.split("+")[0];
  if (fs.existsSync(path.join(VENDOR_DIR, `${firstLang}.traineddata.gz`))) {
    opts.langPath = VENDOR_DIR;
  } else if (fs.existsSync(path.join(VENDOR_DIR, `${firstLang}.traineddata`))) {
    opts.langPath = VENDOR_DIR;
    opts.gzip = false;
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
      const { pages, fullText, isDigital, ocrUsed, meanConfidence } = await ingestPdf(input.buffer);
      return {
        engine: isDigital ? "pdf-parse" : ocrUsed ? `pdf-parse+tesseract.js@${OCR_LANGS}` : "pdf-parse(no-text-layer)",
        isDigital,
        pageCount: pages.length,
        fullText,
        pages,
        languageDetected: detectLanguage(fullText),
        ocrMs: Date.now() - started,
        meanConfidence: isDigital ? null : meanConfidence,
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
    const summary: Record<string, string | number | null> = {};
    for (const f of fields) summary[f.key] = f.normalizedValue ?? f.rawValue;
    return { fields, lineItems, summary };
  }
}
