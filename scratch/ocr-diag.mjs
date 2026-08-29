import fs from "node:fs";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";

async function ocr(buf, label, psm) {
  const w = await createWorker("eng", 1);
  await w.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await w.recognize(buf);
  await w.terminate();
  const txt = (data.text || "").replace(/\s+/g, " ").trim();
  console.log(`\n--- ${label} (PSM ${psm}) conf=${(data.confidence||0).toFixed(1)} len=${txt.length} ---`);
  console.log(txt.slice(0, 500));
}

const shot4 = fs.readFileSync("scratch/uat-p1-scale4.png");        // 2380x3368 rendered
const emb = fs.readFileSync("scratch/uat-p1-embedded.2");          // 1856x2720 embedded PNG

// A: raw rendered, PSM 3 (auto, no OSD) and 6 (uniform block)
await ocr(shot4, "rendered scale4 raw", PSM.AUTO);
await ocr(shot4, "rendered scale4 raw", PSM.SINGLE_BLOCK);

// B: embedded image raw
await ocr(emb, "embedded raw", PSM.AUTO);

// C: embedded, gentle preprocess (grayscale + threshold only, upscale)
const pre = await sharp(emb).grayscale().resize({ width: 2600 }).normalize().toFormat("png").toBuffer();
await ocr(pre, "embedded grayscale+resize2600+normalize", PSM.AUTO);

// D: current pipeline preprocess replica (upscale<1400 -> 1800, grayscale normalise sharpen)
const preCur = await sharp(shot4).rotate().grayscale().normalise().sharpen().toFormat("png").toBuffer();
await ocr(preCur, "current-pipeline replica on scale4", PSM.AUTO);
