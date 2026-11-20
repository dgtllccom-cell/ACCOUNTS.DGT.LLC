/**
 * Opens an Office / Other Expenses Bill as the owner's proforma sample, through the same print/preview pipe every other
 * document uses (printStore). The branding scope is the bill's own branch, so the company name at the top is that
 * branch's company, and the bank block is that branch's bank.
 */
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { printStore } from "@/lib/store/print-store";
import { t } from "@/lib/i18n/ui";
import { resolveDocumentBranding, type BrandingScope } from "@/lib/reports/resolve-document-branding";
import { expensesBillToTradeInput, type ExpenseBillLike } from "./to-trade-document";
import { expensesBillTitle, renderExpensesProformaHtml } from "./render-proforma-html";

export async function buildExpensesBillHtml(
  bill: ExpenseBillLike,
  lang: SupportedLanguage,
  scope: BrandingScope = {},
): Promise<{ html: string; title: string }> {
  const branding = await resolveDocumentBranding(scope, lang);
  const input = expensesBillToTradeInput(bill, { lang, branding });
  const name = expensesBillTitle(bill.bill_title) || t(lang, "expbill.title", "Expenses Bill");
  return { html: renderExpensesProformaHtml(input, { title: name }), title: `${name} — ${input.docNo}` };
}

export async function openExpensesBillDocument(
  bill: ExpenseBillLike,
  lang: SupportedLanguage,
  scope: BrandingScope = {},
): Promise<void> {
  if (typeof window === "undefined") return;
  const { html, title } = await buildExpensesBillHtml(bill, lang, scope);
  printStore.openPrint(html, title, { lang });
}
