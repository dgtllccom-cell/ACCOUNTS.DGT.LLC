import fs from "node:fs";
import crypto from "node:crypto";
import { LocalDocumentAiProvider } from "@/lib/document-intelligence/providers/local";

const FILE = "uat-samples/2-containers.pdf";

(async () => {
  const buffer = fs.readFileSync(FILE);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  console.log("file:", FILE, "bytes:", buffer.length, "sha256:", sha256);

  const provider = new LocalDocumentAiProvider();
  const t0 = Date.now();
  const ing = await provider.ingest({ buffer, mimeType: "application/pdf", filename: "2-containers.pdf" });
  console.log("\n=== INGEST ===");
  console.log("engine:", ing.engine);
  console.log("isDigital:", ing.isDigital, "pageCount:", ing.pageCount, "ocrMs:", ing.ocrMs);
  console.log("languageDetected:", ing.languageDetected, "meanConfidence:", ing.meanConfidence);
  console.log("fullText length:", ing.fullText.length);
  console.log("\n=== FULL OCR TEXT ===\n");
  console.log(ing.fullText);

  fs.writeFileSync("scratch/uat-ocr-text.txt", ing.fullText);
  console.log("\n[written scratch/uat-ocr-text.txt]  total", ((Date.now() - t0) / 1000).toFixed(1), "s");
})().catch((e) => { console.error("ERR", e); process.exit(1); });
