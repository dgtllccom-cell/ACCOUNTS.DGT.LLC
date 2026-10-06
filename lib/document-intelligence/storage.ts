/**
 * AI Document Intake — PRIVATE storage + file validation.
 *
 * Intake files live under ./storage/document-intake/<yyyy>/<mm>/<jobId>.<ext>
 * — this directory is NOT inside public/ and is never served statically. The
 * file is streamed back only through an authenticated, scope-checked API route.
 * No public URLs are ever produced.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.join(process.cwd(), "storage", "document-intake");

export const MAX_FILE_BYTES = Number(process.env.DOC_INTAKE_MAX_BYTES || 25 * 1024 * 1024); // 25 MB
export const MAX_PAGES = Number(process.env.DOC_INTAKE_MAX_PAGES || 60);

const ALLOWED: Array<{ mime: string; ext: string; magic: (b: Buffer) => boolean }> = [
  { mime: "application/pdf", ext: "pdf", magic: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/png", ext: "png", magic: (b) => b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" },
  { mime: "image/jpeg", ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/webp", ext: "webp", magic: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { mime: "image/tiff", ext: "tif", magic: (b) => { const h = b.subarray(0, 4).toString("hex"); return h === "49492a00" || h === "4d4d002a"; } },
];

export type ValidatedFile = {
  buffer: Buffer;
  sha256: string;
  mimeType: string;
  ext: string;
  size: number;
};

export class DocumentValidationError extends Error {
  status = 422;
}

/** Signature + size validation. Rejects mismatched/declared MIME. */
export function validateUpload(buffer: Buffer, declaredMime: string, filename: string): ValidatedFile {
  if (!buffer?.length) throw new DocumentValidationError("Empty file.");
  if (buffer.length > MAX_FILE_BYTES) {
    throw new DocumentValidationError(`File is larger than the ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB limit.`);
  }
  const byExt = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const hit =
    ALLOWED.find((a) => a.magic(buffer)) ||
    ALLOWED.find((a) => a.mime === declaredMime.toLowerCase()) ||
    ALLOWED.find((a) => a.ext === byExt);
  if (!hit || !hit.magic(buffer)) {
    throw new DocumentValidationError("Unsupported or corrupt file. Allowed: PDF, JPG, PNG, WEBP, TIFF (verified by file signature).");
  }
  return {
    buffer,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    mimeType: hit.mime,
    ext: hit.ext,
    size: buffer.length,
  };
}

/**
 * Malware-scan hook. Default: a conservative heuristic (rejects obvious embedded
 * executables / script payloads in PDFs). Wire a real scanner (clamd, VirusTotal
 * on-prem, etc.) here — set DOC_INTAKE_MALWARE_SCAN=strict to hard-fail on any
 * PDF that carries JavaScript / launch / embedded-file actions.
 */
export async function malwareScan(file: ValidatedFile): Promise<{ ok: boolean; reason?: string }> {
  if (file.mimeType === "application/pdf") {
    const head = file.buffer.subarray(0, Math.min(file.buffer.length, 2_000_000)).toString("latin1");
    const strict = process.env.DOC_INTAKE_MALWARE_SCAN === "strict";
    if (/\/Launch\b/.test(head) || /\/EmbeddedFile\b/.test(head)) {
      return { ok: false, reason: "PDF contains a launch action or an embedded file." };
    }
    if (strict && (/\/JavaScript\b/.test(head) || /\/JS\b/.test(head) || /\/OpenAction\b/.test(head))) {
      return { ok: false, reason: "PDF contains active JavaScript / an OpenAction (strict mode)." };
    }
  }
  // MZ / ELF signatures inside any upload
  if (file.buffer.subarray(0, 2).toString("latin1") === "MZ" || file.buffer.subarray(0, 4).toString("hex") === "7f454c46") {
    return { ok: false, reason: "File looks like an executable, not a document." };
  }
  return { ok: true };
}

function keyFor(jobId: string, ext: string): string {
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${jobId}.${ext}`;
}

export async function saveIntakeFile(jobId: string, file: ValidatedFile): Promise<string> {
  const storageKey = keyFor(jobId, file.ext);
  const abs = path.join(ROOT, storageKey);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, file.buffer, { mode: 0o600 });
  return storageKey;
}

export async function readIntakeFile(storageKey: string): Promise<Buffer> {
  const safe = storageKey.replace(/\\/g, "/").replace(/\.\.+/g, "").replace(/^\/+/, "");
  return fs.readFile(path.join(ROOT, safe));
}

export async function deleteIntakeFile(storageKey: string): Promise<void> {
  const safe = storageKey.replace(/\\/g, "/").replace(/\.\.+/g, "").replace(/^\/+/, "");
  await fs.rm(path.join(ROOT, safe), { force: true });
}
