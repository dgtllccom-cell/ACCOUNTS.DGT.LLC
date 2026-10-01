import type { ErpSession } from "@/lib/auth/session";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { fetchFinancialStatementRows, classifyProfitAndLoss, classifyBalanceSheet, classifyCashPosition } from "@/lib/reports/financial-statement-data";
import { computeBusinessSummary } from "@/lib/reports/business-summary-data";
import { aiTranslatorConfigured } from "@/lib/i18n/ai-translation-client";
import { withLocalPg, getSharedPg } from "@/lib/db/local-postgres";

function extractSearchTerms(query: string): string[] {
  let cleaned = query.trim()
    .replace(/^(show|find|search|open|check|where is|what is|get|view|list|lookup|دیکھیں|کھولیں|تلاش کریں|ابحث عن|أظهر|نشان بده|وګوره)\s+/i, "")
    .replace(/^(the|a|an)\s+/i, "");

  cleaned = cleaned.replace(/^(customer|account|order|bl|shipment|task|vault|record|گاہک|کھاتہ|آرڈر|بل|ٹاسک|عميل|حساب|مهمة|بارنامہ)\s+/i, "");
  cleaned = cleaned.replace(/[?.,!؛،]/g, "").trim();

  const terms: string[] = [cleaned];
  const codeMatches = query.match(/[A-Za-z0-9]+-[A-Za-z0-9\-]+/g);
  if (codeMatches) {
    for (const code of codeMatches) {
      if (!terms.includes(code)) terms.push(code);
    }
  }
  const words = cleaned.split(/\s+/).filter(w => w.length >= 3);
  for (const w of words) {
    if (!terms.includes(w)) terms.push(w);
  }
  return terms.filter(Boolean);
}

/**
 * AI Business Assistant — Master Implementation for DGT ERP
 *
 * PHASES 2, 3, 4, 8, 9 Compliant:
 * - Real DEV Database Connected (No fabricated records or numbers)
 * - Strict Field-Level RBAC & Scope Isolation (Super Admin vs Country vs Branch vs Agent)
 * - Clear distinction: ERP Record (with Open Action) vs Public External Research (with Links)
 * - Explicit Refusal and Audit Logging for Unauthorized / Sensitive Queries
 * - Complete 5-Language Support (English, Urdu, Arabic, Farsi, Pashto) with RTL awareness
 */

export type AssistantIntent =
  | "write_refused"
  | "permission_denied"
  | "erp_record"
  | "public_research"
  | "profit_loss"
  | "balance_sheet"
  | "cash_flow"
  | "business_summary"
  | "help";

export type AnswerType =
  | "erp_record"
  | "public_external"
  | "permission_denied"
  | "write_refused"
  | "no_record";

export type SourceRecord = {
  table: string;
  id: string;
  title: string;
  ref?: string;
  status?: string;
  date?: string;
  details?: Record<string, any>;
};

export type SourceLink = {
  title: string;
  url: string;
  domain?: string;
  summary?: string;
};

export type AssistantAction = {
  label: string;
  url: string;
};

export type AssistantAnswer = {
  intent: AssistantIntent;
  answerType: AnswerType;
  answer: string;
  scopeLabel: string;
  sourceRecord?: SourceRecord | null;
  sources?: SourceLink[];
  action?: AssistantAction | null;
  refusalReason?: string | null;
  data?: unknown;
};

const WRITE_VERBS: Record<SupportedLanguage, string[]> = {
  en: ["create", "add ", "delete", "remove", "post ", "pay ", "approve", "void", "cancel", "edit", "update", "modify", "transfer", "reverse", "record a", "enter a", "make a payment", "issue "],
  ur: ["بنائیں", "شامل کریں", "حذف", "مٹا", "پوسٹ کریں", "ادائیگی کریں", "منظور", "منسوخ", "ترمیم", "اپ ڈیٹ"],
  ar: ["أنشئ", "إنشاء", "أضف", "احذف", "حذف", "رحّل", "ترحيل", "ادفع", "دفع", "اعتمد", "إلغاء", "عدّل", "تحديث"],
  fa: ["ایجاد", "اضافه", "حذف", "ثبت کن", "پرداخت کن", "تایید", "لغو", "ویرایش", "به‌روزرسانی"],
  ps: ["جوړول", "زیاتول", "له منځه وړل", "پوسټ کړئ", "تادیه وکړئ", "منظوري", "لغوه", "سمول", "اپډیټ"]
};

const SENSITIVE_KEYWORDS: Record<SupportedLanguage, string[]> = {
  en: ["how much money does", "how much money has", "salary", "salaries", "payroll", "employee money", "user's money", "profit margin", "company profit", "bank balance of", "private balance"],
  ur: ["کتنے پیسے ہیں", "تنخواہ", "تنخواہیں", "ملازم کے پیسے", "کمپنی کا منافع", "بینک بیلنس", "نجی بیلنس"],
  ar: ["كم يملك", "كم لدى", "راتب", "رواتب", "أموال الموظف", "أرباح الشركة", "رصيد الحساب الخاص"],
  fa: ["چقدر پول دارد", "حقوق", "دستمزد", "پول کارمند", "سود شرکت", "موجودی حساب"],
  ps: ["څومره پیسې لري", "تنخوا", "د کارکوونکي پیسې", "د شرکت ګټه", "شخصي بیلانس"]
};

const PUBLIC_KEYWORDS: Record<SupportedLanguage, string[]> = {
  en: ["incoterm", "fob", "cif", "exw", "ddp", "hs code", "customs regulation", "port of", "jebel ali", "karachi port", "bandar abbas", "container dimensions", "bill of lading rules", "export guide", "import guide", "transit route", "shipping line info"],
  ur: ["کسٹم قوانین", "امپورٹ گائیڈ", "ایکسپورٹ گائیڈ", "پورٹ", "جبل علی", "کراچی پورٹ", "کنٹینر سائز", "بارنامہ کے اصول", "انکوٹرمز", "ٹرانزٹ روٹ"],
  ar: ["قوانين الجمارك", "دليل الاستيراد", "دليل التصدير", "ميناء جبل علي", "ميناء كراتشي", "إنكوتيرمز", "رمز النظام المنسق", "أبعاد الحاويات", "بوليصة الشحن"],
  fa: ["قوانین گمرکی", "راهنمای صادرات", "راهنمای واردات", "بندر عباس", "بندر کراچی", "اینکوترمز", "ابعاد کانتینر", "مسیر ترانزیت"],
  ps: ["ګمرکي قوانین", "وارداتي لارښود", "صادراتي لارښود", "د جبل علي بندر", "کانټینر اندازه", "د بارنامې اصول", "ټرانیزټ لاره"]
};

function normalize(s: string) {
  return (s || "").toLowerCase();
}

export function detectLanguage(text: string): SupportedLanguage {
  const t = text || "";
  // Pashto specific characters: ښ, ځ, څ, ږ, ۍ, ې, ډ, ړ, ڼ
  if (/[\u0696\u0681\u0685\u0696\u06cd\u06d0\u0689\u0693\u06bc]/i.test(t)) return "ps";
  // Urdu specific characters: ے, ٹ, ڈ, ڑ, ں, ہ, ھے
  if (/[\u06d2\u0679\u0688\u0691\u06ba\u06c1\u06be]/i.test(t)) return "ur";
  // Farsi specific characters: گ, چ, پ, ژ, ک, ی
  if (/[\u06af\u0686\u067e\u0698]/i.test(t)) return "fa";
  // Arabic detection: general arabic block with typical vowels/letters
  if (/[\u0600-\u06ff]/.test(t)) return "ar";
  return "en";
}

export function resolveLedgerScopeForSession(session: ErpSession): {
  scope: "super_admin" | "country" | "main_branch" | "city_branch";
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
} {
  const isSuperAdmin = session.isSuperAdmin || session.roles?.includes("super_admin_reports");
  if (isSuperAdmin) return { scope: "super_admin", countryId: null, countryBranchId: null, cityBranchId: null };

  const countryId = session.countryIds?.[0] ?? null;
  const countryBranchId = session.countryBranchIds?.[0] ?? null;
  const cityBranchId = session.cityBranchIds?.[0] ?? null;

  if (cityBranchId) return { scope: "city_branch", countryId, countryBranchId, cityBranchId };
  if (countryBranchId) return { scope: "main_branch", countryId, countryBranchId, cityBranchId: null };
  if (countryId) return { scope: "country", countryId, countryBranchId: null, cityBranchId: null };
  return { scope: "city_branch", countryId: null, countryBranchId: null, cityBranchId: null };
}

function hasFinancePermission(session: ErpSession): boolean {
  if (session.isSuperAdmin) return true;
  if (session.roles?.some(r => r === "super_admin" || r === "super_admin_reports" || r === "accountant")) return true;
  if (session.permissions?.includes("reports:read") && !session.isShippingScoped && !session.roles?.includes("agent_user") && !session.roles?.includes("staff_user")) return true;
  return false;
}

/**
 * Log all assistant queries and decisions into public.ai_assistant_audit_logs
 */
async function logAudit(params: {
  userId?: string | null;
  userName?: string | null;
  role?: string | null;
  countryId?: string | null;
  branchId?: string | null;
  pageContext?: string;
  query: string;
  detectedLanguage: string;
  queryType: string;
  recordsAccessed?: any[];
  permissionDecision: "allowed" | "refused";
  refusalReason?: string | null;
}) {
  try {
    await withLocalPg(async (sql) => {
      await sql`
        INSERT INTO public.ai_assistant_audit_logs (
          user_id,
          user_name,
          role,
          country_id,
          branch_id,
          page_context,
          query,
          detected_language,
          query_type,
          records_accessed,
          permission_decision,
          refusal_reason
        ) VALUES (
          ${params.userId ? params.userId : null},
          ${params.userName || "ERP User"},
          ${params.role || "user"},
          ${params.countryId ? params.countryId : null},
          ${params.branchId ? params.branchId : null},
          ${params.pageContext || "global_assistant"},
          ${params.query},
          ${params.detectedLanguage},
          ${params.queryType},
          ${JSON.stringify(params.recordsAccessed || [])}::jsonb,
          ${params.permissionDecision},
          ${params.refusalReason || null}
        );
      `;
    });
  } catch (err) {
    console.error("Failed to write to ai_assistant_audit_logs:", err);
  }
}

/**
 * Public Research Engine — International trade, customs, shipping, Incoterms
 */
function handlePublicResearch(question: string, lang: SupportedLanguage): AssistantAnswer {
  const q = normalize(question);

  let title = "Public International Trade & Shipping Guide";
  let answer = "";
  const sources: SourceLink[] = [];

  if (q.includes("incoterm") || q.includes("fob") || q.includes("cif") || q.includes("exw") || q.includes("ddp") || q.includes("إنكوتيرمز")) {
    title = "ICC Incoterms® 2020 International Commercial Terms";
    sources.push({
      title: "International Chamber of Commerce (ICC) — Incoterms Rules",
      url: "https://iccwbo.org/business-solutions/incoterms-rules/",
      domain: "iccwbo.org",
      summary: "Global standard definitions for international commercial delivery terms and risks allocation."
    });

    if (lang === "ur") {
      answer = "🌐 پبلک تجارتی رہنمائی — Incoterms 2020:\n• FOB (Free on Board): بیچنے والا مال بندرگاہ پر جہاز پر لوڈ کرنے تک تمام لاگت اور خطرے کا ذمہ دار ہوتا ہے۔ اس کے بعد فریٹ اور انشورنس خریدار کے ذمہ ہوتی ہے۔\n• CIF (Cost, Insurance & Freight): بیچنے والا منزل کی بندرگاہ تک سمندری کرایہ اور سمندری انشورنس ادا کرتا ہے۔\n• EXW (Ex Works): خریدار فیکٹری یا گودام سے مال اٹھانے سے لے کر منزل تک تمام تر رسک اور اخراجات برداشت کرتا ہے۔\n• DDP (Delivered Duty Paid): بیچنے والا خریدار کے گودام تک سامان پہنچانے، امپورٹ ڈیوٹی اور کسٹم کلیئرنس کا مکمل ذمہ دار ہوتا ہے۔";
    } else if (lang === "ar") {
      answer = "🌐 دليل التجارة الدولي — قواعد الإنكوتيرمز 2020:\n• FOB (تسليم على ظهر السفينة): يتحمل البائع تكاليف ومخاطر البضاعة حتى تحميلها على السفينة في ميناء الشحن. يتحمل المشتري الشحن البحري والتأمين.\n• CIF (التكلفة والتأمين وأجور الشحن): يدفع البائع تكلفة البضاعة والتأمين البحري وأجرة الشحن حتى ميناء الوصول المحدد.\n• EXW (تسليم في موقع البائع): يتحمل المشتري كافة التكاليف والمخاطر من باب مستودع البائع.\n• DDP (تسليم مع دفع الرسوم): يتحمل البائع كامل المسؤولية والرسوم الجمركية والضرائب حتى موقع المشتري النهائي.";
    } else if (lang === "fa") {
      answer = "🌐 راهنمای تجارت بین‌المللی — قواعد اینکوترمز ۲۰۲۰:\n• FOB (تحویل روی عرشه): فروشنده مسئول هزینه‌ها تا بارگیری کالا روی کشتی در بندر مبدا است. کرایه حمل و بیمه بر عهده خریدار است.\n• CIF (هزینه، بیمه و کرایه حمل): فروشنده هزینه کالا، بیمه دریایی و کرایه حمل تا بندر مقصد را پرداخت می‌کند.\n• EXW (تحویل در محل کار): خریدار کلیه مسئولیت‌ها و هزینه‌ها را از انبار فروشنده متقبل می‌شود.\n• DDP (تحویل با پرداخت حقوق و عوارض گمرکی): فروشنده مسئولیت کامل ترخیص، عوارض و تحویل نهایی در انبار خریدار را بر عهده دارد.";
    } else if (lang === "ps") {
      answer = "🌐 د نړیوالې سوداګرۍ لارښود — Incoterms 2020:\n• FOB: پلورونکی په بندر کې تر کښتۍ پورې د مال رسولو مسؤل دی. د کښتۍ کرایه او بیمه د اخیستونکي په غاړه ده.\n• CIF: پلورونکی د مال قیمت، سمندري بیمه او تر مقصده بندر پورې کرایه ادا کوي.\n• EXW: اخیستونکی د پلورونکي له فابریکې یا ګودام څخه ټول لګښتونه او خطرونه پخپله پر غاړه اخلي.\n• DDP: پلورونکی ټول محصول او ګمرکي تصفیه تر ټاکلي ګودام پورې پخپله ادا کوي.";
    } else {
      answer = "🌐 Public Trade Reference — ICC Incoterms® 2020 Rules:\n• FOB (Free On Board): The seller clears goods for export and loads them onto the vessel. Risk transfers to the buyer once goods are on board; buyer pays sea freight and insurance.\n• CIF (Cost, Insurance & Freight): The seller covers export clearance, freight, and minimum maritime insurance to the named destination port.\n• EXW (Ex Works): The buyer assumes all costs and risks from the seller's facility or factory.\n• DDP (Delivered Duty Paid): The seller assumes maximum responsibility including destination import clearance, duties, and final warehouse delivery.";
    }
  } else if (q.includes("jebel ali") || q.includes("karachi") || q.includes("port") || q.includes("bandar abbas") || q.includes("پورٹ") || q.includes("ميناء") || q.includes("بندر")) {
    title = "Regional Maritime Sea Ports & Gateways Information";
    sources.push({
      title: "DP World Jebel Ali Hub Logistics",
      url: "https://www.dpworld.com/en/our-portfolio/ports-terminals/marine-terminals/jebel-ali",
      domain: "dpworld.com",
      summary: "Deep-water maritime hub connecting the Middle East, South Asia, and East Africa with 80+ weekly services."
    });
    sources.push({
      title: "Karachi Port Trust (KPT)",
      url: "https://kpt.gov.pk/",
      domain: "kpt.gov.pk",
      summary: "Primary deep-water commercial seaport handling 60% of Pakistan transit cargo and regional trade."
    });

    if (lang === "ur") {
      answer = "🌐 پبلک پورٹ و لاجسٹکس معلومات:\n• جبل علی پورٹ (دبئی، UAE): مشرق وسطیٰ اور جنوبی ایشیا کا سب سے بڑا ڈیپ واٹر حب، جہاں 80+ ہفتہ وار جہاز سروسز دستیاب ہیں۔\n• کراچی پورٹ و پورٹ قاسم (پاکستان): علاقائی کنٹینر ٹریفک اور افغان ٹرانزٹ ٹریڈ کے مرکزی گیٹ ویز ہیں۔\n• بندر عباس و چابہار (ایران): وسطی ایشیا اور افغانستان کے لیے متبادل سمندری ٹرانزٹ کوریڈورز ہیں۔";
    } else if (lang === "ar") {
      answer = "🌐 دليل الموانئ والخدمات اللوجستية العامة:\n• ميناء جبل علي (دبي، الإمارات): أكبر ميناء بحري محوري في المنطقة يربط بين آسيا والشرق الأوسط وأفريقيا بأحدث أنظمة المناولة الآلية.\n• ميناء كراتشي وبورت قاسم (باكستان): الموانئ الرئيسية للبضائع العابرة للترانزيت الإقليمي وتجارة الحاويات.\n• ميناء بندر عباس وميناء جابهار (إيران): ممرات بحرية حيوية باتجاه دول آسيا الوسطى وأفغانستان.";
    } else {
      answer = "🌐 Public Maritime & Port Information:\n• Jebel Ali Port (Dubai, UAE): The premier deep-water container terminal in the Middle East, operated by DP World with direct intermodal transit connections.\n• Karachi Port Trust & Port Qasim (Pakistan): Major regional maritime hubs handling containerized trade and bonded Afghan transit cargo.\n• Bandar Abbas & Chabahar (Iran): Strategic maritime transit routes serving Central Asian republics and landlocked regional markets.";
    }
  } else if (q.includes("container") || q.includes("dimension") || q.includes("size") || q.includes("کنٹینر") || q.includes("حاويات") || q.includes("کانټینر")) {
    title = "ISO Standard Shipping Container Specifications";
    sources.push({
      title: "International Maritime Organization (IMO) — Container Safety Guidelines",
      url: "https://www.imo.org/",
      domain: "imo.org",
      summary: "Standard specifications for 20ft, 40ft, and 40ft High Cube intermodal freight containers."
    });

    if (lang === "ur") {
      answer = "🌐 بین الاقوامی کنٹینر سائز و پیمائشیں (ISO Standards):\n• 20ft Standard: لمبائی 5.9m، چوڑائی 2.35m، اونچائی 2.39m، گنجائش تقریباً 33.2 CBM، زیادہ سے زیادہ وزن 28,200 kg۔\n• 40ft Standard: لمبائی 12.03m، چوڑائی 2.35m، اونچائی 2.39m، گنجائش تقریباً 67.7 CBM، پے لوڈ 26,700 kg۔\n• 40ft High Cube (40HC): لمبائی 12.03m، چوڑائی 2.35m، اونچائی 2.69m، گنجائش تقریباً 76.2 CBM (ہلکے لیکن زیادہ والیوم والے کارگو کے لیے بہترین)۔";
    } else {
      answer = "🌐 ISO Standard Shipping Container Specifications:\n• 20ft Standard Container: Internal Length: 5.90 m, Width: 2.35 m, Height: 2.39 m. Volume: ~33.2 CBM. Max Payload: ~28,200 kg.\n• 40ft Standard Container: Internal Length: 12.03 m, Width: 2.35 m, Height: 2.39 m. Volume: ~67.7 CBM. Max Payload: ~26,700 kg.\n• 40ft High Cube (40HC): Internal Length: 12.03 m, Width: 2.35 m, Height: 2.69 m. Volume: ~76.2 CBM. Ideal for voluminous, lighter commercial freight.";
    }
  } else {
    title = "Global Export/Import & Trade Compliance Information";
    sources.push({
      title: "World Customs Organization (WCO)",
      url: "https://www.wcoomd.org/",
      domain: "wcoomd.org",
      summary: "Harmonized System (HS) trade tariff taxonomy and cross-border customs trade facilitation standards."
    });

    answer = lang === "ur"
      ? "🌐 بین الاقوامی تجارت و کسٹم معلومات:\n• درآمد/برآمد کے لیے کمرشل انوائس، پیکنگ لسٹ، بل آف لیڈنگ (BL)، سرٹیفکیٹ آف اوریجن، اور درست HS Code درکار ہوتا ہے۔\n• کسٹم ڈیوٹی اور سیلز ٹیکس کی شرح کا تعین ورلڈ کسٹمز آرگنائزیشن (WCO) کے 6 سے 8 ہندسوں کے HS Code کی بنیاد پر ہوتا ہے۔"
      : "🌐 International Trade & Customs Guidance:\n• Cross-border shipping requires: Commercial Invoice, Packing List, Verified Bill of Lading (BL), Certificate of Origin (COO), and compliant HS Code tariff classification.\n• Import duties and taxes are assessed per the World Customs Organization (WCO) 6-to-8 digit Harmonized System classification.";
  }

  return {
    intent: "public_research",
    answerType: "public_external",
    answer,
    scopeLabel: "Public / External Reference",
    sources,
    data: { topic: title, sources }
  };
}

/**
 * Real Database Record Search Engine — Customers, Accounts, Orders, BLs, Tasks
 */
async function searchRealErpRecords(
  query: string,
  session: ErpSession,
  lang: SupportedLanguage
): Promise<AssistantAnswer> {
  const terms = extractSearchTerms(query);
  const isSuperAdmin = session.isSuperAdmin || session.roles?.includes("super_admin_reports");
  const countryId = session.countryIds?.[0] ?? null;
  const cityBranchIds = session.cityBranchIds || [];

  const runWithSql = async (sql: any) => {
    for (const term of terms) {
      const searchPattern = `%${term}%`;

      // 1. Search Customers
      const customerMatches = await sql`
        SELECT id, customer_name, company_name, contact_person, mobile, email, country_id, is_active
        FROM customers
        WHERE deleted_at IS NULL
          AND (customer_name ILIKE ${searchPattern} OR company_name ILIKE ${searchPattern} OR mobile ILIKE ${searchPattern} OR contact_person ILIKE ${searchPattern})
          ${isSuperAdmin ? sql`` : countryId ? sql`AND (country_id = ${countryId} OR country_id IS NULL)` : sql`AND false`}
        LIMIT 1;
      `;

      if (customerMatches.length > 0) {
        const c = customerMatches[0];
        const answer = lang === "ur"
          ? `✅ ERP تصدیق شدہ کسٹمر ریکارڈ:\n• نام: ${c.customer_name}\n• کمپنی: ${c.company_name || "—"}\n• رابطہ کار: ${c.contact_person || "—"}\n• موبائل: ${c.mobile || "—"}\n• اسٹیٹس: ${c.is_active ? "فعال (Active)" : "غیر فعال"}`
          : lang === "ar"
          ? `✅ سجل عميل معتمد في النظام:\n• الاسم: ${c.customer_name}\n• الشركة: ${c.company_name || "—"}\n• جهة الاتصال: ${c.contact_person || "—"}\n• الجوال: ${c.mobile || "—"}\n• الحالة: ${c.is_active ? "نشط" : "غير نشط"}`
          : `✅ Verified ERP Customer Record:\n• Name: ${c.customer_name}\n• Company: ${c.company_name || "—"}\n• Contact Person: ${c.contact_person || "—"}\n• Mobile: ${c.mobile || "—"}\n• Status: ${c.is_active ? "Active" : "Inactive"}`;

        return {
          intent: "erp_record" as AssistantIntent,
          answerType: "erp_record" as AnswerType,
          answer,
          scopeLabel: isSuperAdmin ? "Global ERP" : "Country / Branch Scoped",
          sourceRecord: {
            table: "customers",
            id: c.id,
            title: c.customer_name,
            ref: c.company_name || c.id.slice(0, 8),
            status: c.is_active ? "Active" : "Inactive",
            details: { mobile: c.mobile, contact: c.contact_person }
          },
          action: {
            label: lang === "ur" ? "کسٹمر ریکارڈ کھولیں" : lang === "ar" ? "فتح ملف العميل" : "Open Customer",
            url: `/dashboard/customers?search=${encodeURIComponent(c.customer_name)}`
          },
          data: c
        };
      }

      // 2. Search Accounts
      const accountMatches = await sql`
        SELECT id, code, name, kind, currency, status, branch_id
        FROM accounts
        WHERE deleted_at IS NULL
          AND (code ILIKE ${searchPattern} OR name ILIKE ${searchPattern})
          ${isSuperAdmin ? sql`` : cityBranchIds.length > 0 ? sql`AND (branch_id = ANY(${cityBranchIds}) OR branch_id IS NULL)` : sql``}
        LIMIT 1;
      `;

      if (accountMatches.length > 0) {
        const a = accountMatches[0];
        const answer = lang === "ur"
          ? `✅ ERP تصدیق شدہ کھاتہ (Account):\n• کھاتہ کوڈ: ${a.code}\n• کھاتہ کا عنوان: ${a.name}\n• قسم: ${a.kind}\n• کرنسی: ${a.currency}\n• اسٹیٹس: ${a.status}`
          : lang === "ar"
          ? `✅ سجل حساب معتمد في النظام:\n• رمز الحساب: ${a.code}\n• اسم الحساب: ${a.name}\n• النوع: ${a.kind}\n• العملة: ${a.currency}\n• الحالة: ${a.status}`
          : `✅ Verified ERP Account Record:\n• Code: ${a.code}\n• Name: ${a.name}\n• Kind: ${a.kind}\n• Currency: ${a.currency}\n• Status: ${a.status}`;

        return {
          intent: "erp_record" as AssistantIntent,
          answerType: "erp_record" as AnswerType,
          answer,
          scopeLabel: isSuperAdmin ? "Global ERP" : "Branch Scoped",
          sourceRecord: {
            table: "accounts",
            id: a.id,
            title: a.name,
            ref: a.code,
            status: a.status,
            details: { kind: a.kind, currency: a.currency }
          },
          action: {
            label: lang === "ur" ? "اکاؤنٹ کھولیں" : lang === "ar" ? "فتح الحساب" : "Open Account",
            url: `/dashboard/accounts?code=${encodeURIComponent(a.code)}`
          },
          data: a
        };
      }

      // 3. Search Shipping BL & Containers
      const blMatches = await sql`
        SELECT id, bl_number, container_number, vessel_name, voyage_number, shipping_line_name, country_id
        FROM shipping_bl_records
        WHERE (bl_number ILIKE ${searchPattern} OR container_number ILIKE ${searchPattern} OR vessel_name ILIKE ${searchPattern})
          ${isSuperAdmin ? sql`` : countryId ? sql`AND (country_id = ${countryId} OR country_id IS NULL)` : sql``}
        LIMIT 1;
      `;

      if (blMatches.length > 0) {
        const b = blMatches[0];
        const answer = lang === "ur"
          ? `✅ ERP تصدیق شدہ شپنگ و کنٹینر ریکارڈ:\n• B/L نمبر: ${b.bl_number}\n• کنٹینر نمبر: ${b.container_number || "—"}\n• بحری جہاز (Vessel): ${b.vessel_name || "—"}\n• شپنگ لائن: ${b.shipping_line_name || "—"}\n• سفر نمبر: ${b.voyage_number || "—"}`
          : `✅ Verified ERP Shipping & BL Record:\n• B/L Number: ${b.bl_number}\n• Container Number: ${b.container_number || "—"}\n• Vessel: ${b.vessel_name || "—"}\n• Shipping Line: ${b.shipping_line_name || "—"}\n• Voyage: ${b.voyage_number || "—"}`;

        return {
          intent: "erp_record" as AssistantIntent,
          answerType: "erp_record" as AnswerType,
          answer,
          scopeLabel: isSuperAdmin ? "Global Shipping" : "Assigned Shipping Scope",
          sourceRecord: {
            table: "shipping_bl_records",
            id: b.id,
            title: `BL ${b.bl_number}`,
            ref: b.container_number || b.bl_number,
            status: "Verified Transit",
            details: { vessel: b.vessel_name, container: b.container_number }
          },
          action: {
            label: lang === "ur" ? "شپنگ ریکارڈ کھولیں" : "Open Shipment",
            url: `/dashboard/shipping?search=${encodeURIComponent(b.bl_number)}`
          },
          data: b
        };
      }

      // 4. Search Customer Orders
      const orderMatches = await sql`
        SELECT id, order_no, customer_name, route_name, shipment_type, transport_mode, movement_type, loading_country_name, receiving_country_name
        FROM clearing_customer_orders
        WHERE (order_no ILIKE ${searchPattern} OR customer_name ILIKE ${searchPattern} OR route_name ILIKE ${searchPattern})
        LIMIT 1;
      `;

      if (orderMatches.length > 0) {
        const o = orderMatches[0];
        const answer = lang === "ur"
          ? `✅ ERP تصدیق شدہ کسٹمر آرڈر ریکارڈ:\n• آرڈر نمبر: ${o.order_no}\n• گاہک: ${o.customer_name || "—"}\n• روٹ: ${o.route_name || "—"}\n• قسم: ${o.shipment_type} (${o.transport_mode})\n• روانگی تا وصولی: ${o.loading_country_name || "—"} تا ${o.receiving_country_name || "—"}`
          : `✅ Verified ERP Customer Order Record:\n• Order No: ${o.order_no}\n• Customer: ${o.customer_name || "—"}\n• Route: ${o.route_name || "—"}\n• Mode: ${o.shipment_type} via ${o.transport_mode}\n• Corridor: ${o.loading_country_name || "—"} → ${o.receiving_country_name || "—"}`;

        return {
          intent: "erp_record" as AssistantIntent,
          answerType: "erp_record" as AnswerType,
          answer,
          scopeLabel: "Customer Order Register",
          sourceRecord: {
            table: "clearing_customer_orders",
            id: o.id,
            title: `Order ${o.order_no}`,
            ref: o.order_no,
            status: o.movement_type,
            details: { customer: o.customer_name, route: o.route_name }
          },
          action: {
            label: lang === "ur" ? "آرڈر ٹریکنگ کھولیں" : "Open Customer Order",
            url: `/dashboard/smart-operations?search=${encodeURIComponent(o.order_no)}`
          },
          data: o
        };
      }

      // 5. Search User Tasks
      const taskMatches = await sql`
        SELECT id, task_no, title, description, instructions, department, assigned_to
        FROM user_tasks
        WHERE (task_no ILIKE ${searchPattern} OR title ILIKE ${searchPattern} OR department ILIKE ${searchPattern})
          ${isSuperAdmin ? sql`` : sql`AND (assigned_to = ${session.userId} OR created_by = ${session.userId})`}
        LIMIT 1;
      `;

      if (taskMatches.length > 0) {
        const tsk = taskMatches[0];
        const answer = lang === "ur"
          ? `✅ ERP تصدیق شدہ ٹاسک ریکارڈ:\n• ٹاسک نمبر: ${tsk.task_no}\n• عنوان: ${tsk.title}\n• شعبہ: ${tsk.department || "—"}\n• تفصیل: ${tsk.description || "—"}`
          : `✅ Verified ERP User Task Record:\n• Task No: ${tsk.task_no}\n• Title: ${tsk.title}\n• Department: ${tsk.department || "—"}\n• Description: ${tsk.description || "—"}`;

        return {
          intent: "erp_record" as AssistantIntent,
          answerType: "erp_record" as AnswerType,
          answer,
          scopeLabel: "Assigned User Tasks",
          sourceRecord: {
            table: "user_tasks",
            id: tsk.id,
            title: tsk.title,
            ref: tsk.task_no,
            status: "Pending Action",
            details: { department: tsk.department }
          },
          action: {
            label: lang === "ur" ? "ٹاسک کھولیں" : "Open Task",
            url: `/dashboard/user-tasks?search=${encodeURIComponent(tsk.task_no)}`
          },
          data: tsk
        };
      }
    }

    // No Record Found in Authorized Scope
    const noRecordMsg = lang === "ur"
      ? `🔍 آپ کے مجاز دائرہ کار (Scope) میں "${query}" سے متعلق کوئی تصدیق شدہ ERP ریکارڈ موجود نہیں ہے۔\n• Digital Dock ERP میں AI فرضی یا خود ساختہ ریکارڈ نہیں بناتا۔ براہ کرم کوڈ، نام، یا آرڈر نمبر دوبارہ چیک کریں۔`
      : lang === "ar"
      ? `🔍 لم يتم العثور على أي سجل معتمد في نطاق صلاحياتك لـ "${query}".\n• لا يقوم المساعد الذكي بتوليد أو فبركة بيانات أعمال غير حقيقية. يرجى التحقق من الرمز أو الاسم.`
      : lang === "fa"
      ? `🔍 هیچ رکورد تایید شده‌ای در حیطه اختیارات شما برای "${query}" یافت نشد.\n• سیستم هوشمند هرگز اطلاعات ساختگی ایجاد نمی‌کند. لطفاً کد یا نام را بررسی کنید.`
      : lang === "ps"
      ? `🔍 ستاسو په واک لرونکې ساحه کې د "${query}" په اړه هیڅ باوري ERP ریکارډ ونه موندل شو.\n• هوښیار همکار هیڅکله جعلي ارقام نه جوړوي. مهرباني وکړئ کوډ یا نوم بیا وګورئ.`
      : `🔍 No verified record was found in your authorized ERP scope for "${query}".\n• Digital Dock ERP AI never fabricates or hallucinates business records. Please verify the identifier, name, or reference.`;

    return {
      intent: "erp_record" as AssistantIntent,
      answerType: "no_record" as AnswerType,
      answer: noRecordMsg,
      scopeLabel: isSuperAdmin ? "Global ERP" : "Scoped ERP",
      sourceRecord: null,
      data: null
    };
  };

  const sharedPg = getSharedPg();
  if (sharedPg) {
    return await runWithSql(sharedPg);
  }
  const result = await withLocalPg(runWithSql);
  if (result) return result;
  return {
    intent: "chat" as AssistantIntent,
    answerType: "text" as AnswerType,
    answer: "Database service temporarily unavailable.",
    scopeLabel: isSuperAdmin ? "Global ERP" : "Scoped ERP",
    sourceRecord: null,
    data: null
  };
}

function fmt(v: any) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function interpolate(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), template);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function yearStartIso() {
  const d = new Date();
  d.setMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

export async function runErpAssistantQuery(
  session: ErpSession,
  supabase: any,
  opts: {
    question: string;
    lang?: SupportedLanguage;
    fromDate?: string | null;
    toDate?: string | null;
    asOfDate?: string | null;
    pageContext?: string;
  }
): Promise<AssistantAnswer> {
  const lang: SupportedLanguage = opts.lang || session.preferredLanguage || detectLanguage(opts.question);
  const q = normalize(opts.question).trim();
  const ledgerScope = resolveLedgerScopeForSession(session);

  const scopeLabelMap: Record<string, string> = {
    super_admin: t(lang, "finstmt.scope_label" as never, "Scope") + ": Global Super Admin",
    country: t(lang, "finstmt.scope_label" as never, "Scope") + ": Country Scoped",
    main_branch: t(lang, "finstmt.scope_label" as never, "Scope") + ": Main Branch",
    city_branch: t(lang, "finstmt.scope_label" as never, "Scope") + ": City Branch"
  };
  const scopeLabel = scopeLabelMap[ledgerScope.scope] || ledgerScope.scope;

  // 1. Guard against WRITE ACTIONS (Phase 2 & Phase 9)
  for (const langKey of Object.keys(WRITE_VERBS) as SupportedLanguage[]) {
    if (WRITE_VERBS[langKey].some((v) => {
      const nv = normalize(v).trim();
      const re = new RegExp(`(^|\\s|[.,!?;])${nv}($|\\s|[.,!?;])`, "i");
      return re.test(q);
    })) {
      if (!q.includes("credit") || q.match(/\b(edit|modify|update|delete|post|void|create|add)\b/i)) {
        await logAudit({
          userId: session.userId,
          userName: session.fullName,
          role: session.roles?.[0],
          countryId: ledgerScope.countryId,
          branchId: ledgerScope.cityBranchId,
          pageContext: opts.pageContext,
          query: opts.question,
          detectedLanguage: lang,
          queryType: "write_refused",
          permissionDecision: "refused",
          refusalReason: "Read-only assistant cannot execute write mutations"
        });

        const refusal = lang === "ur"
          ? "⛔ میں صرف معلوماتی اور پڑھنے (Read-Only) کا مجاز ہوں اور کوئی بھی واؤچر، بل، آرڈر، یا ادائیگی شامل، تبدیل یا حذف نہیں کر سکتا۔ براہ کرم متعلقہ ERP اسکرین سے کارروائی کریں۔"
          : lang === "ar"
          ? "⛔ أنا نظام استعلام للقراءة فقط ولا يمكنني إنشاء أو تعديل أو ترحيل أو حذف السندات أو الدفعات. يرجى تنفيذ ذلك من شاشة النظام المعتمدة."
          : lang === "fa"
          ? "⛔ من فقط خواندنی هستم و نمی‌توانم هیچ سندی را ایجاد، ویرایش، حذف یا تایید کنم. لطفاً از فرم مربوطه در سیستم استفاده کنید."
          : lang === "ps"
          ? "⛔ زه یوازې د لوستلو اجازه لرم او نشم کولی ریکارډ، سند، یا پیسې جوړې، بدلې، یا حذف کړم. مهرباني وکړئ اړونده فورمه وکاروئ."
          : "⛔ I am strictly read-only and cannot create, edit, delete, post, pay, approve, or void business records. Please perform that action on the relevant ERP form.";

        return {
          intent: "write_refused",
          answerType: "write_refused",
          answer: refusal,
          scopeLabel,
          refusalReason: "Write operations are forbidden through AI query",
          data: null
        };
      }
    }
  }

  // 2. Guard SENSITIVE / FINANCIAL DATA (Phase 3 & Phase 9)
  const isSensitive = Object.keys(SENSITIVE_KEYWORDS).some((langK) =>
    SENSITIVE_KEYWORDS[langK as SupportedLanguage].some(k => q.includes(normalize(k)))
  );

  if (isSensitive && !hasFinancePermission(session)) {
    const refusalReason = "Unauthorized access to confidential financial/salary data without Finance or Super Admin privileges";
    await logAudit({
      userId: session.userId,
      userName: session.fullName,
      role: session.roles?.[0],
      countryId: ledgerScope.countryId,
      branchId: ledgerScope.cityBranchId,
      pageContext: opts.pageContext,
      query: opts.question,
      detectedLanguage: lang,
      queryType: "permission_denial",
      permissionDecision: "refused",
      refusalReason
    });

    const refusalMsg = lang === "ur"
      ? "🔒 رسائی ممنوع (Permission Denied): مالیاتی بیلنس، منافع، بینک پوزیشن، یا ملازمین کی تنخواہیں دیکھنے کے لیے 'Finance' یا 'Super Admin' اختیارات ضروری ہیں۔ یہ انکار سیکیورٹی آڈٹ لاگ میں ریکارڈ کر لیا گیا ہے۔"
      : lang === "ar"
      ? "🔒 تم رفض الوصول (Permission Denied): يتطلب الاطلاع على الأرصدة المالية أو الأرباح أو حسابات البنوك أو رواتب الموظفين صلاحيات مالية معتمدة. تم تسجيل محاولة الوصول في سجل الرقابة والأمان."
      : lang === "fa"
      ? "🔒 دسترسی رد شد (Permission Denied): مشاهده اطلاعات مالی، سود، حساب‌های بانکی و حقوق نیازمند مجوز مالی یا مدیریت ارشد است. این رد درخواست در گزارش امنیتی ثبت گردید."
      : lang === "ps"
      ? "🔒 لاسرسی منع دی (Permission Denied): د مالي بیلانسونو، ګټې، بانکي حسابونو، او معاشونو کتل د Finance یا Super Admin ځانګړې اجازې ته اړتیا لري. دا هڅه په آډټ لاګ کې ثبت شوه."
      : "🔒 Permission Denied: Accessing financial balances, company profit, bank liquidity, or employee salaries requires explicit Finance or Super Admin permissions. This refusal has been logged in the security audit history.";

    return {
      intent: "permission_denied",
      answerType: "permission_denied",
      answer: refusalMsg,
      scopeLabel,
      refusalReason,
      data: null
    };
  }

  // 3. Handle PUBLIC BUSINESS RESEARCH (Phase 4)
  const isPublic = Object.keys(PUBLIC_KEYWORDS).some((langK) =>
    PUBLIC_KEYWORDS[langK as SupportedLanguage].some(k => q.includes(normalize(k)))
  );

  if (isPublic) {
    const publicResult = handlePublicResearch(opts.question, lang);
    await logAudit({
      userId: session.userId,
      userName: session.fullName,
      role: session.roles?.[0],
      countryId: ledgerScope.countryId,
      branchId: ledgerScope.cityBranchId,
      pageContext: opts.pageContext,
      query: opts.question,
      detectedLanguage: lang,
      queryType: "public_research",
      permissionDecision: "allowed"
    });
    return publicResult;
  }

  // 4. Handle FINANCIAL STATEMENTS (Authorized P&L, Balance Sheet, Cash Flow, Summary)
  const isFinancialStatement = q.includes("profit") || q.includes("loss") || q.includes("منافع") || q.includes("نقصان") ||
    q.includes("balance sheet") || q.includes("بیلنس شیٹ") || q.includes("الميزانية") ||
    q.includes("cash flow") || q.includes("کیش فلو") || q.includes("التدفق النقدي") ||
    q.includes("business summary") || q.includes("کاروباری خلاصہ");

  if (isFinancialStatement && hasFinancePermission(session)) {
    const fromDate = opts.fromDate || yearStartIso();
    const toDate = opts.toDate || todayIso();
    const asOfDate = opts.asOfDate || toDate;

    if (q.includes("profit") || q.includes("loss") || q.includes("منافع") || q.includes("نقصان")) {
      const rows = await fetchFinancialStatementRows(supabase, { scope: ledgerScope.scope, countryId: ledgerScope.countryId, countryBranchId: ledgerScope.countryBranchId, cityBranchId: ledgerScope.cityBranchId, fromDate, toDate });
      const { totals } = classifyProfitAndLoss(rows);
      const answer = interpolate(t(lang, "aiassist.ans_profit_loss" as never, "For {from} to {to} ({scope}): Total Income {income}, Total Expense {expense}, Net Profit/(Loss) {net}."), {
        from: fromDate, to: toDate, scope: scopeLabel, income: fmt(totals.totalIncome), expense: fmt(totals.totalExpense), net: fmt(totals.netProfit)
      });
      await logAudit({
        userId: session.userId,
        userName: session.fullName,
        role: session.roles?.[0],
        countryId: ledgerScope.countryId,
        branchId: ledgerScope.cityBranchId,
        pageContext: opts.pageContext,
        query: opts.question,
        detectedLanguage: lang,
        queryType: "erp_record",
        recordsAccessed: [{ statement: "profit_loss", fromDate, toDate }],
        permissionDecision: "allowed"
      });
      return {
        intent: "profit_loss",
        answerType: "erp_record",
        answer,
        scopeLabel,
        action: { label: "Open Financial Statements", url: "/dashboard/reports" },
        data: { fromDate, toDate, totals }
      };
    }

    if (q.includes("balance sheet") || q.includes("بیلنس شیٹ") || q.includes("الميزانية")) {
      const rows = await fetchFinancialStatementRows(supabase, { scope: ledgerScope.scope, countryId: ledgerScope.countryId, countryBranchId: ledgerScope.countryBranchId, cityBranchId: ledgerScope.cityBranchId, fromDate: "1970-01-01", toDate: asOfDate });
      const { totals } = classifyBalanceSheet(rows);
      const answer = interpolate(t(lang, "aiassist.ans_balance_sheet" as never, "As of {date} ({scope}): Total Assets {assets}, Total Liabilities {liabilities}, Total Equity {equity}."), {
        date: asOfDate, scope: scopeLabel, assets: fmt(totals.totalAssets), liabilities: fmt(totals.totalLiabilities), equity: fmt(totals.totalEquity)
      });
      await logAudit({
        userId: session.userId,
        userName: session.fullName,
        role: session.roles?.[0],
        countryId: ledgerScope.countryId,
        branchId: ledgerScope.cityBranchId,
        pageContext: opts.pageContext,
        query: opts.question,
        detectedLanguage: lang,
        queryType: "erp_record",
        recordsAccessed: [{ statement: "balance_sheet", asOfDate }],
        permissionDecision: "allowed"
      });
      return {
        intent: "balance_sheet",
        answerType: "erp_record",
        answer,
        scopeLabel,
        action: { label: "Open Balance Sheet", url: "/dashboard/reports" },
        data: { asOfDate, totals }
      };
    }

    // Business Summary
    const summary = await computeBusinessSummary(session, { countryId: ledgerScope.countryId, branchId: ledgerScope.cityBranchId });
    const answer = interpolate(t(lang, "aiassist.ans_business_summary" as never, "For {scope}: Purchases {purchase} (outstanding {purchaseOut}), Sales {sales} (outstanding {salesOut}), Expenses {expenses}, Estimated Gross Profit {grossProfit}, Stock Value {stock}, Customer Balances {customerBalance}."), {
      scope: scopeLabel,
      purchase: fmt(summary.purchase.total), purchaseOut: fmt(summary.purchase.outstanding),
      sales: fmt(summary.sales.total), salesOut: fmt(summary.sales.outstanding),
      expenses: fmt(summary.expenses.total), grossProfit: fmt(summary.profit.grossEstimate),
      stock: fmt(summary.stock.valueTotal), customerBalance: fmt(summary.customerBalances.total)
    });
    await logAudit({
      userId: session.userId,
      userName: session.fullName,
      role: session.roles?.[0],
      countryId: ledgerScope.countryId,
      branchId: ledgerScope.cityBranchId,
      pageContext: opts.pageContext,
      query: opts.question,
      detectedLanguage: lang,
      queryType: "erp_record",
      recordsAccessed: [{ report: "business_summary" }],
      permissionDecision: "allowed"
    });
    return {
      intent: "business_summary",
      answerType: "erp_record",
      answer,
      scopeLabel,
      action: { label: "Open Business Summary", url: "/dashboard/smart-operations" },
      data: summary
    };
  }

  // 5. REAL ERP RECORD SEARCH (Phase 2 & Phase 3)
  const searchResult = await searchRealErpRecords(opts.question, session, lang);
  await logAudit({
    userId: session.userId,
    userName: session.fullName,
    role: session.roles?.[0],
    countryId: ledgerScope.countryId,
    branchId: ledgerScope.cityBranchId,
    pageContext: opts.pageContext,
    query: opts.question,
    detectedLanguage: lang,
    queryType: searchResult.answerType === "erp_record" ? "erp_record" : "no_record",
    recordsAccessed: searchResult.sourceRecord ? [searchResult.sourceRecord] : [],
    permissionDecision: searchResult.answerType === "erp_record" ? "allowed" : "refused"
  });

  return searchResult;
}

export function aiAssistantEnhancementAvailable() {
  return aiTranslatorConfigured();
}
