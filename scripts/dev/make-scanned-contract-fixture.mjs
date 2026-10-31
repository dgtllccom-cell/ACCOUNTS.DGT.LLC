/**
 * DEV test fixture — a 4-page phone-scanned (CamScanner-style) bilingual English / Chinese SALES CONTRACT, laid out like the
 * supplier contracts the owner uploads into AI Document Intake → Purchase Booking. Every page is a degraded photo (slight rotation,
 * blur, uneven paper tone, noise, JPEG) embedded as a full-page image, so the PDF has NO text layer and must be OCR'd.
 *   node scripts/dev/make-scanned-contract-fixture.mjs [out.pdf]
 * The expected values (contract no., parties, goods, quantity, price, total, terms, bank) are printed as JSON for the e2e checks.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const OUT = process.argv[2] || ".tmp/fixtures/dalian-sunshine-sales-contract-scan-4p.pdf";
fs.mkdirSync(path.dirname(OUT), { recursive: true });

export const EXPECTED = {
  contractNo: "DSA2023-1018",
  documentDate: "2023-10-11",
  seller: "DALIAN SUNSHINE IMP. & EXP. CO., LTD.",
  sellerZh: "大连赛恩进出口有限公司",
  buyer: "DAMAAN GENERAL TRADING LLC",
  goods: "SULTANA GOLDEN RAISINS",
  quantity: 220,
  unit: "MT",
  unitPrice: 5267,
  currency: "USD",
  total: 1158740,
  incoterm: "CFR",
  loadingPort: "DALIAN",
  destinationPort: "JEBEL ALI",
  hsCode: "0806.20",
  netWeight: 220000,
  grossWeight: 228800,
  bank: "BANK OF CHINA",
  swift: "BKCHCNBJ810",
  account: "307056789012"
};

const css = `
  @page { size: A4; margin: 0 }
  body { margin: 0; font-family: "Times New Roman", "SimSun", "Microsoft YaHei", serif; color: #111; }
  .pg { width: 1240px; height: 1754px; padding: 90px 100px; box-sizing: border-box; font-size: 25px; line-height: 1.45; }
  h1 { text-align: center; font-size: 40px; margin: 0 }
  h2 { text-align: center; font-size: 34px; letter-spacing: 6px; margin: 30px 0 6px }
  .zh { font-family: "SimSun", "Microsoft YaHei", serif }
  .c { text-align: center } .small { font-size: 21px }
  table { width: 100%; border-collapse: collapse; margin: 22px 0; font-size: 22px }
  td, th { border: 2px solid #222; padding: 8px 10px; vertical-align: top }
  .row { display: flex; justify-content: space-between } u { text-decoration: underline }
  .sign { display: flex; justify-content: space-between; margin-top: 180px; font-size: 27px }
`;
const header = `
  <h1>DALIAN SUNSHINE IMP. &amp; EXP. CO., LTD.</h1>
  <div class="c zh" style="font-size:32px">大连赛恩进出口有限公司</div>
  <div class="c small">Tel: 0086-411-84426759 &nbsp; Fax: 0086-411-84426827 &nbsp; E-mail: sales@dalian-sunshine.com</div>
  <div class="c small">Add: 12-6 HONGJIN STREET, GANJINGZI DISTRICT, DALIAN 116033, CHINA</div>`;

const pages = [
  `${header}
  <h2>SALES CONTRACT</h2><div class="c zh" style="font-size:30px">买卖合同</div>
  <div class="row" style="margin-top:26px"><span>Contract No.: <u>DSA2023-1018</u> <span class="zh">合同编号</span></span><span>Date: <u>October 11, 2023</u> <span class="zh">日期</span></span></div>
  <p><b>Seller <span class="zh">卖方</span>:</b> DALIAN SUNSHINE IMP. &amp; EXP. CO., LTD.<br/>Address: 12-6 HONGJIN STREET, GANJINGZI DISTRICT, DALIAN, CHINA</p>
  <p><b>Buyer <span class="zh">买方</span>:</b> DAMAAN GENERAL TRADING LLC<br/>Address: OFFICE 203, AL RAS BUILDING, DEIRA, DUBAI, U.A.E. &nbsp; Tel: +971-4-2266874</p>
  <p class="small">This contract is made by and between the Seller and the Buyer, whereby the Buyer agrees to buy and the Seller agrees to sell
  the under-mentioned commodity according to the terms and conditions stipulated below:<br/><span class="zh">兹经买卖双方同意由卖方出售、买方购进下列货物，并按下列条款签订本合同：</span></p>
  <table>
    <tr><th>1. Commodity &amp; Specification<br/><span class="zh">品名及规格</span></th><th>2. Quantity<br/><span class="zh">数量</span></th><th>3. Packing<br/><span class="zh">包装</span></th><th>4. Unit Price<br/><span class="zh">单价</span></th><th>5. Amount<br/><span class="zh">金额</span></th></tr>
    <tr><td>SULTANA GOLDEN RAISINS<br/>GRADE A, CROP 2023<br/>Moisture: 18% max<br/>Origin: China</td><td>220 MT</td><td>10 KG net carton</td><td>USD 5,267.00 / MT<br/>CFR JEBEL ALI</td><td>USD 1,158,740.00</td></tr>
    <tr><td><b>TOTAL</b></td><td>220 MT</td><td>22,000 CTNS</td><td></td><td><b>USD 1,158,740.00</b></td></tr>
  </table>
  <p><b>TOTAL VALUE:</b> SAY U.S. DOLLARS ONE MILLION ONE HUNDRED FIFTY EIGHT THOUSAND SEVEN HUNDRED FORTY ONLY. (USD 1,158,740.00)<br/>
  <span class="zh">总值：美元壹佰壹拾伍万捌仟柒佰肆拾元整</span></p>`,
  `${header}
  <p style="margin-top:40px"><b>1. Packing <span class="zh">包装</span>:</b> 10 KG net per carton, 22,000 cartons in total. Net Weight: 220,000 KGS. Gross Weight: 228,800 KGS.</p>
  <p><b>2. Time of Shipment <span class="zh">装运期</span>:</b> Before December 15, 2023. Partial shipment allowed. Transshipment allowed.</p>
  <p><b>3. Port of Loading <span class="zh">装运港</span>:</b> DALIAN, CHINA &nbsp; <b>Port of Destination <span class="zh">目的港</span>:</b> JEBEL ALI, U.A.E.</p>
  <p><b>4. Terms of Payment <span class="zh">付款条件</span>:</b> 30% T/T in advance, 70% balance against copy of B/L.</p>
  <p><b>5. Insurance <span class="zh">保险</span>:</b> To be covered by the Buyer.</p>
  <p><b>6. HS Code <span class="zh">海关编码</span>:</b> 0806.20 &nbsp; <b>Country of Origin <span class="zh">原产国</span>:</b> CHINA</p>
  <p><b>7. Shipping Marks <span class="zh">唛头</span>:</b> DAMAAN / DUBAI / DSA2023-1018 / C/NO. 1-22000</p>
  <p><b>8. Quality <span class="zh">品质</span>:</b> Grade A, crop 2023, free from insects, moisture 18% max, as per sample confirmed by the Buyer.</p>
  <p><b>9. Claims <span class="zh">索赔</span>:</b> Any claim by the Buyer regarding quality shall be lodged within 30 days after arrival of the goods at the port of destination.</p>
  <p><b>10. Force Majeure <span class="zh">不可抗力</span>:</b> The Seller shall not be held responsible for late delivery or non-delivery owing to generally recognized force majeure causes.</p>`,
  `${header}
  <p style="margin-top:40px"><b>11. Seller's Bank Details <span class="zh">卖方银行资料</span>:</b></p>
  <p>Beneficiary: DALIAN SUNSHINE IMP. &amp; EXP. CO., LTD.<br/>Beneficiary Bank: BANK OF CHINA, DALIAN BRANCH<br/>Bank Address: No. 9 ZHONGSHAN SQUARE, DALIAN, CHINA<br/>
  Account No.: 3070 5678 9012<br/>SWIFT Code: BKCHCNBJ810<br/>Currency: USD</p>
  <p><b>12. Documents <span class="zh">单据</span>:</b> Commercial Invoice in 3 originals, Packing List in 3 originals, Full set of clean on board Bill of Lading, Certificate of Origin, Phytosanitary Certificate.</p>
  <p><b>13. Arbitration <span class="zh">仲裁</span>:</b> All disputes in connection with this contract shall be settled through friendly negotiation.</p>
  <p><b>14.</b> This contract is made in two originals in English and Chinese, both texts being equally authentic. <span class="zh">本合同一式两份，中英文具有同等效力。</span></p>`,
  `${header}
  <p style="margin-top:60px">Contract No.: DSA2023-1018 &nbsp; Date: October 11, 2023</p>
  <div class="sign"><div>THE SELLER <span class="zh">卖方</span><br/><br/>DALIAN SUNSHINE IMP. &amp; EXP. CO., LTD.<br/>Authorized signature: ______________</div>
  <div>THE BUYER <span class="zh">买方</span><br/><br/>DAMAAN GENERAL TRADING LLC<br/>Authorized signature: ______________</div></div>`
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1.35 });
const page = await ctx.newPage();
const shots = [];
for (const [i, html] of pages.entries()) {
  await page.setContent(`<html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="pg">${html}</div></body></html>`);
  const png = await page.screenshot({ fullPage: false });
  // photo of a printed page: paper tone, small rotation, softness, sensor noise, JPEG
  const meta = await sharp(png).metadata();
  const w = meta.width, h = meta.height;
  const noise = Buffer.alloc(w * h);
  for (let k = 0; k < noise.length; k++) noise[k] = 128 + Math.round((Math.random() - 0.5) * 38);
  const noisePng = await sharp(noise, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  // sharp runs rotate before composite inside one pipeline, so the noise is applied in a first pass
  const noisy = await sharp(png).grayscale().linear(0.82, 30).composite([{ input: noisePng, blend: "overlay" }]).png().toBuffer();
  const photo = await sharp(noisy)
    .blur(0.7)
    .rotate(i % 2 ? -1.1 : 1.4, { background: { r: 205, g: 205, b: 200 } })
    .resize({ width: 1654 })
    .jpeg({ quality: 62 })
    .toBuffer();
  shots.push(photo.toString("base64"));
}
// one full-page image per page + the scanner app's small logo, exactly like a CamScanner export (no text layer)
const logo = await sharp({ create: { width: 240, height: 90, channels: 3, background: { r: 240, g: 240, b: 240 } } }).png().toBuffer();
const doc = `<html><head><style>@page{size:A4;margin:0} body{margin:0} .p{width:210mm;height:297mm;position:relative;page-break-after:always;overflow:hidden}
  .p img.scan{width:100%;height:100%;object-fit:cover} .p img.logo{position:absolute;right:6mm;bottom:5mm;width:26mm}</style></head><body>
  ${shots.map((b) => `<div class="p"><img class="scan" src="data:image/jpeg;base64,${b}"/><img class="logo" src="data:image/png;base64,${logo.toString("base64")}"/></div>`).join("")}
  </body></html>`;
await page.setContent(doc);
await page.pdf({ path: OUT, format: "A4", printBackground: true });
await browser.close();
console.log(JSON.stringify({ out: OUT, bytes: fs.statSync(OUT).size, expected: EXPECTED }));
