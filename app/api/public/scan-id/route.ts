/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Public API: /api/public/scan-id
 *
 * No authentication required — public OCR & Smart ID parsing endpoint.
 * Accepts:
 *   - JSON { imageBase64: string, docTypeHint?: string }
 *   - or FormData with file / image
 *
 * Runs OCR and parses Identity Documents (Emirates ID, CNIC, Aadhaar, Tazkira, Passport).
 */

import { NextRequest, NextResponse } from "next/server";
import { parseIdCardText } from "@/lib/document-intelligence/id-card-extractor";

export const dynamic = "force-dynamic";

let globalWorkerPromise: Promise<any> | null = null;

async function getOcrWorker() {
  if (!globalWorkerPromise) {
    globalWorkerPromise = (async () => {
      try {
        const { createWorker, PSM } = await import("tesseract.js");
        const worker = await createWorker("eng", 1, {
          logger: () => {}, // suppress verbose logs
        });
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        } as any);
        return worker;
      } catch (e) {
        console.warn("[Scan ID] Worker init fallback:", e);
        globalWorkerPromise = null;
        return null;
      }
    })();
  }
  return globalWorkerPromise;
}

async function ocrImageBuffer(buffer: Buffer): Promise<string> {
  try {
    // 1. Preprocess with Sharp if available
    let processedBuffer = buffer;
    try {
      const sharp = (await import("sharp")).default;
      let img = sharp(buffer, { failOn: "none" }).rotate();
      const meta = await img.metadata();
      if ((meta.width ?? 0) < 1200) {
        img = img.resize({ width: 1400, withoutEnlargement: false });
      }
      processedBuffer = await img.grayscale().normalise().sharpen().toFormat("png").toBuffer();
    } catch (sharpErr) {
      console.warn("[Scan ID] Sharp preprocess skipped:", sharpErr);
    }

    // 2. Timeout-guarded OCR recognition (Max 12 seconds)
    const ocrPromise = (async () => {
      const worker = await getOcrWorker();
      if (!worker) return "";
      const ret = await worker.recognize(processedBuffer);
      return ret?.data?.text || "";
    })();

    const timeoutPromise = new Promise<string>((resolve) =>
      setTimeout(() => {
        console.warn("[Scan ID] OCR recognition timed out after 12s, returning fallback");
        resolve("");
      }, 12000)
    );

    return await Promise.race([ocrPromise, timeoutPromise]);
  } catch (ocrErr) {
    console.error("[Scan ID] OCR Engine Error:", ocrErr);
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    let buffer: Buffer | null = null;
    let docTypeHint: string | undefined;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);
      if (!body?.imageBase64) {
        return NextResponse.json({ ok: false, error: "Missing imageBase64 in JSON payload" }, { status: 400 });
      }
      docTypeHint = body.docTypeHint;
      const cleanBase64 = body.imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      buffer = Buffer.from(cleanBase64, "base64");
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      docTypeHint = (formData.get("docTypeHint") as string) || undefined;
      if (!file) {
        return NextResponse.json({ ok: false, error: "Missing file in form data" }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      return NextResponse.json({ ok: false, error: "Unsupported Content-Type" }, { status: 400 });
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ ok: false, error: "Empty image buffer" }, { status: 400 });
    }

    // Run OCR
    const ocrText = await ocrImageBuffer(buffer);

    // Extract structured ID fields
    const extracted = parseIdCardText(ocrText, docTypeHint);

    return NextResponse.json({
      ok: true,
      extracted,
      rawOcrText: ocrText,
    });
  } catch (err: any) {
    console.error("[Public Scan ID POST]", err);
    return NextResponse.json({ ok: false, error: err?.message || "Failed to scan document" }, { status: 500 });
  }
}
