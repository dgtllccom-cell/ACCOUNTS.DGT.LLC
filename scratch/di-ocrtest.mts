import sharp from "sharp";
import { LocalDocumentAiProvider } from "../lib/document-intelligence/providers/local";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400">
<rect width="900" height="400" fill="white"/>
<text x="30" y="60" font-family="DejaVu Sans, Arial" font-size="28" fill="black">COMMERCIAL INVOICE</text>
<text x="30" y="120" font-family="Arial" font-size="22" fill="black">Invoice No: INV-2026-0453   Date: 12/07/2026</text>
<text x="30" y="160" font-family="Arial" font-size="22" fill="black">Grand Total: AED 69700.00</text>
<text x="30" y="200" font-family="Arial" font-size="22" fill="black">Container: MSCU1234567</text>
</svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();
const p = new LocalDocumentAiProvider();
const t0 = Date.now();
const res = await p.ingest({ buffer: png, mimeType: "image/png", filename: "invoice.png" });
console.log("engine:", res.engine, "| ms:", Date.now()-t0, "| meanConf:", res.meanConfidence?.toFixed(2), "| lang:", res.languageDetected);
console.log("OCR TEXT:\n", res.fullText.slice(0, 400));
