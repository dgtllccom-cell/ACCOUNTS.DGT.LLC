import sharp from "sharp";
import { withLocalPg } from "../lib/db/local-postgres";
import { documentIntakeService } from "../lib/services/document-intake-service";
import type { IntakeScope } from "../lib/document-intelligence/scope";
const G: IntakeScope = { domain: null, countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: true };
const A = "00000000-0000-0000-0000-000000000000";
const ids: string[] = [];
async function svg(lines: string[], w=1000) {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${80+lines.length*46}"><rect width="100%" height="100%" fill="white"/>${lines.map((l,i)=>`<text x="40" y="${58+i*46}" font-family="DejaVu Sans" font-size="26" fill="black">${l}</text>`).join("")}</svg>`;
  return Buffer.from(s);
}
async function run(name: string, buf: Buffer, mime: string, fname: string) {
  const j = await documentIntakeService.createJob({ operationalDomain: "business" }, { buffer: buf, declaredMime: mime, filename: fname }, A, "FMT", G);
  ids.push(j.id);
  await documentIntakeService.processJob(j.id, A, "FMT", G);
  const d = await documentIntakeService.get(j.id, G);
  const fields = (d?.fields ?? []).map((f:any)=>f.field_key);
  console.log(`${name.padEnd(28)} engine=${d?.job.ocr_engine} status=${d?.job.status} fields=${fields.length} [${fields.slice(0,4).join(",")}]`);
}

// rotated 90° JPEG (EXIF-less physical rotation — sharp.rotate() auto-orient won't help; tests raw robustness)
const base = await sharp(await svg(["COMMERCIAL INVOICE","Invoice No: INV-ROT-1","Currency: AED   Grand Total: AED 61000.00"])).png().toBuffer();
await run("rotated 90° image", await sharp(base).rotate(90).jpeg().toBuffer(), "image/jpeg", "rotated.jpg");
// rotated with EXIF orientation tag (the realistic phone-photo case)
await run("EXIF-orient image", await sharp(base).rotate(270).withMetadata({ orientation: 6 }).jpeg().toBuffer(), "image/jpeg", "exif.jpg");
// WEBP
await run("WEBP scan", await sharp(await svg(["PACKING LIST","Container Numbers: WEBU1234567","Gross Weight: 22000 kg"])).webp().toBuffer(), "image/webp", "scan.webp");
// TIFF
await run("TIFF scan", await sharp(await svg(["DELIVERY ORDER","D/O No: DO-TIF-9","Vessel: MV TIFF"])).tiff().toBuffer(), "image/tiff", "scan.tif");
// large / hi-res
await run("hi-res 2400px image", await sharp(await svg(["COMMERCIAL INVOICE","Invoice No: INV-HR-1","Grand Total: AED 90000.00"], 2400)).png().toBuffer(), "image/png", "hires.png");
// Arabic / RTL text
await run("Arabic-script content", await sharp(await svg(["فاتورة تجارية","رقم الفاتورة: INV-AR-77","المبلغ الإجمالي: AED 12500.00"])).png().toBuffer(), "image/png", "arabic.png");

await withLocalPg(async (sql) => { for (const id of ids) await sql`DELETE FROM public.document_intake_jobs WHERE id = ${id}`; });
console.log("\ndone, cleaned");
process.exit(0);
