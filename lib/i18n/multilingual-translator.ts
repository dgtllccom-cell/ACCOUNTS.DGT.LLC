import type { SupportedLanguage } from "@/lib/i18n/languages";

export interface MultilingualText {
  en: string;
  ur: string;
  ar: string;
  fa: string;
  ps: string;
}

/**
 * Transliteration dictionary maps common names/terms into 5 languages.
 */
const COMMON_TRANSLITERATION_MAP: Record<string, MultilingualText> = {
  // Common Owners / Drivers Names
  "ahmed": { en: "Ahmed", ur: "احمد", ar: "أحمد", fa: "احمد", ps: "احمد" },
  "muhammad": { en: "Muhammad", ur: "محمد", ar: "محمد", fa: "محمد", ps: "محمد" },
  "khan": { en: "Khan", ur: "خان", ar: "خان", fa: "خان", ps: "خان" },
  "ali": { en: "Ali", ur: "علی", ar: "علي", fa: "علی", ps: "علي" },
  "hassan": { en: "Hassan", ur: "حسن", ar: "حسن", fa: "حسن", ps: "حسن" },
  "tariq": { en: "Tariq", ur: "طارق", ar: "طارق", fa: "طارق", ps: "طارق" },
  "gulistan": { en: "Gulistan", ur: "گلستان", ar: "جليستان", fa: "گلستان", ps: "ګلستان" },
  "damaan": { en: "Damaan", ur: "دامان", ar: "ضمان", fa: "دامان", ps: "دامان" },
  "quetta": { en: "Quetta", ur: "کوئٹہ", ar: "كويتا", fa: "کویته", ps: "کوټه" },
  "chaman": { en: "Chaman", ur: "چمن", ar: "تشامان", fa: "چمن", ps: "چمن" },
  "kabul": { en: "Kabul", ur: "کابل", ar: "كابول", fa: "کابل", ps: "کابل" },
  "dubai": { en: "Dubai", ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دبي" },
  "karachi": { en: "Karachi", ur: "کراچی", ar: "كراتشي", fa: "کرچی", ps: "کراچۍ" },
  "peshawar": { en: "Peshawar", ur: "پشاور", ar: "بيشاور", fa: "پیشاور", ps: "پېښور" },
  "transport": { en: "Transport Co.", ur: "ٹرانسپورٹ کمپنی", ar: "شركة النقل", fa: "شرکت حمل و نقل", ps: "د ټرانسپورټ شرکت" },
  // Common ERP Status & Modules
  "accepted": { en: "Accepted", ur: "منظور شدہ", ar: "مقبول", fa: "تایید شده", ps: "منل شوی" },
  "transferred": { en: "Transferred", ur: "منتقل شدہ", ar: "محول", fa: "منتقل شده", ps: "لیږدول شوی" },
  "pending": { en: "Pending", ur: "زیر التواء", ar: "معلق", fa: "در انتظار", ps: "پاتې" },
  "completed": { en: "Completed", ur: "مکمل", ar: "مكتمل", fa: "تکمیل شده", ps: "بشپړ شوی" },
  "draft": { en: "Draft", ur: "ڈرافٹ", ar: "مسودة", fa: "پیش‌نویس", ps: "مسوده" },
  "purchase account": { en: "Purchase Account", ur: "خریداری اکاؤنٹ", ar: "حساب الشراء", fa: "حساب خرید", ps: "د پیرودلو حساب" },
  "sales account": { en: "Sales Account", ur: "فروخت اکاؤنٹ", ar: "حساب المبيعات", fa: "حساب فروش", ps: "د پلورلو حساب" },
  "booking date": { en: "Booking Date", ur: "تاریخ بکنگ", ar: "تاريخ الحجز", fa: "تاریخ رزرو", ps: "د بکینګ نیټه" },
  "supplier": { en: "Supplier", ur: "سپلائر", ar: "المورد", fa: "تامین کننده", ps: "ورکونکی" },
  "buyer": { en: "Buyer", ur: "خریدار", ar: "المشتري", fa: "خریدار", ps: "اخیستونکی" },
  "goods": { en: "Goods", ur: "مال / اشیاء", ar: "البضائع", fa: "کالاها", ps: "مالونه" },
  "quantity": { en: "Quantity", ur: "تعداد / مقدار", ar: "الكمية", fa: "مقدار", ps: "شمیر" },
  "united arab emirates": { en: "United Arab Emirates", ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" },
  "pakistan": { en: "Pakistan", ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" },
  "afghanistan": { en: "Afghanistan", ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" },
  "iran": { en: "Iran", ur: "ایران", ar: "إيران", fa: "ایران", ps: "ایران" },
  "india": { en: "India", ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" },

  // General Office & Employee Management
  "register new employee": { en: "Register New Employee", ur: "نیا ملازم رجسٹر کریں", ar: "تسجيل موظف جديد", fa: "ثبت کارمند جدید", ps: "نوی کارکوونکی ثبت کړئ" },
  "register new employee master record": { en: "Register New Employee Master Record", ur: "نیا ملازم ماسٹر ریکارڈ رجسٹر کریں", ar: "تسجيل سجل الموظف الرئيسي الجديد", fa: "ثبت رکورد اصلی کارمند جدید", ps: "د نوي کارکوونکي ماسټر ریکارډ ثبت کړئ" },
  "enterprise employee registration wizard": { en: "Enterprise Employee Registration Wizard", ur: "انٹرپرائز ملازم رجسٹریشن وزرڈ", ar: "معالج تسجيل موظفي المؤسسة", fa: "ویزارد ثبت کارمند سازمانی", ps: "د تصدۍ کارکوونکو نوملیکنې وزرډ" },
  "step 1 packet: employee category & person selection": { en: "Step 1 Packet: Employee Category & Person Selection", ur: "مرحلہ 1: ملازم کیٹیگری اور شخص کا انتخاب", ar: "الخطوة 1: فئة الموظف واختيار الشخص", fa: "مرحله 1: دسته‌بندی کارمند و انتخاب شخص", ps: "1 مرحله: د کارکوونکي کټګوري او فرد انتخاب" },
  "select employee category": { en: "SELECT EMPLOYEE CATEGORY", ur: "ملازم کیٹیگری منتخب کریں", ar: "اختر فئة الموظف", fa: "انتخاب دسته‌بندی کارمند", ps: "د کارکوونکي کټګوري وټاکئ" },
  "others": { en: "Others", ur: "دیگر", ar: "آخرون", fa: "سایر", ps: "نور" },
  "employee": { en: "Employee", ur: "ملازم", ar: "موظف", fa: "کارمند", ps: "کارکوونکی" },
  "normal staff": { en: "Normal Staff", ur: "عام عملہ", ar: "الموظفون العاديون", fa: "پرسنل عادی", ps: "عادي کارکوونکي" },
  "manager": { en: "Manager", ur: "مینجر", ar: "مدير", fa: "مدیر", ps: "مدیر" },
  "search employee / person name": { en: "Search employee / person name", ur: "ملازم / شخص کا نام تلاش کریں", ar: "البحث عن اسم الموظف / الشخص", fa: "جستجوی نام کارمند / شخص", ps: "د کارکوونکي / فرد نوم وپلټئ" },
  "add new person master +": { en: "Add New Person Master +", ur: "نیا پرسن ماسٹر شامل کریں +", ar: "إضافة شخص رئيسي جديد +", fa: "افزودن شخص اصلی جدید +", ps: "نوی فرد ماسټر اضافه کړئ +" },
  "department": { en: "Department", ur: "شعبہ (ڈیپارٹمنٹ)", ar: "القسم", fa: "بخش", ps: "څانګه" },
  "designation / position": { en: "Designation / Position", ur: "عہدہ / پوزیشن", ar: "المسمى الوظيفي", fa: "عنوان شغلی", ps: "عنده / موقف" },
  "step 1 packet preview": { en: "STEP 1 PACKET PREVIEW", ur: "مرحلہ 1 پیکٹ کا جائزہ", ar: "معاينة الخطوة 1", fa: "پیش‌نمایش گام 1", ps: "د 1 مرحلې مخکتنه" },
  "save & finalize employee": { en: "Save & Finalize Employee", ur: "ملازم محفوظ کریں اور حتمی شکل دیں", ar: "حفظ وإنهاء الموظف", fa: "ذخیره و نهایی‌سازی کارمند", ps: "کارکوونکی خوندي او وروستی کړئ" },
  "next step": { en: "Next Step", ur: "اگلا مرحلہ", ar: "الخطوة التالية", fa: "مرحله بعد", ps: "بل قدم" },
  "cancel": { en: "Cancel", ur: "منسوخ کریں", ar: "إلغاء", fa: "انصراف", ps: "بندول" },
  "all statuses": { en: "All Statuses", ur: "تمام حالات", ar: "جميع الحالات", fa: "همه وضعیت‌ها", ps: "ټول حالتونه" },
  "all categories": { en: "All Categories", ur: "تمام کیٹیگریز", ar: "جميع الفئات", fa: "همه دسته‌ها", ps: "ټولې کټګورۍ" },
  "office modules": { en: "OFFICE MODULES", ur: "آفس ماڈیولز", ar: "وحدات المكتب", fa: "ماژول‌های دفتر", ps: "د دفتر ماډولونه" },
  "employee master setup": { en: "Employee Master Setup", ur: "ایمپلائی ماسٹر سیٹ اپ", ar: "إعداد الموظفين الرئيسي", fa: "تنظیمات اصلی کارمندان", ps: "د کارکوونکو ماسټر سیټ اپ" },
  "employee management": { en: "Employee Management", ur: "ایمپلائی مینجمنٹ", ar: "إدارة الموظفين", fa: "مدیریت کارمندان", ps: "د کارکوونکو اداره" },
  "departments": { en: "Departments", ur: "شعبہ جات", ar: "الأقسام", fa: "بخش‌ها", ps: "څانګې" },
  "designations": { en: "Designations", ur: "عہدے", ar: "المسميات الوظيفية", fa: "عناوین شغلی", ps: "عہدې" },
  "attendance": { en: "Attendance", ur: "حاضری", ar: "الحضور والغياب", fa: "حضور و غیاب", ps: "حاضري" },
  "leave management": { en: "Leave Management", ur: "چھٹیوں کی دیکھ بھال", ar: "إدارة الإجازات", fa: "مدیریت مرخصی", ps: "د رخصتیو اداره" },
  "payroll / salary": { en: "Payroll / Salary", ur: "پے رول / تنخواہ", ar: "مسير الرواتب", fa: "حقوق و دستمزد", ps: "معاشونه" },
  "office assets": { en: "Office Assets", ur: "آفس کے اثاثہ جات", ar: "أصول الشركة", fa: "اموال دفتر", ps: "د دفتر اثاثې" },
  "office documents": { en: "Office Documents", ur: "آفس کے دستاویزات", ar: "وثائق المكتب", fa: "اسناد دفتر", ps: "د دفتر اسناد" },
  "employee id cards": { en: "Employee ID Cards", ur: "ایمپلائی شناختی کارڈز", ar: "بطاقات الموظفين", fa: "کارت‌های شناسایی", ps: "د کارکوونکو کارتونه" },
  "employee reports": { en: "Employee Reports", ur: "ملازمین کی رپورٹس", ar: "تقارير الموظفين", fa: "گزارش‌های کارمندان", ps: "د کارکوونکو راپورونه" },
  "general office management": { en: "General Office Management", ur: "جنرل آفس مینجمنٹ", ar: "الإدارة العامة للمكتب", fa: "مدیریت عمومی دفتر", ps: "عمومي دفتر اداره" },
  "enterprise hr, payroll, attendance & assets center": { en: "Enterprise HR, Payroll, Attendance & Assets Center", ur: "انٹرپرائز ایچ آر، پے رول، حاضری اور اثاثہ جات سینٹر", ar: "مركز الموارد البشرية والرواتب والحضور والأصول للمؤسسة", fa: "مرکز منابع انسانی، حقوق، حضور و اموال سازمانی", ps: "د تصدۍ د بشري سرچینو، معاشونو او اثاثو مرکز" },
  "employees": { en: "Employees", ur: "ملازمین", ar: "الموظفون", fa: "کارمندان", ps: "کارکوونکي" },
  "no employee records found. click \"register new employee\" above": { en: "No employee records found. Click 'Register New Employee' above", ur: "کوئی ملازم نہیں ملا۔ نیا ملازم رجسٹر کرنے کے لیے اوپر بٹن پر کلک کریں۔", ar: "لم يتم العثور على سجلات. انقر فوق تسجيل موظف جديد أعلاه", fa: "هیچ رکوردی یافت نشد. روی ثبت کارمند جدید کلیک کنید", ps: "هیڅ ریکارډ ونه موندل شو. پورته نوی کارکوونکی ثبت کړئ کلیک کړئ" }
};

/**
 * Detect script direction / character set.
 */
export function detectScriptType(text: string): "latin" | "arabic" | "other" {
  if (!text || !text.trim()) return "latin";
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (arabicRegex.test(text)) return "arabic";
  return "latin";
}

/**
 * Automatically generates 5-language values (en, ur, ar, fa, ps) from input text.
 */
export function autoTranslate5Languages(
  input: string,
  sourceLang: SupportedLanguage = "en",
  currentObj?: Partial<MultilingualText>
): MultilingualText {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return {
      en: currentObj?.en || "",
      ur: currentObj?.ur || "",
      ar: currentObj?.ar || "",
      fa: currentObj?.fa || "",
      ps: currentObj?.ps || "",
    };
  }

  // Check static lookup dictionary
  const key = trimmed.toLowerCase();
  if (COMMON_TRANSLITERATION_MAP[key]) {
    return { ...COMMON_TRANSLITERATION_MAP[key] };
  }

  // Multi-word phrase matching
  const words = trimmed.split(/\s+/);
  const translatedWords = words.map(w => {
    const lk = w.toLowerCase();
    return COMMON_TRANSLITERATION_MAP[lk] || null;
  });

  if (translatedWords.every(Boolean)) {
    return {
      en: translatedWords.map(w => w!.en).join(" "),
      ur: translatedWords.map(w => w!.ur).join(" "),
      ar: translatedWords.map(w => w!.ar).join(" "),
      fa: translatedWords.map(w => w!.fa).join(" "),
      ps: translatedWords.map(w => w!.ps).join(" "),
    };
  }

  // Script detection fallback
  const isArabicScript = detectScriptType(trimmed) === "arabic";

  const result: MultilingualText = {
    en: currentObj?.en || (isArabicScript ? trimmed : trimmed),
    ur: currentObj?.ur || (isArabicScript ? trimmed : trimmed),
    ar: currentObj?.ar || (isArabicScript ? trimmed : trimmed),
    fa: currentObj?.fa || (isArabicScript ? trimmed : trimmed),
    ps: currentObj?.ps || (isArabicScript ? trimmed : trimmed),
  };

  // Set active source language
  result[sourceLang] = trimmed;

  return result;
}

/**
 * Returns text for display in active language with fallback chain.
 */
export function resolveActiveText(
  obj: Partial<MultilingualText> | null | undefined,
  activeLang: SupportedLanguage = "en",
  fallbackDefault = ""
): string {
  if (!obj) return fallbackDefault;
  const langOrder: SupportedLanguage[] = [activeLang, "en", "ur", "ar", "fa", "ps"];
  for (const l of langOrder) {
    const val = obj[l];
    if (val && val.trim()) return val.trim();
  }
  return fallbackDefault;
}
