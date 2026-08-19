import fs from 'fs';

const filePath = 'lib/i18n/table-headers.ts';
let content = fs.readFileSync(filePath, 'utf8');

const targetIdx = content.lastIndexOf('};');
if (targetIdx === -1) {
  console.error("Could not find closing brace in table-headers.ts");
  process.exit(1);
}

const additions = `
  // ── General Ledger Report & Ledger Statement Reference Screens ────────────
  "1. BRANCH & USER DETAILS": { ur: "1. برانچ اور صارف کی تفصیلات", ar: "1. تفاصيل الفرع والمستخدم", fa: "1. جزئیات شعبه و کاربر", ps: "1. د څانګې او کارن جزئیات" },
  "1. COUNTRY & USER DETAILS": { ur: "1. ملک اور صارف کی تفصیلات", ar: "1. تفاصيل الدولة والمستخدم", fa: "1. جزئیات کشور و کاربر", ps: "1. د هېواد او کارن جزئیات" },
  "BRANCH & USER DETAILS": { ur: "برانچ اور صارف کی تفصیلات", ar: "تفاصيل الفرع والمستخدم", fa: "جزئیات شعبه و کاربر", ps: "د څانګې او کارن جزئیات" },
  "COUNTRY & USER DETAILS": { ur: "ملک اور صارف کی تفصیلات", ar: "تفاصيل الدولة والمستخدم", fa: "جزئیات کشور و کاربر", ps: "د هېواد او کارن جزئیات" },
  "2. GLOBAL FINANCIAL SUMMARY": { ur: "2. عالمی مالیاتی خلاصہ", ar: "2. الملخص المالي الشامل", fa: "2. خلاصه مالی جهانی", ps: "2. نړیوال مالي لنډیز" },
  "GLOBAL FINANCIAL SUMMARY": { ur: "عالمی مالیاتی خلاصہ", ar: "الملخص المالي الشامل", fa: "خلاصه مالی جهانی", ps: "نړیوال مالي لنډیز" },
  "3. BILL ENTRIES SUMMARY": { ur: "3. بل اندراجات کا خلاصہ", ar: "3. ملخص قيود الفواتير", fa: "3. خلاصه اسناد صورتحساب", ps: "3. د بلونو د ثبت لنډیز" },
  "BILL ENTRIES SUMMARY": { ur: "بل اندراجات کا خلاصہ", ar: "ملخص قيود الفواتير", fa: "خلاصه اسناد صورتحساب", ps: "د بلونو د ثبت لنډیز" },
  "4. ALL COUNTRIES REPORT": { ur: "4. تمام ممالک کی رپورٹ", ar: "4. تقرير جميع الدول", fa: "4. گزارش همه کشورها", ps: "4. د ټولو هېوادونو راپور" },
  "ALL COUNTRIES REPORT": { ur: "تمام ممالک کی رپورٹ", ar: "تقرير جميع الدول", fa: "گزارش همه کشورها", ps: "د ټولو هېوادونو راپور" },
  "TOTAL GLOBAL ENTRIES": { ur: "کل عالمی اندراجات", ar: "إجمالي القيود الشاملة", fa: "کل اسناد جهانی", ps: "ټول نړیوال ثبتونه" },
  "TOTAL GLOBAL ENTRIES:": { ur: "کل عالمی اندراجات:", ar: "إجمالي القيود الشاملة:", fa: "کل اسناد جهانی:", ps: "ټول نړیوال ثبتونه:" },
  "TOTAL CREDIT (AED)": { ur: "کل کریڈٹ (AED)", ar: "إجمالي الدائن (AED)", fa: "کل بستانکار (AED)", ps: "ټول کریډیټ (AED)" },
  "TOTAL DEBIT (AED)": { ur: "کل ڈیبٹ (AED)", ar: "إجمالي المدين (AED)", fa: "کل بدهکار (AED)", ps: "ټول ډیبیټ (AED)" },
  "BALANCE (AED)": { ur: "بیلنس (AED)", ar: "الرصيد (AED)", fa: "مانده (AED)", ps: "بیلانس (AED)" },
  "TOTAL BILL ENTRIES": { ur: "کل بل اندراجات", ar: "إجمالي قيود الفواتير", fa: "کل اسناد صورتحساب", ps: "د بلونو ټول ثبتونه" },
  "CLEARED ENTRIES": { ur: "کلیئر شدہ اندراجات", ar: "القيود المسواة", fa: "اسناد تسویه‌شده", ps: "تصفیه شوي ثبتونه" },
  "REMAINING ENTRIES": { ur: "باقی ماندہ اندراجات", ar: "القيود المتبقية", fa: "اسناد باقیمانده", ps: "پاتې ثبتونه" },
  "HIDE ALL ENTRIES REPORT": { ur: "تمام اندراجات کی رپورٹ چھپائیں", ar: "إخفاء تقرير جميع القيود", fa: "پنهان کردن گزارش همه اسناد", ps: "د ټولو ثبتونو راپور پټ کړئ" },
  "SHOW ALL ENTRIES REPORT": { ur: "تمام اندراجات کی رپورٹ دکھائیں", ar: "إظهار تقرير جميع القيود", fa: "نمایش گزارش همه اسناد", ps: "د ټولو ثبتونو راپور ښکاره کړئ" },
  "COUNTRY": { ur: "ملک", ar: "الدولة", fa: "کشور", ps: "هېواد" },
  "BRANCH NAME": { ur: "برانچ کا نام", ar: "اسم الفرع", fa: "نام شعبه", ps: "د څانګې نوم" },
  "USER ID": { ur: "صارف آئی ڈی", ar: "معرف المستخدم", fa: "شناسه کاربر", ps: "د کارن پېژند" },
  "USER NAME": { ur: "صارف کا نام", ar: "اسم المستخدم", fa: "نام کاربر", ps: "د کارن نوم" },
  "ROLE": { ur: "عہدہ / کردار", ar: "الدور / الصلاحية", fa: "نقش / سمت", ps: "رول / دنده" },
  "DATE & TIME": { ur: "تاریخ و وقت", ar: "التاريخ والوقت", fa: "تاریخ و زمان", ps: "نېټه او وخت" },
  "ACCOUNT DETAILS": { ur: "اکاؤنٹ کی تفصیلات", ar: "تفاصيل الحساب", fa: "جزئیات حساب", ps: "د حساب تفصیلات" },
  "COMPANY DETAILS": { ur: "کمپنی کی تفصیلات", ar: "تفاصيل الشركة", fa: "جزئیات شرکت", ps: "د شرکت تفصیلات" },
  "LEDGER SUMMARY": { ur: "لیجر کا خلاصہ", ar: "ملخص دفتر الأستاذ", fa: "خلاصه دفتر کل", ps: "د لېجر لنډیز" },
  "SESSION / LOGIN DETAILS": { ur: "سیشن / لاگ ان تفصیلات", ar: "تفاصيل الجلسة / تسجيل الدخول", fa: "جزئیات نشست / ورود", ps: "د ناستې / ننوتلو جزئیات" },
  "A/C NAME": { ur: "اکاؤنٹ کا نام", ar: "اسم الحساب", fa: "نام حساب", ps: "د حساب نوم" },
  "A/C NUMBER": { ur: "اکاؤنٹ نمبر", ar: "رقم الحساب", fa: "شماره حساب", ps: "د حساب شمیره" },
  "MANUAL REF": { ur: "دستی حوالہ", ar: "المرجع اليدوي", fa: "مرجع دستی", ps: "لاسي حواله" },
  "CUSTOMER NO": { ur: "کسٹمر نمبر", ar: "رقم العميل", fa: "شماره مشتری", ps: "د پیرودونکي شمیره" },
  "CATEGORY": { ur: "زمرہ", ar: "الفئة", fa: "دسته‌بندی", ps: "کټګوري" },
  "LEDGER": { ur: "لیجر", ar: "دفتر الأستاذ", fa: "دفتر کل", ps: "لېجر" },
  "COMPANY NAME": { ur: "کمپنی کا نام", ar: "اسم الشركة", fa: "نام شرکت", ps: "د شرکت نوم" },
  "MAIN BRANCH": { ur: "مین برانچ", ar: "الفرع الرئيسي", fa: "شعبه اصلی", ps: "اصلي څانګه" },
  "CITY BRANCH": { ur: "سٹی برانچ", ar: "فرع المدينة", fa: "شعبه شهر", ps: "د ښار څانګه" },
  "STATE / CITY": { ur: "صوبہ / شہر", ar: "الولاية / المدينة", fa: "استان / شهر", ps: "ولایت / ښار" },
  "ADDRESS": { ur: "پتہ", ar: "العنوان", fa: "آدرس", ps: "پته" },
  "ENTRIES": { ur: "اندراجات", ar: "القيود", fa: "اسناد", ps: "ثبتونه" },
  "DR": { ur: "ڈیبٹ", ar: "مدين", fa: "بدهکار", ps: "ډیبیټ" },
  "CR": { ur: "کریڈٹ", ar: "دائن", fa: "بستانکار", ps: "کریډیټ" },
  "OPENING": { ur: "ابتدائی بیلنس", ar: "الرصيد الافتتاحي", fa: "مانده افتتاحیه", ps: "پیلنی بیلانس" },
  "OPENING BALANCE": { ur: "ابتدائی بیلنس", ar: "الرصيد الافتتاحي", fa: "مانده افتتاحیه", ps: "پیلنی بیلانس" },
  "BALANCE": { ur: "بیلنس", ar: "الرصيد", fa: "مانده", ps: "بیلانس" },
  "CLOSING BALANCE": { ur: "اختتامی بیلنس", ar: "الرصيد الختامي", fa: "مانده اختتامیه", ps: "وروستی بیلانس" },
  "SESSION BRANCH": { ur: "سیشن برانچ", ar: "فرع الجلسة", fa: "شعبه نشست", ps: "د ناستې څانګه" },
  "LOGIN DATE": { ur: "لاگ ان تاریخ", ar: "تاريخ الدخول", fa: "تاریخ ورود", ps: "د ننوتلو نېټه" },
  "LOGIN TIME": { ur: "لاگ ان وقت", ar: "وقت الدخول", fa: "زمان ورود", ps: "د ننوتلو وخت" },
  "SYSTEM": { ur: "سسٹم", ar: "النظام", fa: "سیستم", ps: "سیسټم" },
  "LEDGER STATEMENT": { ur: "لیجر اسٹیٹمنٹ", ar: "كشف حساب دفتر الأستاذ", fa: "صورتحساب دفتر کل", ps: "د لېجر بیان" },
  "SA/SERIAL": { ur: "SA/سیریل", ar: "الرقم المتسلسل العام", fa: "سریال مدیر ارشد", ps: "د سوپر اډمین سریال" },
  "CO/SERIAL": { ur: "CO/سیریل", ar: "الرقم المتسلسل للدولة", fa: "سریال کشور", ps: "د هېواد سریال" },
  "BR/SERIAL": { ur: "BR/سیریل", ar: "الرقم المتسلسل للفرع", fa: "سریال شعبه", ps: "د څانګې سریال" },
  "BRANCH CODE": { ur: "برانچ کوڈ", ar: "رمز الفرع", fa: "کد شعبه", ps: "د څانګې کوډ" },
  "NO.": { ur: "نمبر", ar: "الرقم", fa: "شماره", ps: "شمېره" },
  "DETAILS": { ur: "تفصیلات", ar: "التفاصيل", fa: "جزئیات", ps: "تفصیلات" },
  "DR.": { ur: "ڈیبٹ", ar: "مدين", fa: "بدهکار", ps: "ډیبیټ" },
  "CR.": { ur: "کریڈٹ", ar: "دائن", fa: "بستانکار", ps: "کریډیټ" },
  "TOTAL": { ur: "ٹوٹل", ar: "الإجمالي", fa: "مجموع", ps: "ټول" },
  "EX. RATE": { ur: "شرح تبادلہ", ar: "سعر الصرف", fa: "نرخ ارز", ps: "د تبادلې نرخ" },
  "DR. (USD)": { ur: "ڈیبٹ (USD)", ar: "مدين (USD)", fa: "بدهکار (USD)", ps: "ډیبیټ (USD)" },
  "CR. (USD)": { ur: "کریڈٹ (USD)", ar: "دائن (USD)", fa: "بستانکار (USD)", ps: "کریډیټ (USD)" },
  "TOTAL (USD)": { ur: "ٹوٹل (USD)", ar: "الإجمالي (USD)", fa: "مجموع (USD)", ps: "ټول (USD)" },
  "TOTAL CREDIT": { ur: "کل کریڈٹ", ar: "إجمالي الدائن", fa: "کل بستانکار", ps: "ټول کریډیټ" },
  "TOTAL DEBIT": { ur: "کل ڈیبٹ", ar: "إجمالي المدين", fa: "کل بدهکار", ps: "ټول ڈیبیټ" },
  "BRANCHES": { ur: "برانچیں", ar: "الفروع", fa: "شعب", ps: "څانګې" },
  "ACTIVE": { ur: "فعال", ar: "نشط", fa: "فعال", ps: "فعال" },
  "INACTIVE": { ur: "غیر فعال", ar: "غير نشط", fa: "غیرفعال", ps: "غیر فعال" },
  "ACCOUNT": { ur: "اکاؤنٹ", ar: "الحساب", fa: "حساب", ps: "حساب" },
  "CREATED": { ur: "تاریخ تخلیق", ar: "تاريخ الإنشاء", fa: "تاریخ ایجاد", ps: "د جوړېدو نېټه" },
  "PRINT / PDF": { ur: "پرنٹ / پی ڈی ایف", ar: "طباعة / PDF", fa: "چاپ / PDF", ps: "چاپ / PDF" },
  "PRINT REPORT": { ur: "رپورٹ پرنٹ کریں", ar: "طباعة التقرير", fa: "چاپ گزارش", ps: "راپور چاپ کړئ" },
  "EXPORT EXCEL": { ur: "ایکسل ایکسپورٹ", ar: "تصدير Excel", fa: "خروجی اکسل", ps: "ایکسل صادرول" },
  "SEARCH": { ur: "تلاش کریں", ar: "بحث", fa: "جستجو", ps: "لټون" },
  "FILTER": { ur: "فلٹر", ar: "تصفية", fa: "فیلتر", ps: "فلټر" },
  "ALL": { ur: "سب", ar: "الكل", fa: "همه", ps: "ټول" },
  "NO FINANCIAL ENTRIES AVAILABLE FOR THE SELECTED DATE RANGE.": {
    ur: "منتخب کردہ تاریخ کے لیے کوئی مالیاتی اندراجات دستیاب نہیں ہیں۔",
    ar: "لا توجد قيود مالية متاحة للنطاق الزمني المحدد.",
    fa: "هیچ سند مالی برای بازه زمانی انتخابی در دسترس نیست.",
    ps: "د ټاکل شوې نېټې لپاره مالي ثبتونه شتون نلري."
  },
  "LOADING LEDGER STATEMENT LINES...": {
    ur: "لیجر اسٹیٹمنٹ لائنز لوڈ ہو رہی ہیں...",
    ar: "جارٍ تحميل أسطر كشف دفتر الأستاذ...",
    fa: "در حال بارگذاری ردیف‌های صورت دفتر کل...",
    ps: "د لېجر بیان کرښې لوډېږي..."
  },
  "NO LEDGER ENTRIES AVAILABLE FOR THIS ACCOUNT.": {
    ur: "اس اکاؤنٹ کے لیے کوئی لیجر اندراجات دستیاب نہیں ہیں۔",
    ar: "لا توجد قيود دفتر أستاذ متاحة لهذا الحساب.",
    fa: "هیچ سند دفتر کل برای این حساب در دسترس نیست.",
    ps: "د دې حساب لپاره هېڅ لېجر ثبتونه شتون نلري."
  },
  "LOADING LEDGER DATA...": {
    ur: "لیجر ڈیٹا لوڈ ہو رہا ہے...",
    ar: "جارٍ تحميل بيانات دفتر الأستاذ...",
    fa: "در حال بارگذاری داده‌های دفتر کل...",
    ps: "د لېجر ډاټا لوډېږي..."
  },
  "NOT ASSIGNED": {
    ur: "غیر متعین",
    ar: "غير محدد",
    fa: "تعیین‌نشده",
    ps: "نه دی ټاکل شوی"
  }
`;

const newFunctions = `
/** Normalize an English header for lookup: trim, collapse whitespace, uppercase. */
function normalize(label: string): string {
  return label.trim().replace(/\\s+/g, " ").toUpperCase();
}

/**
 * Translate a table/column header into the active language.
 * Returns the original English text for \`en\`, unknown labels, or empty input,
 * so it is always safe to wrap a header with this.
 */
export function translateHeader(
  lang: SupportedLanguage | string | null | undefined,
  label: string | null | undefined
): string {
  const original = label ?? "";
  if (!original.trim()) return original;
  const code = (lang || "en") as string;
  if (code === "en") return original;

  const norm = normalize(original);
  let row = HEADER_TRANSLATIONS[norm];

  // Try stripping trailing colon
  if (!row && norm.endsWith(":")) {
    const stripped = norm.slice(0, -1).trim();
    row = HEADER_TRANSLATIONS[stripped];
  }

  // Try stripping leading numbering e.g. "1. " or "2. "
  if (!row) {
    const matchNumber = norm.match(/^(\\d+\\.\\s*)(.*)$/);
    if (matchNumber) {
      const numPrefix = matchNumber[1];
      const baseText = matchNumber[2].trim();
      const baseRow = HEADER_TRANSLATIONS[baseText];
      if (baseRow) {
        const val = baseRow[code as keyof Row];
        if (val) return \`\${numPrefix}\${val}\`;
      }
    }
  }

  if (!row) return original;
  const value = row[code as keyof Row];
  return value || original;
}

/** True when a header has a translation registered (useful for coverage checks). */
export function hasHeaderTranslation(label: string | null | undefined): boolean {
  if (!label || !label.trim()) return false;
  const norm = normalize(label);
  return Boolean(HEADER_TRANSLATIONS[norm] || HEADER_TRANSLATIONS[norm.replace(/:$/, "")]);
}
`;

const beforeClosing = content.substring(0, targetIdx);
const updatedContent = beforeClosing + additions + '};\n' + newFunctions;
fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log("Successfully updated lib/i18n/table-headers.ts");
