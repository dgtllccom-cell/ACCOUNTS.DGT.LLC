/**
 * Builds the printable install guide (English + Urdu) with a QR code for every store link that exists.
 *   1. Put each link into docs/store/store-links.json as soon as the store approves the app (null = not published yet).
 *   2. npx tsx scripts/make-install-guide.mts          → docs/store/install-guide/index.html (+ one .svg QR per link)
 * Nothing is invented: a store without a link shows "not published yet" and no QR.
 */
import fs from "node:fs";
import path from "node:path";
import { qrCodeSvgMarkup } from "../components/ui/qr-code";

type Links = Record<"b" | "bs", { googlePlay: string | null; appStore: string | null; galaxyStore: string | null; testflight: string | null }>;
const links: Links = JSON.parse(fs.readFileSync("docs/store/store-links.json", "utf8"));
const out = "docs/store/install-guide";
fs.mkdirSync(out, { recursive: true });

const apps = [
  { key: "b" as const, name: "DGT.llc B", en: "Business", ur: "بزنس" },
  { key: "bs" as const, name: "DGT.llc BS", en: "Shipping Line & Clearing Agent", ur: "شپنگ لائن اور کلیئرنگ ایجنٹ" },
];
const stores = [
  { id: "googlePlay" as const, en: "Google Play (Android)", ur: "گوگل پلے (اینڈرائیڈ)" },
  { id: "galaxyStore" as const, en: "Samsung Galaxy Store", ur: "سیمسنگ گیلیکسی اسٹور" },
  { id: "appStore" as const, en: "Apple App Store (iPhone / iPad)", ur: "ایپل ایپ اسٹور (آئی فون / آئی پیڈ)" },
  { id: "testflight" as const, en: "TestFlight (iPhone test)", ur: "ٹیسٹ فلائٹ (آئی فون ٹیسٹ)" },
];

let cards = "";
for (const a of apps) {
  cards += `<section class="app"><h2>${a.name} <small>— ${a.en} / ${a.ur}</small></h2><div class="grid">`;
  for (const s of stores) {
    const url = links[a.key][s.id];
    if (url) {
      const file = `${a.key}-${s.id}.svg`;
      fs.writeFileSync(path.join(out, file), qrCodeSvgMarkup(url, { size: 220, quietZone: 4 }));
      cards += `<div class="card"><img src="${file}" width="160" height="160" alt="QR ${a.name} ${s.en}"><b>${s.en}</b><span>${s.ur}</span><a href="${url}">${url}</a></div>`;
    } else {
      cards += `<div class="card off"><b>${s.en}</b><span>${s.ur}</span><em>not published yet / ابھی شائع نہیں ہوئی</em></div>`;
    }
  }
  cards += `</div></section>`;
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DGT.llc B / BS — install guide</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#0a1f45}h1{margin:0 0 4px}.app{margin:24px 0;padding:16px;border:1px solid #d5deef;border-radius:14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.card{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;padding:10px;border:1px solid #e3e9f5;border-radius:10px}.card.off{opacity:.55;justify-content:center;min-height:120px}.card a{font-size:10px;word-break:break-all}.cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}.ur{direction:rtl;font-family:"Noto Nastaliq Urdu","Jameel Noori Nastaleeq",Tahoma,serif;line-height:2}@media(max-width:700px){.cols{grid-template-columns:1fr}}</style></head><body>
<h1>DGT.llc B &amp; DGT.llc BS</h1><p>One ERP, two apps — <b>DGT.llc B</b> for business users, <b>DGT.llc BS</b> for Shipping Line and Clearing Agent users.</p>
${cards}
<div class="cols"><div><h3>How to install</h3><ol>
<li>Open the store on your phone (Google Play, Samsung Galaxy Store or Apple App Store) or scan the QR code above.</li>
<li>Search for the exact name <b>DGT.llc B</b> (business) or <b>DGT.llc BS</b> (shipping / clearing) and tap Install.</li>
<li>Open the app and tap <b>Request activation</b>: enter your name, mobile number and your ERP e-mail / user code.</li>
<li>Wait for the Super Admin to approve. You will receive a 6-digit activation code from the administrator.</li>
<li>Type the code, then sign in with your normal ERP account. You will see only the modules, country and branch assigned to you.</li></ol>
<p>If the app says the device is blocked or the code expired, contact your administrator.</p></div>
<div class="ur"><h3>انسٹال کرنے کا طریقہ</h3><ol>
<li>اپنے فون پر اسٹور کھولیں (گوگل پلے، سیمسنگ گیلیکسی اسٹور یا ایپل ایپ اسٹور) یا اوپر دیا گیا QR کوڈ اسکین کریں۔</li>
<li>عین نام تلاش کریں: <b>DGT.llc B</b> (بزنس) یا <b>DGT.llc BS</b> (شپنگ / کلیئرنگ) اور انسٹال دبائیں۔</li>
<li>ایپ کھولیں اور <b>فعالیت کی درخواست</b> دبائیں: اپنا نام، موبائل نمبر اور ERP ای میل / یوزر کوڈ لکھیں۔</li>
<li>سپر ایڈمن کی منظوری کا انتظار کریں۔ ایڈمنسٹریٹر آپ کو 6 ہندسوں کا ایکٹیویشن کوڈ دے گا۔</li>
<li>کوڈ لکھیں، پھر اپنے معمول کے ERP اکاؤنٹ سے سائن اِن کریں۔ آپ کو صرف وہی ماڈیولز، ملک اور برانچ نظر آئیں گے جو آپ کو دیے گئے ہیں۔</li></ol>
<p>اگر ایپ بتائے کہ ڈیوائس بلاک ہے یا کوڈ کی مدت ختم ہو گئی ہے تو اپنے ایڈمنسٹریٹر سے رابطہ کریں۔</p></div></div>
</body></html>`;
fs.writeFileSync(path.join(out, "index.html"), html);
console.log("install guide written:", path.join(out, "index.html"));
