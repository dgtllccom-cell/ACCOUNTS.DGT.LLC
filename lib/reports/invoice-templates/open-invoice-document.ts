/**
 * Client-side opener for the template-aware invoice engine. Mirrors
 * `lib/reports/trade-documents/open-trade-document.ts` but renders through
 * the SELECTED template instead of the single fixed layout, and feeds the
 * SAME `printStore` — there is still only one print/PDF/Email/WhatsApp
 * delivery pipe in the app.
 */

import { t } from "@/lib/i18n/ui";
import { printStore } from "@/lib/store/print-store";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { docTitleKeyFor } from "@/lib/reports/trade-documents/build-trade-document";
import type { TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import { getInvoiceTemplate } from "./registry";
import { DEFAULT_TEMPLATE_FLAGS, type InvoiceTemplateFlags, type InvoiceTemplateId } from "./types";

export function openInvoiceDocument(
  input: TradeDocumentInput,
  templateId: InvoiceTemplateId | string,
  flags: InvoiceTemplateFlags = DEFAULT_TEMPLATE_FLAGS,
): void {
  if (typeof window === "undefined") return;
  const tpl = getInvoiceTemplate(templateId);
  const [titleKey, titleFb] = docTitleKeyFor(input);
  const title = t((input.lang || "en") as SupportedLanguage, titleKey as never, titleFb);
  printStore.openPrint(tpl.render(input, flags), `${title} — ${input.docNo}`, {
    lang: input.lang || "en",
    // in-preview language / orientation switch rebuilds from the same source input + template
    rebuild: ({ lang, orientation }) =>
      tpl.render({ ...input, lang: lang as SupportedLanguage, orientation }, flags),
  });
}
