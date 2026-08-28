/**
 * Vendor the tesseract.js WASM core + language traineddata into ./vendor/ocr/
 * so the OCR engine runs with NO outbound internet on the VPS.
 *
 * Run once at deploy time (or commit the vendor/ocr/ folder):
 *   node scripts/vendor-ocr-assets.mjs
 *
 * Languages: eng + ara (Arabic script covers ar/ur/fa/ps) + osd (orientation).
 * Override with:  OCR_VENDOR_LANGS="eng ara fas"  node scripts/vendor-ocr-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const OUT = path.join(process.cwd(), "vendor", "ocr");
fs.mkdirSync(OUT, { recursive: true });

const CORE_VER = "5.1.1";      // tesseract.js-core
const DATA_REPO = "tessdata_best"; // or tessdata_fast
const LANGS = (process.env.OCR_VENDOR_LANGS || "eng ara osd").split(/\s+/).filter(Boolean);

const files = [
  { url: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VER}/tesseract-core-simd.wasm`, out: "tesseract-core.wasm" },
  { url: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VER}/tesseract-core-simd.wasm.js`, out: "tesseract-core.wasm.js" },
  ...LANGS.map((l) => ({ url: `https://github.com/tesseract-ocr/${DATA_REPO}/raw/main/${l}.traineddata`, out: `${l}.traineddata` })),
];

function download(url, out, redirects = 0) {
  return new Promise((resolve, reject) => {
    const dest = path.join(OUT, out);
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { "User-Agent": "dgt-erp-ocr-vendor" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        file.close(); fs.rmSync(dest, { force: true });
        return resolve(download(res.headers.location, out, redirects + 1));
      }
      if (res.statusCode !== 200) { file.close(); fs.rmSync(dest, { force: true }); return reject(new Error(`${res.statusCode} ${url}`)); }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
    }).on("error", (e) => { file.close(); fs.rmSync(dest, { force: true }); reject(e); });
  });
}

const results = [];
for (const f of files) {
  try {
    const dest = await download(f.url, f.out);
    results.push(`  ✓ ${f.out}  (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (e) {
    results.push(`  ✗ ${f.out}  — ${e.message}`);
  }
}
console.log(`vendor/ocr/ populated:\n${results.join("\n")}`);
console.log("\nSet DOC_INTAKE_OCR_LANGS in .env if you added more languages (default: eng+ara).");
