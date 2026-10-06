/**
 * Page images of an uploaded PDF for the review viewer.
 *
 * The browser's own PDF viewer cannot be driven (fit-to-width, zoom, page jump, rotate) and renders a tiny
 * preview inside an iframe. We render each page to a PNG once (pdf-parse screenshot, cached on disk next to the
 * private upload) and let the viewer show it at any size. Auth + scope are checked by the route, never here.
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "storage", "document-intake", "_pages");

const toBuffer = (entry: any): Buffer | null => {
  if (!entry) return null;
  if (Buffer.isBuffer(entry)) return entry;
  const raw = entry.data ?? entry.buffer ?? null;
  if (raw) return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  if (typeof entry.dataUrl === "string") {
    const b64 = entry.dataUrl.split(",")[1];
    if (b64) return Buffer.from(b64, "base64");
  }
  return null;
};

export const ALLOWED_SCALES = [1.5, 2, 3] as const;

export async function renderPdfPage(jobId: string, pdf: Buffer, page: number, scale: number): Promise<Buffer> {
  const sc = (ALLOWED_SCALES as readonly number[]).includes(scale) ? scale : 2;
  const file = path.join(ROOT, jobId, `${page}@${sc}.png`);
  try {
    return await fs.readFile(file);
  } catch { /* not cached yet */ }

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(pdf) });
  try {
    const shot: any = await (parser as any).getScreenshot({ pages: [page], scale: sc });
    const entry = Buffer.isBuffer(shot) ? shot : (shot?.pages?.[0] ?? shot);
    const buf = toBuffer(entry);
    if (!buf) throw new Error("Could not render this page.");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buf, { mode: 0o600 });
    return buf;
  } finally {
    await parser.destroy?.();
  }
}

export async function pdfPageCount(pdf: Buffer): Promise<number> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(pdf) });
  try {
    const info: any = await (parser as any).getInfo?.();
    return Number(info?.total || info?.numpages || 0) || 0;
  } finally {
    await parser.destroy?.();
  }
}
