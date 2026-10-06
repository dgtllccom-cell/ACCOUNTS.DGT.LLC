// Seed the required common business terms into the central Local Translator dictionary
// (record_table='system_dictionary', field_name='term') in EN/UR/PS/FA/AR, via the
// upsert_record_translation RPC (correct path for the record_translations VIEW). Idempotent
// (deterministic UUIDv5 key, same scheme as scripts/seed-system-dictionary.mjs).
//   DATABASE_URL=... node scripts/seed-required-terms.mjs
import crypto from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL required"); process.exit(1); }

const NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
function uuid5(n) {
  const nb = Buffer.from(NS.replace(/-/g, ""), "hex");
  const h = crypto.createHash("sha1").update(Buffer.concat([nb, Buffer.from(n)])).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80;
  const x = b.toString("hex");
  return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`;
}

// en -> { ur, ps, fa, ar }
const TERMS = {
  "Bank":            { ur: "بینک",            ps: "بانک",             fa: "بانک",              ar: "بنك" },
  "Cash":            { ur: "نقد",             ps: "نغدي",             fa: "نقد",               ar: "نقد" },
  "Purchase":        { ur: "خریداری",         ps: "اخیستنه",          fa: "خرید",              ar: "شراء" },
  "Sale":            { ur: "فروخت",           ps: "پلورنه",           fa: "فروش",              ar: "بيع" },
  "Expense":         { ur: "اخراجات",         ps: "لګښت",             fa: "هزینه",             ar: "مصروف" },
  "Income":          { ur: "آمدنی",           ps: "عاید",             fa: "درآمد",             ar: "دخل" },
  "Warehouse":       { ur: "گودام",           ps: "ګودام",            fa: "انبار",             ar: "مستودع" },
  "Debit":           { ur: "نامے",            ps: "پور",              fa: "بدهکار",            ar: "مدين" },
  "Credit":          { ur: "جمع",             ps: "کریډیټ",           fa: "بستانکار",          ar: "دائن" },
  "Receivable":      { ur: "قابل وصول",       ps: "د اخیستو وړ",      fa: "دریافتنی",          ar: "مستحق القبض" },
  "Payable":         { ur: "قابل ادائیگی",    ps: "د ورکړې وړ",       fa: "پرداختنی",          ar: "مستحق الدفع" },
  "Balance":         { ur: "بقایا",           ps: "بیلانس",           fa: "مانده",             ar: "رصيد" },
  "Almond Kernel":   { ur: "بادام گری",       ps: "د بادامو مغز",     fa: "مغز بادام",         ar: "لب اللوز" },
  "Dry Fruits":      { ur: "خشک میوہ جات",    ps: "وچ میوه",          fa: "خشکبار",            ar: "فواكه مجففة" },
  "Customs":         { ur: "کسٹمز",           ps: "ګمرک",             fa: "گمرک",              ar: "الجمارك" },
  "General Traders": { ur: "جنرل ٹریڈرز",     ps: "عمومي سوداګر",     fa: "بازرگانان عمومی",   ar: "تجار عامون" },
  "Account":         { ur: "کھاتہ",           ps: "حساب",             fa: "حساب",              ar: "حساب" },
  "Branch":          { ur: "شاخ",             ps: "څانګه",            fa: "شعبه",              ar: "فرع" },
  "Company":         { ur: "کمپنی",           ps: "شرکت",             fa: "شرکت",              ar: "شركة" },
  "Customer":        { ur: "گاہک",            ps: "پیرودونکی",        fa: "مشتری",             ar: "عميل" },
  "Supplier":        { ur: "سپلائر",          ps: "عرضه کوونکی",      fa: "تأمین‌کننده",       ar: "المورد" },
  "Invoice":         { ur: "انوائس",          ps: "انوائس",           fa: "فاکتور",            ar: "فاتورة" },
  "Payment":         { ur: "ادائیگی",         ps: "ورکړه",            fa: "پرداخت",            ar: "دفع" },
  "Sales":           { ur: "فروخت",           ps: "پلور",             fa: "فروش",              ar: "مبيعات" },
  "Tax":             { ur: "ٹیکس",            ps: "مالیه",            fa: "مالیات",            ar: "ضريبة" },
  "Charges":         { ur: "چارجز",           ps: "لګښتونه",          fa: "هزینه‌ها",          ar: "رسوم" },
  "Expenses":        { ur: "اخراجات",         ps: "لګښتونه",          fa: "هزینه‌ها",          ar: "مصروفات" },
  "Office":          { ur: "دفتر",            ps: "دفتر",             fa: "دفتر",              ar: "مكتب" },
  "Profit":          { ur: "منافع",           ps: "ګټه",              fa: "سود",               ar: "ربح" },
  "Land":            { ur: "زمین",            ps: "ځمکه",             fa: "زمین",              ar: "أرض" },
  "Deduction":       { ur: "کٹوتی",           ps: "کمښت",             fa: "کسر",               ar: "خصم" },
  "Loading":         { ur: "لوڈنگ",           ps: "بارول",            fa: "بارگیری",           ar: "تحميل" },
  "Landing":         { ur: "لینڈنگ",          ps: "کوزول",            fa: "تخلیه",             ar: "تفريغ" },
  "Goods":           { ur: "مال",             ps: "توکي",             fa: "کالا",              ar: "بضائع" },
  "Employee":        { ur: "ملازم",           ps: "کارمند",           fa: "کارمند",            ar: "موظف" },
  "Personal":        { ur: "ذاتی",            ps: "شخصي",             fa: "شخصی",              ar: "شخصي" },
  "Household":       { ur: "گھریلو",          ps: "کورنی",            fa: "خانگی",             ar: "منزلي" },
  "Business":        { ur: "کاروبار",         ps: "سوداګري",          fa: "تجارت",             ar: "أعمال" },
  "Manager":         { ur: "مینیجر",          ps: "مدیر",             fa: "مدیر",              ar: "مدير" },
  "Marine":          { ur: "بحری",            ps: "بحري",             fa: "دریایی",            ar: "بحري" },
  "Transit":         { ur: "ٹرانزٹ",          ps: "ترانزیت",          fa: "ترانزیت",           ar: "عبور" },
  "City":            { ur: "شہر",             ps: "ښار",              fa: "شهر",               ar: "مدينة" },
  "House":           { ur: "گھر",             ps: "کور",              fa: "خانه",              ar: "منزل" },
  "and":             { ur: "اور",             ps: "او",               fa: "و",                 ar: "و" },
  // Batch 3 — countries / cities / branch-scope terms for composite Branch/City/Country labels.
  "Pakistan":        { ur: "پاکستان",         ps: "پاکستان",          fa: "پاکستان",           ar: "باكستان" },
  "Afghanistan":     { ur: "افغانستان",       ps: "افغانستان",        fa: "افغانستان",         ar: "أفغانستان" },
  "United Arab Emirates": { ur: "متحدہ عرب امارات", ps: "متحده عربي امارات", fa: "امارات متحده عربی", ar: "الإمارات العربية المتحدة" },
  "India":           { ur: "بھارت",           ps: "هند",              fa: "هند",               ar: "الهند" },
  "Iran":            { ur: "ایران",           ps: "ایران",            fa: "ایران",             ar: "إيران" },
  "Quetta":          { ur: "کوئٹہ",           ps: "کوټه",             fa: "کویته",             ar: "كويتا" },
  "Chaman":          { ur: "چمن",             ps: "چمن",              fa: "چمن",               ar: "تشامان" },
  "Karachi":         { ur: "کراچی",           ps: "کراچۍ",            fa: "کراچی",             ar: "كراتشي" },
  "Kabul":           { ur: "کابل",            ps: "کابل",             fa: "کابل",              ar: "كابول" },
  "Peshawar":        { ur: "پشاور",           ps: "پېښور",            fa: "پیشاور",            ar: "بيشاور" },
  "Lahore":          { ur: "لاہور",           ps: "لاهور",            fa: "لاهور",             ar: "لاهور" },
  "Dubai":           { ur: "دبئی",            ps: "دبۍ",              fa: "دبی",               ar: "دبي" },
  "Kandahar":        { ur: "قندھار",          ps: "کندهار",           fa: "قندهار",            ar: "قندهار" },
  "Workspace":       { ur: "ورک اسپیس",       ps: "کاري ځای",         fa: "فضای کاری",         ar: "مساحة عمل" },
  "Main Branch":     { ur: "مین برانچ",        ps: "اصلي څانګه",       fa: "شعبه اصلی",         ar: "الفرع الرئيسي" },
  "City Branch":     { ur: "سٹی برانچ",        ps: "د ښار څانګه",      fa: "شعبه شهر",          ar: "فرع المدينة" },
};

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30 });
let ok = 0, fail = 0;
try {
  for (const [en, t] of Object.entries(TERMS)) {
    const rid = uuid5(`system_dictionary:${en.toLowerCase()}`);
    const langTexts = { en, ur: t.ur, ps: t.ps, fa: t.fa, ar: t.ar };
    try {
      await sql`select upsert_record_translation(
        'system_dictionary', ${rid}::uuid, 'term', ${en}, 'en',
        ${en}, ${t.ur}, ${t.ar}, ${t.fa}, ${t.ps},
        ${sql.json(langTexts)}, 'manual', 'complete', 'local_dictionary', null::uuid)`;
      ok++;
    } catch (e) { fail++; console.error("FAIL", en, e.message); }
  }
  const total = await sql`select count(*)::int c from record_translations where record_table='system_dictionary' and deleted_at is null`;
  console.log(`Seeded required terms: ok=${ok} fail=${fail}. system_dictionary total now: ${total[0].c}`);
} finally {
  await sql.end({ timeout: 3 }).catch(() => {});
}
