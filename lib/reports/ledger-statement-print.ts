// File: lib/reports/ledger-statement-print.ts
/**
 * Customer General Ledger Statement — A4 Portrait & Landscape Printing Engine
 *
 * Strictly implements the two approved Customer General Ledger print designs:
 * 1. Landscape A4 (Reference Design 1):
 *    - Top Header: Bank Icon | CUSTOMER GENERAL LEDGER (left)  —  ADMIN REPORT | BANK-STYLE ACCOUNT STATEMENT (right)
 *    - Three Small Panels Across the Top:
 *        Panel 1: ACCOUNT DETAILS (16 fields in 2 compact columns)
 *        Panel 2: STATEMENT SUMMARY (Total Debit, Total Credit, Grand Balance, Starting Date, Last Date, Total Entries)
 *        Panel 3: REPORTING BASIS (Currency & USD equivalent explanation + Local Currency / USD Equivalent rows)
 *    - 12-Column Ledger Table:
 *        Date | Entry No. | Rzn. No. | Rzn. Name | Details | DR | CR | Balance | Ex. Rate | DR USD | CR USD | Balance USD
 *    - Footer: Horizontal line + Page X of Y
 *
 * 2. Portrait A4 (Reference Design 2):
 *    - Top Panel: ACCOUNT DETAILS (Account No., prominent Account Name, and 2-column metadata grid)
 *    - Middle Strip: STATEMENT SUMMARY | LOCAL <CURRENCY> (Debit, Credit, Balance, Start, Last, Entries)
 *    - Caption: Local figures use the customer currency; USD columns use saved per-entry rates.
 *    - 12-Column Ledger Table:
 *        Date | Entry No. | Rzn. No. | Rzn. Name | Details | DR | CR | Balance | Ex.Rate | DR USD | CR USD | Bal. USD
 *    - Multi-page support with repeated table headers and Page X of Y footer.
 *    - Zero SAMPLE DATA watermarks on production reports.
 */

import { t } from "@/lib/i18n/ui";
import { printStore } from "@/lib/store/print-store";

export type LedgerPrintOrientation = "portrait" | "landscape";

export type ERPCompanyInfo = {
  name?: string | null;
  legalName?: string | null;
  taxNo?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  logoUrl?: string | null;
};

export type LedgerPrintLine = {
  date: string | null;
  serial?: string | null;
  manualRef?: string | null;
  source: string | null;
  branch?: string | null;
  user?: string | null;
  description?: string | null;
  currency?: string | null;
  usdRate?: number | null;
  usdAmount?: number | null;
  debit: number;
  credit: number;
  /** running balance on the account's NORMAL side (positive = normal side) */
  balance: number;
  /** Specific columns requested */
  entryNo?: string | null;
  rznNo?: string | null;
  rznName?: string | null;
  userCode?: string | null;
  branchCode?: string | null;
};

export type LedgerPrintData = {
  company: ERPCompanyInfo;
  account: {
    name: string;
    code: string;
    customerNumber?: string | null;
    manualReference?: string | null;
    kind?: string | null;
    category?: string | null;
    currency: string;
    openedDate?: string | null;
    branchName?: string | null;
    branchCode?: string | null;
    countryCode?: string | null;
    country?: string | null;
    stateProvince?: string | null;
    city?: string | null;
    finalAddress?: string | null;
    address?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    branch?: string | null;
    company?: string | null;
  };
  normalBalance: "debit" | "credit";
  fromDate: string;
  toDate: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  lines: LedgerPrintLine[];
  printedBy?: string | null;
  printedAt?: string | null;
  /** set when the on-screen statement was narrowed by a user / branch filter */
  filterNote?: string | null;
};

const LANG_ORDER = ["en", "ur", "ar", "fa", "ps"] as const;
const RTL = new Set(["ur", "ar", "fa", "ps"]);

/**
 * 5-language tuple dictionary [en, ur, ar, fa, ps] for print-specific headings and captions.
 */
const PRINT_LABELS: Record<string, [string, string, string, string, string]> = {
  customer_general_ledger: [
    "CUSTOMER GENERAL LEDGER",
    "کسٹمر جنرل لیجر",
    "دفتر الأستاذ العام للعميل",
    "دفتر کل عمومی مشتری",
    "د پېرودونکي عمومي لیجر",
  ],
  admin_report: [
    "ADMIN REPORT",
    "ایڈمن رپورٹ",
    "تقرير الإدارة",
    "گزارش مدیریت",
    "د ادارې راپور",
  ],
  bank_style_statement: [
    "BANK-STYLE ACCOUNT STATEMENT",
    "بینک اسٹائل اکاؤنٹ اسٹیٹمنٹ",
    "كشف حساب بنكي",
    "صورت‌حساب بانکی",
    "بانکي حساب بیان",
  ],
  account_details: [
    "ACCOUNT DETAILS",
    "اکاؤنٹ کی تفصیلات",
    "تفاصيل الحساب",
    "جزئیات حساب",
    "د حساب تفصیلات",
  ],
  statement_summary: [
    "STATEMENT SUMMARY",
    "اسٹیٹمنٹ کا خلاصہ",
    "ملخص الكشف",
    "خلاصه صورت‌حساب",
    "د بیان لنډیز",
  ],
  reporting_basis: [
    "REPORTING BASIS",
    "رپورٹنگ کی بنیاد",
    "أساس التقرير",
    "مبنای گزارش‌دهی",
    "د راپور بنسټ",
  ],
  reporting_basis_desc: [
    "Each customer uses its own local currency. The final columns show the exchange rate and the equivalent amounts in USD, including USD Debit, USD Credit, and USD Balance.",
    "ہر کسٹمر اپنی مقامی کرنسی استعمال کرتا ہے۔ آخری کالمز میں ایکسچینج ریٹ اور امریکی ڈالر (USD) میں مساوی رقوم بشمول ڈالر ڈیبٹ، ڈالر کریڈٹ اور ڈالر بیلنس دکھائے گئے ہیں۔",
    "يستخدم كل عميل عملته المحلية الخاصة. تعرض الأعمدة الأخيرة سعر الصرف والمبالغ المعادلة بالدولار الأمريكي، بما في ذلك مدين ودائن ورصيد الدولار.",
    "هر مشتری از ارز محلی خود استفاده می‌کند. ستون‌های پایانی نرخ ارز و مبالغ معادل به دلار آمریکا شامل بدهکار، بستانکار و مانده دلاری را نشان می‌دهند.",
    "هر پېرودونکی خپله محلي اسعار کاروي. وروستۍ ستنې د اسعارو نرخ او په امریکایي ډالرو (USD) کې معادلې پیسې لکه ډالر ډیبټ، کریډټ او بیلانس ښیي.",
  ],
  local_currency_lbl: [
    "Local Currency",
    "مقامی کرنسی",
    "العملة المحلية",
    "ارز محلی",
    "محلي اسعار",
  ],
  local_currency_val: [
    ": Per customer (e.g., AED, USD, EUR, etc.)",
    ": فی کسٹمر (مثلاً AED, USD, EUR وغیرہ)",
    ": لكل عميل (مثل AED, USD, EUR إلخ)",
    ": به ازای هر مشتری (مانند AED, USD, EUR و غیره)",
    ": د هر پېرودونکي له مخې (لکه AED, USD, EUR او نور)",
  ],
  usd_equivalent_lbl: [
    "USD Equivalent",
    "ڈالر کے مساوی",
    "المعادل بالدولار",
    "معادل دلاری",
    "د ډالر معادل",
  ],
  usd_equivalent_val: [
    ": Ex. Rate, DR USD, CR USD, Balance USD",
    ": شرح مبادلہ، ڈیبٹ USD، کریڈٹ USD، بیلنس USD",
    ": سعر الصرف، مدين USD، دائن USD، رصيد USD",
    ": نرخ ارز، بدهکار USD، بستانکار USD، مانده USD",
    ": د تبادلې نرخ، ډیبټ USD، کریډټ USD، بیلانس USD",
  ],
  local_prefix: ["LOCAL", "مقامی", "محلي", "محلی", "محلي"],
  portrait_basis_note: [
    "Local figures use the customer currency; USD columns use saved per-entry rates.",
    "مقامی اعداد و شمار کسٹمر کی کرنسی میں ہیں؛ USD کالمز ہر اندراج کے محفوظ شدہ ریٹس استعمال کرتے ہیں۔",
    "الأرقام المحلية تستخدم عملة العميل؛ أعمدة الدولار تستخدم أسعار الصرف المحفوظة لكل قيد.",
    "ارقام محلی بر اساس ارز مشتری است؛ ستون‌های دلاری از نرخ‌های ذخیره‌شده هر سند استفاده می‌کنند.",
    "محلي شمېرې د پېرودونکي اسعار کاروي؛ د USD ستنې د هر ثبت خوندي شوي نرخونه کاروي.",
  ],
  account_name_lbl: ["Account Name", "اکاؤنٹ کا نام", "اسم الحساب", "نام حساب", "د حساب نوم"],
  state_city: ["State / City", "صوبہ / شہر", "الولاية / المدينة", "استان / شهر", "ولایت / ښار"],
  branch_country_lbl: ["Branch / Country", "برانچ / ملک", "الفرع / الدولة", "شعبه / کشور", "څانګه / هېواد"],
  opened_lbl: ["Opened", "تاریخ اجرا", "تاريخ الفتح", "تاریخ افتتاح", "پرانیستل شوی"],
  contact_lbl: ["Contact", "رابطہ", "الاتصال", "تماس", "اړیکه"],
  start_lbl: ["Start", "آغاز", "البداية", "شروع", "پیل"],
  last_lbl: ["Last", "اختتام", "النهاية", "پایان", "پای"],
  debit_short: ["Debit", "ڈیبٹ", "مدين", "بدهکار", "ډیبټ"],
  credit_short: ["Credit", "کریڈٹ", "دائن", "بستانکار", "کریډټ"],
  col_dr: ["DR", "ڈیبٹ", "مدين", "بدهکار", "ډیبټ"],
  col_cr: ["CR", "کریڈٹ", "دائن", "بستانکار", "کریډټ"],
  col_ex_rate: ["Ex. Rate", "ریٹ", "سعر الصرف", "نرخ ارز", "نرخ"],
  col_ex_rate_short: ["Ex.Rate", "ریٹ", "سعر الصرف", "نرخ ارز", "نرخ"],
  col_dr_usd: ["DR USD", "ڈیبٹ USD", "مدين USD", "بدهکار USD", "ډیبټ USD"],
  col_cr_usd: ["CR USD", "کریڈٹ USD", "دائن USD", "بستانکار USD", "کریډټ USD"],
  col_bal_usd: ["Balance USD", "بیلنس USD", "رصيد USD", "مانده USD", "بیلانس USD"],
  col_bal_usd_short: ["Bal. USD", "بیلنس USD", "رصيد USD", "مانده USD", "بیلانس USD"],
};

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(n: number): string {
  const v = Number.isFinite(n) ? Math.abs(n) : 0;
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function signedMoney(n: number): string {
  if (!Number.isFinite(n)) return "0.00";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < -0.0001 ? `-${abs}` : abs;
}

/** an LTR island for data inside RTL text (numbers, dates, codes) */
function ltr(v: unknown): string {
  return `<bdi dir="ltr">${esc(v)}</bdi>`;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats YYYY-MM-DD as "01 Jan 2026" while preserving the raw date in a data attribute */
function formatDisplayDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const yyyy = m[1];
    const mm = Number(m[2]);
    const dd = m[3];
    const mon = MONTHS_SHORT[mm - 1];
    if (mon) {
      return `<bdi dir="ltr" data-raw="${esc(s.slice(0, 10))}">${esc(`${dd} ${mon} ${yyyy}`)}</bdi>`;
    }
  }
  return ltr(s.slice(0, 10));
}

/** Formats row dates: DD/MM/YYYY in Landscape, DD/MM/YY in Portrait */
function formatRowDate(raw: string | null | undefined, portrait: boolean): string {
  if (!raw) return "—";
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const yyyy = m[1];
    const mm = m[2];
    const dd = m[3];
    const display = portrait ? `${dd}/${mm}/${yyyy.slice(2)}` : `${dd}/${mm}/${yyyy}`;
    return `<bdi dir="ltr" data-raw="${esc(s.slice(0, 10))}">${esc(display)}</bdi>`;
  }
  return ltr(s.slice(0, 10));
}

export function buildLedgerStatementPrintHtml(
  data: LedgerPrintData,
  opts: { lang: string; orientation: LedgerPrintOrientation }
): string {
  const lang = opts.lang || "en";
  const isRtl = RTL.has(lang);
  const portrait = opts.orientation === "portrait";
  const langIdx = Math.max(0, LANG_ORDER.indexOf(lang as (typeof LANG_ORDER)[number]));

  const L = (key: string, fallback: string): string => {
    if (key in PRINT_LABELS) {
      return PRINT_LABELS[key][langIdx] || fallback;
    }
    return t(lang as never, `lprint.${key}` as never, fallback);
  };

  const dr = L("dr", "Dr");
  const cr = L("cr", "Cr");

  // Positive balance sits on the account's normal side; negative is overdrawn
  const side = (bal: number) => ((bal >= 0) === (data.normalBalance === "debit") ? dr : cr);
  const balWithSide = (n: number) =>
    `${ltr(signedMoney(n))}<span class="dc-sr"> ${esc(side(n))}</span>`;
  const amtCell = (n: number | null | undefined) =>
    n && Math.abs(n) > 0.0001 ? ltr(money(n)) : `<span class="dash">-</span>`;

  const src = (s: LedgerPrintLine["source"]) =>
    s === "roznamcha_entries"
      ? L("src_roznamcha", "Roznamcha")
      : s === "ledger_posting_batches"
      ? L("src_journal", "Journal")
      : esc(s || "");

  const c = data.company || {};
  const a = data.account;
  const acctCurrency = (a.currency || "AED").toUpperCase();
  const isUsdAccount = acctCurrency === "USD";

  // ── 12-Column Definition for Landscape (Reference Image 1) & Portrait (Reference Image 2) ──
  type Col = { key: string; label: string; w: number; cls?: string };

  const landscapeCols: Col[] = [
    { key: "date", label: L("col_date", "Date"), w: 7.5, cls: "nw" },
    { key: "entryNo", label: L("col_entry_no", "Entry No."), w: 8.5, cls: "nw" },
    { key: "rznNo", label: L("col_rzn_no", "Rzn. No."), w: 6.0, cls: "nw" },
    { key: "rznName", label: L("col_rzn_name", "Rzn. Name"), w: 8.0 },
    { key: "details", label: L("col_details", "Details"), w: 20.5 },
    { key: "debit", label: L("col_dr", "DR"), w: 7.5, cls: "num" },
    { key: "credit", label: L("col_cr", "CR"), w: 7.5, cls: "num" },
    { key: "balance", label: L("col_balance", "Balance"), w: 8.0, cls: "num" },
    { key: "exRate", label: L("col_ex_rate", "Ex. Rate"), w: 6.0, cls: "num rate" },
    { key: "drUsd", label: L("col_dr_usd", "DR USD"), w: 6.5, cls: "num" },
    { key: "crUsd", label: L("col_cr_usd", "CR USD"), w: 6.5, cls: "num" },
    { key: "balUsd", label: L("col_bal_usd", "Balance USD"), w: 7.5, cls: "num" },
  ];

  const portraitCols: Col[] = [
    { key: "date", label: L("col_date", "Date"), w: 7.5, cls: "nw" },
    { key: "entryNo", label: L("col_entry_no", "Entry No."), w: 8.5, cls: "nw" },
    { key: "rznNo", label: L("col_rzn_no", "Rzn. No."), w: 6.0, cls: "nw" },
    { key: "rznName", label: L("col_rzn_name", "Rzn. Name"), w: 7.5 },
    { key: "details", label: L("col_details", "Details"), w: 20.5 },
    { key: "debit", label: L("col_dr", "DR"), w: 7.5, cls: "num" },
    { key: "credit", label: L("col_cr", "CR"), w: 7.5, cls: "num" },
    { key: "balance", label: L("col_balance", "Balance"), w: 8.0, cls: "num" },
    { key: "exRate", label: L("col_ex_rate_short", "Ex.Rate"), w: 5.5, cls: "num rate" },
    { key: "drUsd", label: L("col_dr_usd", "DR USD"), w: 7.0, cls: "num" },
    { key: "crUsd", label: L("col_cr_usd", "CR USD"), w: 7.0, cls: "num" },
    { key: "balUsd", label: L("col_bal_usd_short", "Bal. USD"), w: 7.5, cls: "num" },
  ];

  const cols = portrait ? portraitCols : landscapeCols;
  const span = cols.length;

  // ── Compute Per-Row USD Equivalent Values & Running USD Balance from Saved Rates Only ──
  const creditNormal = data.normalBalance === "credit";
  let runningUsd = 0;
  let hasAnyUsd = false;

  type ComputedLine = {
    raw: LedgerPrintLine;
    rateDisplay: string;
    drUsd: number | null;
    crUsd: number | null;
    balUsd: number | null;
  };

  const computedLines: ComputedLine[] = data.lines.map((l) => {
    const rate =
      typeof l.usdRate === "number" && Number.isFinite(l.usdRate) && l.usdRate > 0
        ? l.usdRate
        : isUsdAccount
        ? 1
        : null;

    let drUsd: number | null = null;
    if (l.debit > 0) {
      if (typeof l.usdAmount === "number" && Number.isFinite(l.usdAmount) && l.usdAmount > 0) {
        drUsd = Number(l.usdAmount.toFixed(2));
      } else if (isUsdAccount) {
        drUsd = Number(l.debit.toFixed(2));
      } else if (rate) {
        drUsd = Number((l.debit / rate).toFixed(2));
      }
    }

    let crUsd: number | null = null;
    if (l.credit > 0) {
      if (typeof l.usdAmount === "number" && Number.isFinite(l.usdAmount) && l.usdAmount > 0) {
        crUsd = Number(l.usdAmount.toFixed(2));
      } else if (isUsdAccount) {
        crUsd = Number(l.credit.toFixed(2));
      } else if (rate) {
        crUsd = Number((l.credit / rate).toFixed(2));
      }
    }

    let balUsd: number | null = null;
    if (drUsd !== null || crUsd !== null) {
      hasAnyUsd = true;
      const d = drUsd ?? 0;
      const cVal = crUsd ?? 0;
      runningUsd = Number((runningUsd + (creditNormal ? cVal - d : d - cVal)).toFixed(2));
      balUsd = runningUsd;
    } else if (hasAnyUsd && (l.debit > 0 || l.credit > 0)) {
      balUsd = runningUsd;
    }

    const rateDisplay = rate
      ? ltr(Number(rate).toFixed(2).replace(/\.00$/, ".00"))
      : `<span class="dash">-</span>`;

    return {
      raw: l,
      rateDisplay,
      drUsd,
      crUsd,
      balUsd,
    };
  });

  const foreign = (l: LedgerPrintLine) =>
    Boolean(l.currency && a.currency && l.currency.toUpperCase() !== a.currency.toUpperCase());

  const renderCell = (cl: ComputedLine, key: string): string => {
    const l = cl.raw;
    switch (key) {
      case "date":
        return formatRowDate(l.date, portrait);
      case "entryNo":
        return ltr(l.entryNo || l.serial || "—");
      case "rznNo":
        return ltr(l.rznNo || l.manualRef || "—");
      case "rznName":
        return esc(l.rznName || src(l.source) || "—");
      case "details": {
        const main = `<span class="desc">${esc(l.description || "—")}</span>`;
        const fxTag =
          foreign(l) && l.usdRate
            ? ` <span class="fx-meta">(${esc(l.currency)} @ ${ltr(l.usdRate)})</span>`
            : "";
        return main + fxTag;
      }
      case "debit":
        return amtCell(l.debit);
      case "credit":
        return amtCell(l.credit);
      case "balance":
        return l.debit === 0 && l.credit === 0 && Math.abs(l.balance) < 0.0001
          ? `<span class="dash">-</span>`
          : balWithSide(l.balance);
      case "exRate":
        return cl.rateDisplay;
      case "drUsd":
        return amtCell(cl.drUsd);
      case "crUsd":
        return amtCell(cl.crUsd);
      case "balUsd":
        return cl.balUsd !== null ? ltr(signedMoney(cl.balUsd)) : `<span class="dash">-</span>`;
      default:
        return "";
    }
  };

  const bodyRowsHtml = computedLines.length
    ? computedLines
        .map(
          (cl) =>
            `<tr>${cols.map((k) => `<td class="${k.cls ?? ""}">${renderCell(cl, k.key)}</td>`).join("")}</tr>`
        )
        .join("\n")
    : `<tr><td colspan="${span}" class="empty">${esc(L("no_entries", "No entries in this period."))}</td></tr>`;

  const stateCityJoined = [a.stateProvince, a.city].filter(Boolean).join(" / ") || "—";
  const branchCountryJoined = [a.branchCode, a.countryCode].filter(Boolean).join(" / ") || "—";
  const resolvedFinalAddress =
    a.finalAddress || a.address || [a.city, a.stateProvince, a.country].filter(Boolean).join(", ") || "—";

  // Estimate page count for screen preview footer
  const firstPageCap = portrait ? 27 : 12;
  const nextPageCap = portrait ? 36 : 20;
  const totalRows = computedLines.length;
  const estimatedPages =
    totalRows <= firstPageCap
      ? 1
      : 1 + Math.ceil((totalRows - firstPageCap) / nextPageCap);

  const pageWord = esc(L("page", "Page"));
  const ofWord = esc(L("of", "of"));
  const footRightCss = `"${pageWord} " counter(page) " ${ofWord} " counter(pages)`;
  const footLeftText = esc(c.name || "");

  const fontFamily = isRtl
    ? "'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif"
    : "'Inter', 'Segoe UI', Roboto, Arial, sans-serif";

  // ── SVG Icons for Landscape Top Header & 3 Cards ──
  const bankIconSvg = `<svg class="hdr-bank-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2L2 7v2h20V7L12 2zm-7 9v7H3v2h18v-2h-2v-7h-2v7h-4v-7h-2v7H7v-7H5zm-3 10h20v2H2v-2z"/></svg>`;
  const docIconSvg = `<svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`;
  const coinsIconSvg = `<svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>`;
  const infoIconSvg = `<svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  // ── Top Section HTML: Landscape (Reference Image 1) vs Portrait (Reference Image 2) ──
  const topSectionHtml = portrait
    ? `
  <!-- PORTRAIT A4 DESIGN (Reference Image 2) -->
  <section class="p-acct-card">
    <div class="p-card-title">${esc(L("account_details", "ACCOUNT DETAILS"))}</div>
    <div class="p-acct-code">${ltr(a.code || "—")}</div>
    <h1 class="p-acct-name">${esc(a.name || "—")}</h1>
    <div class="p-meta-grid">
      <div class="p-kv"><span class="k">${esc(L("customer_no", "Customer No."))}</span><span class="v">${ltr(a.customerNumber || "—")}</span></div>
      <div class="p-kv"><span class="k">${esc(L("account_type", "Account Type"))}</span><span class="v">${esc(a.kind || "—")}</span></div>
      <div class="p-kv"><span class="k">${esc(L("col_branch", "Branch"))}</span><span class="v">${esc(a.branchName || a.branch || "—")}</span></div>
      <div class="p-kv"><span class="k">${esc(L("currency", "Currency"))}</span><span class="v">${ltr(a.currency || "—")}</span></div>
      <div class="p-kv"><span class="k">${esc(L("country", "Country"))}</span><span class="v">${esc(a.country || "—")}</span></div>
      <div class="p-kv"><span class="k">${esc(L("category", "Category"))}</span><span class="v">${esc(a.category || a.kind || "—")}</span></div>
      <div class="p-kv"><span class="k">${esc(L("branch_country_lbl", "Branch / Country"))}</span><span class="v" data-state-city="${esc(stateCityJoined)}">${ltr(branchCountryJoined)}</span></div>
      <div class="p-kv"><span class="k">${esc(L("opened_lbl", "Opened"))}</span><span class="v">${formatDisplayDate(a.openedDate)}</span></div>
      <div class="p-kv"><span class="k">${esc(L("final_address", "Final Address"))}</span><span class="v">${esc(resolvedFinalAddress)}</span></div>
      <div class="p-kv"><span class="k">${esc(L("contact_lbl", "Contact"))}</span><span class="v">${ltr(a.phone || "—")}</span></div>
      <div class="p-kv"><span class="k">${esc(L("whatsapp", "WhatsApp"))}</span><span class="v">${ltr(a.whatsapp || "—")}</span></div>
      <div class="p-kv"><span class="k">${esc(L("email", "Email"))}</span><span class="v">${ltr(a.email || "—")}</span></div>
    </div>
  </section>

  <section class="p-summary-strip">
    <div class="p-summary-hdr">${esc(L("statement_summary", "STATEMENT SUMMARY"))} &nbsp;|&nbsp; ${esc(L("local_prefix", "LOCAL"))} ${ltr(a.currency || "AED")}</div>
    <div class="p-summary-grid">
      <div class="p-sum-item"><span class="k">${esc(L("debit_short", "Debit"))}</span><span class="v">${ltr(money(data.totalDebit))}</span></div>
      <div class="p-sum-item"><span class="k">${esc(L("credit_short", "Credit"))}</span><span class="v">${ltr(money(data.totalCredit))}</span></div>
      <div class="p-sum-item"><span class="k">${esc(L("col_balance", "Balance"))}</span><span class="v">${balWithSide(data.closingBalance)}</span></div>
      <div class="p-sum-item"><span class="k">${esc(L("start_lbl", "Start"))}</span><span class="v">${formatDisplayDate(data.fromDate)}</span></div>
      <div class="p-sum-item"><span class="k">${esc(L("last_lbl", "Last"))}</span><span class="v">${formatDisplayDate(data.toDate)}</span></div>
      <div class="p-sum-item"><span class="k">${esc(L("entries", "Entries"))}</span><span class="v">${ltr(computedLines.length)}</span></div>
    </div>
  </section>

  <div class="p-basis-note">${esc(L("portrait_basis_note", "Local figures use the customer currency; USD columns use saved per-entry rates."))}</div>
`
    : `
  <!-- LANDSCAPE A4 DESIGN (Reference Image 1) -->
  <header class="l-top-header">
    <div class="l-title-wrap">
      ${bankIconSvg}
      <span class="l-title-divider"></span>
      <h1>${esc(L("customer_general_ledger", "CUSTOMER GENERAL LEDGER"))}</h1>
    </div>
    <div class="l-subtitle-wrap">
      <span>${esc(L("admin_report", "ADMIN REPORT"))}</span>
      <span class="pipe">|</span>
      <span>${esc(L("bank_style_statement", "BANK-STYLE ACCOUNT STATEMENT"))}</span>
    </div>
  </header>

  <section class="l-panels-row">
    <!-- Panel 1: ACCOUNT DETAILS -->
    <div class="l-card">
      <div class="l-card-hdr">${docIconSvg}<span>${esc(L("account_details", "ACCOUNT DETAILS"))}</span></div>
      <div class="l-acct-grid">
        <div class="l-kv"><span class="k">${esc(L("account_code", "Account No."))}</span><span class="v">${ltr(a.code || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("category", "Category"))}</span><span class="v">${esc(a.category || a.kind || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("account_name_lbl", "Account Name"))}</span><span class="v">${esc(a.name || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("currency", "Currency"))}</span><span class="v">${ltr(a.currency || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("customer_no", "Customer No."))}</span><span class="v">${ltr(a.customerNumber || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("opened_date", "Opened Date"))}</span><span class="v">${formatDisplayDate(a.openedDate)}</span></div>
        <div class="l-kv"><span class="k">${esc(L("account_type", "Account Type"))}</span><span class="v">${esc(a.kind || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("state_city", "State / City"))}</span><span class="v">${esc(stateCityJoined)}</span></div>
        <div class="l-kv"><span class="k">${esc(L("branch_name", "Branch Name"))}</span><span class="v">${esc(a.branchName || a.branch || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("final_address", "Final Address"))}</span><span class="v">${esc(resolvedFinalAddress)}</span></div>
        <div class="l-kv"><span class="k">${esc(L("branch_code", "Branch Code"))}</span><span class="v">${ltr(a.branchCode || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("phone", "Phone"))}</span><span class="v">${ltr(a.phone || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("country", "Country"))}</span><span class="v">${esc(a.country || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("whatsapp", "WhatsApp"))}</span><span class="v">${ltr(a.whatsapp || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("country_code", "Country Code"))}</span><span class="v">${ltr(a.countryCode || "—")}</span></div>
        <div class="l-kv"><span class="k">${esc(L("email", "Email"))}</span><span class="v">${ltr(a.email || "—")}</span></div>
      </div>
    </div>

    <!-- Panel 2: STATEMENT SUMMARY -->
    <div class="l-card">
      <div class="l-card-hdr">${coinsIconSvg}<span>${esc(L("statement_summary", "STATEMENT SUMMARY"))}</span></div>
      <div class="l-sum-body">
        <div class="l-sum-row"><span class="k">${esc(L("total_debit", "Total Debit"))}</span><span class="v">${ltr(money(data.totalDebit))}</span></div>
        <div class="l-sum-row"><span class="k">${esc(L("total_credit", "Total Credit"))}</span><span class="v">${ltr(money(data.totalCredit))}</span></div>
        <div class="l-sum-row"><span class="k">${esc(L("grand_balance", "Grand Balance"))}</span><span class="v">${balWithSide(data.closingBalance)}</span></div>
        <div class="l-sum-row"><span class="k">${esc(L("starting_date", "Starting Date"))}</span><span class="v">${formatDisplayDate(data.fromDate)}</span></div>
        <div class="l-sum-row"><span class="k">${esc(L("last_date", "Last Date"))}</span><span class="v">${formatDisplayDate(data.toDate)}</span></div>
        <div class="l-sum-row last"><span class="k">${esc(L("total_entries", "Total Entries"))}</span><span class="v">${ltr(computedLines.length)}</span></div>
      </div>
    </div>

    <!-- Panel 3: REPORTING BASIS -->
    <div class="l-card">
      <div class="l-card-hdr">${infoIconSvg}<span>${esc(L("reporting_basis", "REPORTING BASIS"))}</span></div>
      <div class="l-basis-body">
        <p class="l-basis-text">${esc(L("reporting_basis_desc", "Each customer uses its own local currency. The final columns show the exchange rate and the equivalent amounts in USD, including USD Debit, USD Credit, and USD Balance."))}</p>
        <div class="l-basis-meta">
          <div class="l-basis-kv"><span class="bk">${esc(L("local_currency_lbl", "Local Currency"))}</span><span class="bv">${esc(L("local_currency_val", ": Per customer (e.g., AED, USD, EUR, etc.)"))}</span></div>
          <div class="l-basis-kv"><span class="bk">${esc(L("usd_equivalent_lbl", "USD Equivalent"))}</span><span class="bv">${esc(L("usd_equivalent_val", ": Ex. Rate, DR USD, CR USD, Balance USD"))}</span></div>
        </div>
      </div>
    </div>
  </section>
`;

  return `<!doctype html>
<html lang="${esc(lang)}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="erp-page-count" content="${estimatedPages}" />
<title>${esc(L("customer_general_ledger", "CUSTOMER GENERAL LEDGER"))} — ${esc(a.name)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700;800&display=swap');

  @page {
    size: A4 ${portrait ? "portrait" : "landscape"};
    margin: ${portrait ? "10mm 10mm 14mm 10mm" : "10mm 12mm 14mm 12mm"};
    @bottom-left {
      content: "${footLeftText}";
      border-top: 1px solid #cbd5e1;
      padding-top: 2mm;
      font: 500 7.5pt ${fontFamily};
      color: #64748b;
    }
    @bottom-center {
      content: "";
      border-top: 1px solid #cbd5e1;
      padding-top: 2mm;
    }
    @bottom-right {
      content: ${footRightCss};
      border-top: 1px solid #cbd5e1;
      padding-top: 2mm;
      font: 800 8.5pt ${fontFamily};
      color: #0f172a;
    }
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; }
  body {
    font-family: ${fontFamily};
    font-size: ${portrait ? "7.2pt" : "7.5pt"};
    line-height: ${isRtl ? 1.42 : 1.3};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  bdi { unicode-bidi: isolate; }

  .doc {
    width: 100%;
    max-width: ${portrait ? "190mm" : "273mm"};
    margin: 0 auto;
    padding: ${portrait ? "4mm 0 2mm" : "3mm 0 2mm"};
    display: flex;
    flex-direction: column;
    min-height: ${portrait ? "273mm" : "186mm"};
  }

  @media screen {
    .doc {
      height: 100%;
      overflow-y: auto;
      padding: ${portrait ? "8mm 9mm 6mm" : "8mm 11mm 6mm"};
      max-width: none;
    }
  }
  @media print {
    .no-print-toolbar { display: none !important; }
    .screen-footer { display: none !important; }
    .doc { padding: 0 !important; max-width: none !important; min-height: 0 !important; height: auto !important; overflow: visible !important; }
  }

  .no-print-toolbar {
    display: none;
  }

  /* ── LANDSCAPE A4 STYLES (Reference Image 1) ── */
  .l-top-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 2.8mm;
    margin-bottom: 3.8mm;
    border-bottom: 1.5px solid #475569;
  }
  .l-title-wrap {
    display: flex;
    align-items: center;
    gap: 3mm;
  }
  .hdr-bank-icon {
    width: 6.2mm;
    height: 6.2mm;
    color: #0f172a;
    flex-shrink: 0;
  }
  .l-title-divider {
    width: 1.8px;
    height: 5.8mm;
    background: #0f172a;
    display: inline-block;
  }
  .l-title-wrap h1 {
    margin: 0;
    font-size: 16.5pt;
    font-weight: 900;
    letter-spacing: 0.4px;
    color: #0f172a;
    text-transform: uppercase;
  }
  .l-subtitle-wrap {
    display: flex;
    align-items: center;
    gap: 2.5mm;
    font-size: 8.2pt;
    font-weight: 600;
    color: #1e293b;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }
  .l-subtitle-wrap .pipe {
    color: #475569;
    font-weight: 700;
  }

  .l-panels-row {
    display: grid;
    grid-template-columns: 46.5% 23.5% 28%;
    justify-content: space-between;
    gap: 1%;
    margin-bottom: 4.5mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .l-card {
    border: 1px solid #d5dde7;
    border-radius: 5.5px;
    background: #f8fafc;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .l-card-hdr {
    background: #dfe6ef;
    padding: 2mm 3.2mm;
    display: flex;
    align-items: center;
    gap: 2mm;
    font-size: 8.8pt;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    border-bottom: 1px solid #d5dde7;
  }
  .card-icon {
    width: 4mm;
    height: 4mm;
    color: #0f172a;
    flex-shrink: 0;
  }
  .l-acct-grid {
    padding: 2.5mm 3.2mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 4mm;
    row-gap: 1.15mm;
    font-size: 7.2pt;
  }
  .l-kv {
    display: grid;
    grid-template-columns: 23mm 1fr;
    align-items: baseline;
    gap: 1.5mm;
  }
  .l-kv .k {
    color: #334155;
    font-weight: 500;
    white-space: nowrap;
  }
  .l-kv .v {
    color: #0f172a;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .l-sum-body {
    padding: 1.8mm 3.2mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex: 1;
  }
  .l-sum-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 1.25mm 0;
    border-bottom: 1px solid #e2e8f0;
    font-size: 7.5pt;
  }
  .l-sum-row.last {
    border-bottom: 0;
  }
  .l-sum-row .k {
    color: #334155;
    font-weight: 500;
  }
  .l-sum-row .v {
    color: #0f172a;
    font-weight: 800;
    font-size: 8pt;
    font-variant-numeric: tabular-nums;
  }

  .l-basis-body {
    padding: 2.5mm 3.2mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex: 1;
  }
  .l-basis-text {
    margin: 0;
    font-size: 7.3pt;
    color: #1e293b;
    line-height: 1.42;
  }
  .l-basis-meta {
    border-top: 1px solid #cbd5e1;
    padding-top: 2.2mm;
    margin-top: 2.5mm;
    display: flex;
    flex-direction: column;
    gap: 1.3mm;
    font-size: 6.7pt;
  }
  .l-basis-kv {
    display: grid;
    grid-template-columns: 22mm 1fr;
    align-items: baseline;
  }
  .l-basis-kv .bk {
    font-weight: 700;
    color: #0f172a;
    white-space: nowrap;
  }
  .l-basis-kv .bv {
    color: #334155;
    font-weight: 500;
  }

  /* ── PORTRAIT A4 STYLES (Reference Image 2) ── */
  .p-acct-card {
    border: 1px solid #d8e2ec;
    border-radius: 7px;
    background: #ffffff;
    padding: 3.5mm 4.5mm;
    margin-bottom: 2.6mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .p-card-title {
    font-size: 8pt;
    font-weight: 800;
    color: #1e293b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 1mm;
  }
  .p-acct-code {
    font-size: 8.2pt;
    font-weight: 700;
    color: #475569;
    margin-bottom: 0.4mm;
  }
  .p-acct-name {
    margin: 0 0 2.6mm 0;
    font-size: 13.5pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.2;
  }
  .p-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 8mm;
    row-gap: 1.2mm;
    font-size: 7.2pt;
  }
  .p-kv {
    display: grid;
    grid-template-columns: 27mm 1fr;
    align-items: baseline;
    gap: 2mm;
  }
  .p-kv .k {
    color: #64748b;
    font-weight: 500;
    white-space: nowrap;
  }
  .p-kv .v {
    color: #0f172a;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .p-summary-strip {
    background: #eef4f8;
    border: 1px solid #d5e2ec;
    border-radius: 6px;
    padding: 2.4mm 4.5mm;
    margin-bottom: 1.6mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .p-summary-hdr {
    font-size: 7.6pt;
    font-weight: 800;
    color: #1e293b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 1.6mm;
  }
  .p-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    column-gap: 6mm;
    row-gap: 1.2mm;
    font-size: 7.4pt;
  }
  .p-sum-item {
    display: grid;
    grid-template-columns: 16mm 1fr;
    align-items: baseline;
    gap: 2mm;
  }
  .p-sum-item .k {
    color: #64748b;
    font-weight: 500;
  }
  .p-sum-item .v {
    color: #0f172a;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .p-basis-note {
    font-size: 6.8pt;
    color: #64748b;
    margin: 1mm 0 2mm;
  }

  .filter-note {
    font-size: 7pt;
    color: #475569;
    margin-bottom: 2mm;
    font-weight: 600;
  }

  /* ── SHARED 12-COLUMN LEDGER TABLE ── */
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1px solid #d5dde7;
  }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }

  thead tr.cols th {
    background: ${portrait ? "#e3edf5" : "#dfe6ef"};
    color: #0f172a;
    font-weight: 800;
    font-size: ${portrait ? "6.6pt" : "7.5pt"};
    padding: ${portrait ? "1.6mm 1.1mm" : "2mm 1.8mm"};
    text-align: start;
    border-top: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    vertical-align: middle;
    white-space: nowrap;
  }
  thead tr.cols th.num {
    text-align: end;
  }

  tbody td {
    padding: ${portrait ? "1.58mm 1.1mm" : "1.8mm 1.8mm"};
    border-bottom: 1px solid #e2e8f0;
    vertical-align: middle;
    overflow-wrap: break-word;
    word-break: normal;
    font-size: ${portrait ? "6.5pt" : "7.4pt"};
    color: #0f172a;
  }
  tbody tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  tbody tr:nth-child(odd) td {
    background: #ffffff;
  }
  tbody tr:nth-child(even) td {
    background: #f4f7fa;
  }
  td.num {
    text-align: end;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
    font-weight: 500;
  }
  td.nw {
    white-space: nowrap;
  }
  td .desc {
    color: #0f172a;
  }
  td .fx-meta {
    color: #64748b;
    font-size: 6pt;
  }
  td .dash {
    color: #475569;
    font-weight: 500;
  }
  .dc-sr {
    display: none;
  }
  td.empty {
    text-align: center;
    color: #64748b;
    padding: 6mm;
  }

  /* ── Bottom Footer Bar (Screen Preview & Multi-Page Indicator) ── */
  .screen-footer {
    margin-top: auto;
    padding-top: 2.2mm;
    border-top: 1.2px solid #94a3b8;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8pt;
  }
  .screen-footer .sf-left {
    color: #64748b;
    font-weight: 500;
    font-size: 7pt;
  }
  .screen-footer .sf-right {
    color: #0f172a;
    font-weight: 800;
    font-size: 8.5pt;
  }
</style>
</head>
<body>
<div class="doc" data-layout="${portrait ? "portrait" : "landscape"}">
  <div class="no-print-toolbar"><button type="button" onclick="window.print()">${esc(L("print", "Print"))}</button></div>

  ${topSectionHtml}

  ${data.filterNote ? `<div class="filter-note">${esc(data.filterNote)}</div>` : ""}

  <!-- 12-Column Ledger Transaction Table -->
  <table class="data-table">
    <colgroup>
      ${cols.map((k) => `<col style="width:${k.w}%" />`).join("")}
    </colgroup>
    <thead>
      <tr class="cols">
        ${cols.map((k) => `<th class="${k.cls ?? ""}">${esc(k.label)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${bodyRowsHtml}
    </tbody>
  </table>

  <footer class="screen-footer">
    <span class="sf-left">${footLeftText}</span>
    <span class="sf-right"><bdi dir="ltr">${esc(pageWord)} 1 ${esc(ofWord)} ${estimatedPages}</bdi></span>
  </footer>
</div>
</body>
</html>`;
}

/**
 * Opens the Customer General Ledger Statement in the centered PDF/Print Preview Modal.
 * Switching Portrait / Landscape or Language inside the preview modal rebuilds the exact layout from source.
 */
export function openLedgerStatementPrint(
  data: LedgerPrintData,
  opts: { lang: string; orientation: LedgerPrintOrientation }
): void {
  if (typeof window === "undefined") return;
  const title = `${t(opts.lang as never, "lprint.title" as never, "Customer General Ledger")} — ${data.account.name}`;
  const html = buildLedgerStatementPrintHtml(data, opts);
  try {
    printStore.openPrint(html, title, {
      lang: opts.lang,
      rebuild: ({ lang, orientation }) => buildLedgerStatementPrintHtml(data, { lang, orientation }),
    });
  } catch {
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  }
}
