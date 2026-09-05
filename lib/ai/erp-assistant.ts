import type { ErpSession } from "@/lib/auth/session";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { fetchFinancialStatementRows, classifyProfitAndLoss, classifyBalanceSheet, classifyCashPosition } from "@/lib/reports/financial-statement-data";
import { computeBusinessSummary } from "@/lib/reports/business-summary-data";
import { aiTranslatorConfigured } from "@/lib/i18n/ai-translation-client";

/**
 * AI Business Assistant — CLAUDE.md Master Requirement Section B.
 *
 * Permission-aware natural-language query over REAL ERP data only. Every
 * data path here is one of the existing, already-scoped report engines —
 * get_financial_statement_ledgers (via lib/reports/financial-statement-data.ts,
 * shared with the P&L/Balance-Sheet/Cash-Flow routes) and
 * computeBusinessSummary (shared with app/api/erp/reports/business-summary).
 * There is no separate query path into the database and no free-form SQL —
 * the assistant can only ever see what those two already-audited, RBAC-
 * scoped functions return for the caller's own session.
 *
 * HARD CONSTRAINT (per CLAUDE.md Section B): this module MUST NOT create,
 * modify, delete or post any Purchase/Sales/Ledger/Journal/Roznamcha/Cash
 * Entry/Expense/Payment/accounting transaction. It is read-only end to end —
 * classifyIntent() detects write-style verbs FIRST and short-circuits to a
 * fixed refusal before any data is even fetched, and no code path below
 * ever calls a POST/PATCH/DELETE handler or a posting function.
 *
 * Works with zero external AI configuration: the deterministic template
 * layer below always answers using only the real scoped figures. If
 * AI_TRANSLATE_PROVIDER/AI_TRANSLATE_API_KEY are configured (the same
 * provider-agnostic credential already used by the i18n AI translation
 * tier — lib/i18n/ai-translation-client.ts), the numbers are optionally
 * rephrased more conversationally; the AI is never the source of a number,
 * only of wording, and a light guard rejects any rephrase that drops a
 * figure the deterministic answer contained.
 */

export type AssistantIntent =
  | "write_refused"
  | "profit_loss"
  | "balance_sheet"
  | "cash_flow"
  | "business_summary"
  | "help";

const WRITE_VERBS: Record<SupportedLanguage, string[]> = {
  en: ["create", "add ", "delete", "remove", "post ", "pay ", "approve", "void", "cancel", "edit", "update", "modify", "transfer", "reverse", "record a", "enter a", "make a payment", "issue "],
  ur: ["بنائیں", "شامل کریں", "حذف", "مٹا", "پوسٹ کریں", "ادائیگی کریں", "منظور", "منسوخ", "ترمیم", "اپ ڈیٹ"],
  ar: ["أنشئ", "إنشاء", "أضف", "احذف", "حذف", "رحّل", "ترحيل", "ادفع", "دفع", "اعتمد", "إلغاء", "عدّل", "تحديث"],
  fa: ["ایجاد", "اضافه", "حذف", "ثبت کن", "پرداخت کن", "تایید", "لغو", "ویرایش", "به‌روزرسانی"],
  ps: ["جوړول", "زیاتول", "له منځه وړل", "پوسټ کړئ", "تادیه وکړئ", "منظوري", "لغوه", "سمول", "اپډیټ"]
};

const INTENT_KEYWORDS: Record<Exclude<AssistantIntent, "write_refused" | "help">, Record<SupportedLanguage, string[]>> = {
  profit_loss: {
    en: ["profit", "loss", "income statement", "net income", "earnings", "revenue"],
    ur: ["منافع", "نقصان", "آمدنی"],
    ar: ["ربح", "أرباح", "خسارة", "الدخل", "الإيرادات"],
    fa: ["سود", "زیان", "درآمد"],
    ps: ["ګټه", "زیان", "عاید"]
  },
  balance_sheet: {
    en: ["balance sheet", "assets", "liabilities", "equity", "net worth"],
    ur: ["بیلنس شیٹ", "اثاثے", "واجبات", "ایکویٹی"],
    ar: ["الميزانية", "الأصول", "الخصوم", "حقوق الملكية"],
    fa: ["ترازنامه", "دارایی", "بدهی", "حقوق صاحبان سهام"],
    ps: ["بیلانس", "شتمنۍ", "پورونه", "پانګه"]
  },
  cash_flow: {
    en: ["cash", "bank balance", "cash flow", "liquidity"],
    ur: ["کیش", "بینک بیلنس", "نقد"],
    ar: ["نقد", "السيولة", "رصيد البنك", "التدفق النقدي"],
    fa: ["نقد", "موجودی بانک", "جریان نقدی"],
    ps: ["نغد", "بانکي بیلانس"]
  },
  business_summary: {
    en: ["purchase", "sales", "outstanding", "receivable", "payable", "customer balance", "stock", "inventory", "summary", "overview", "business"],
    ur: ["خریداری", "فروخت", "بقایا", "وصولی", "ادائیگی", "کسٹمر بیلنس", "اسٹاک", "خلاصہ"],
    ar: ["مشتريات", "مبيعات", "مستحق", "ذمم", "رصيد العميل", "المخزون", "ملخص"],
    fa: ["خرید", "فروش", "معوقه", "مطالبات", "موجودی کالا", "خلاصه"],
    ps: ["پیرودنه", "پلور", "پاتې", "ذخیره", "لنډیز"]
  }
};

function normalize(s: string) {
  return (s || "").toLowerCase();
}

export function classifyIntent(question: string, lang: SupportedLanguage): AssistantIntent {
  const q = normalize(question);
  if (!q.trim()) return "help";

  for (const langKey of Object.keys(WRITE_VERBS) as SupportedLanguage[]) {
    if (WRITE_VERBS[langKey].some((v) => q.includes(normalize(v)))) return "write_refused";
  }

  const scored: { intent: AssistantIntent; score: number }[] = [];
  (Object.keys(INTENT_KEYWORDS) as (keyof typeof INTENT_KEYWORDS)[]).forEach((intent) => {
    let score = 0;
    for (const langKey of Object.keys(INTENT_KEYWORDS[intent]) as SupportedLanguage[]) {
      for (const kw of INTENT_KEYWORDS[intent][langKey]) {
        if (q.includes(normalize(kw))) score += langKey === lang ? 2 : 1;
      }
    }
    if (score > 0) scored.push({ intent, score });
  });

  if (scored.length === 0) return "help";
  scored.sort((a, b) => b.score - a.score);
  return scored[0].intent;
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
  // Most restrictive fallback -- matches nothing rather than leaking data.
  return { scope: "city_branch", countryId: null, countryBranchId: null, cityBranchId: null };
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

export type AssistantAnswer = {
  intent: AssistantIntent;
  answer: string;
  scopeLabel: string;
  data: unknown;
};

export async function runErpAssistantQuery(
  session: ErpSession,
  supabase: any,
  opts: { question: string; lang: SupportedLanguage; fromDate?: string | null; toDate?: string | null; asOfDate?: string | null }
): Promise<AssistantAnswer> {
  const lang = opts.lang;
  const intent = classifyIntent(opts.question, lang);
  const ledgerScope = resolveLedgerScopeForSession(session);
  const scopeLabelMap: Record<string, string> = {
    super_admin: t(lang, "finstmt.scope_label" as never, "Scope") + ": Global",
    country: t(lang, "finstmt.scope_label" as never, "Scope") + ": Country",
    main_branch: t(lang, "finstmt.scope_label" as never, "Scope") + ": Main Branch",
    city_branch: t(lang, "finstmt.scope_label" as never, "Scope") + ": Branch"
  };
  const scopeLabel = scopeLabelMap[ledgerScope.scope] || ledgerScope.scope;

  if (intent === "write_refused") {
    return { intent, answer: t(lang, "aiassist.write_refused" as never, "I'm read-only and can't create, edit, delete, post, pay, approve or void anything. Please do that from the relevant ERP screen."), scopeLabel, data: null };
  }

  if (intent === "help") {
    return { intent, answer: t(lang, "aiassist.help" as never, "I can answer about Profit & Loss, Balance Sheet, Cash & Bank position, and the overall Purchase/Sales/Outstanding/Stock summary for your scope."), scopeLabel, data: null };
  }

  const fromDate = opts.fromDate || yearStartIso();
  const toDate = opts.toDate || todayIso();
  const asOfDate = opts.asOfDate || toDate;

  if (intent === "profit_loss") {
    const rows = await fetchFinancialStatementRows(supabase, { scope: ledgerScope.scope, countryId: ledgerScope.countryId, countryBranchId: ledgerScope.countryBranchId, cityBranchId: ledgerScope.cityBranchId, fromDate, toDate });
    const { income, expense, totals } = classifyProfitAndLoss(rows);
    const answer = interpolate(t(lang, "aiassist.ans_profit_loss" as never, "For {from} to {to} ({scope}): Total Income {income}, Total Expense {expense}, Net Profit/(Loss) {net}."), {
      from: fromDate, to: toDate, scope: scopeLabel, income: fmt(totals.totalIncome), expense: fmt(totals.totalExpense), net: fmt(totals.netProfit)
    });
    return { intent, answer, scopeLabel, data: { fromDate, toDate, income, expense, totals } };
  }

  if (intent === "balance_sheet") {
    const rows = await fetchFinancialStatementRows(supabase, { scope: ledgerScope.scope, countryId: ledgerScope.countryId, countryBranchId: ledgerScope.countryBranchId, cityBranchId: ledgerScope.cityBranchId, fromDate: "1970-01-01", toDate: asOfDate });
    const { assets, liabilities, equity, totals } = classifyBalanceSheet(rows);
    let answer = interpolate(t(lang, "aiassist.ans_balance_sheet" as never, "As of {date} ({scope}): Total Assets {assets}, Total Liabilities {liabilities}, Total Equity {equity}."), {
      date: asOfDate, scope: scopeLabel, assets: fmt(totals.totalAssets), liabilities: fmt(totals.totalLiabilities), equity: fmt(totals.totalEquity)
    });
    if (Math.abs(totals.difference) > 0.01) {
      answer += " " + interpolate(t(lang, "finstmt.bs_out_of_balance" as never, "Assets do not equal Liabilities + Equity for this scope (difference: {amount})."), { amount: fmt(totals.difference) });
    }
    return { intent, answer, scopeLabel, data: { asOfDate, assets, liabilities, equity, totals } };
  }

  if (intent === "cash_flow") {
    const rows = await fetchFinancialStatementRows(supabase, { scope: ledgerScope.scope, countryId: ledgerScope.countryId, countryBranchId: ledgerScope.countryBranchId, cityBranchId: ledgerScope.cityBranchId, fromDate, toDate });
    const { bankAccounts, cashAccounts, totals } = await classifyCashPosition(rows);
    const answer = interpolate(t(lang, "aiassist.ans_cash_flow" as never, "For {from} to {to} ({scope}): Opening {opening}, Closing {closing}, Net Movement {net}."), {
      from: fromDate, to: toDate, scope: scopeLabel, opening: fmt(totals.openingBalance), closing: fmt(totals.closingBalance), net: fmt(totals.netMovement)
    });
    return { intent, answer, scopeLabel, data: { fromDate, toDate, bankAccounts, cashAccounts, totals } };
  }

  // business_summary
  const summary = await computeBusinessSummary(session, { countryId: ledgerScope.countryId, branchId: ledgerScope.cityBranchId });
  const answer = interpolate(t(lang, "aiassist.ans_business_summary" as never, "For {scope}: Purchases {purchase} (outstanding {purchaseOut}), Sales {sales} (outstanding {salesOut}), Expenses {expenses}, Estimated Gross Profit {grossProfit}, Stock Value {stock}, Customer Balances {customerBalance}."), {
    scope: scopeLabel,
    purchase: fmt(summary.purchase.total), purchaseOut: fmt(summary.purchase.outstanding),
    sales: fmt(summary.sales.total), salesOut: fmt(summary.sales.outstanding),
    expenses: fmt(summary.expenses.total), grossProfit: fmt(summary.profit.grossEstimate),
    stock: fmt(summary.stock.valueTotal), customerBalance: fmt(summary.customerBalances.total)
  });
  return { intent, answer, scopeLabel, data: summary };
}

/** Whether the optional AI-rephrasing layer is available. Never gates the deterministic answer above. */
export function aiAssistantEnhancementAvailable() {
  return aiTranslatorConfigured();
}
