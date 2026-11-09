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
import { normalizeTemplateColor, templateColors } from "@/lib/ui/template-colors";
import { DEFAULT_TEMPLATE_FLAGS, type InvoiceTemplateFlags, type InvoiceTemplateId } from "./types";

/** Invoice accent follows the user's ERP color preference; printed company and goods headers stay black. */
function themedInvoiceHtml(html: string): string {
  if (typeof window === "undefined") return html;
  const selected = normalizeTemplateColor(window.localStorage.getItem("erp_color"));
  const accent = templateColors.find((item) => item.id === selected)?.hex || "#5B21B6";
  const css = `<style data-erp-invoice-theme>
    :root { --erp-invoice-accent: ${accent}; }
    .brand-name, .company-name, .company-title { color: #111827 !important; }
    table.goods thead th, table.goods th, .goods-table thead th { background: #111827 !important; color: #ffffff !important; }
    .accent-bar { background: var(--erp-invoice-accent) !important; }
    .doc-title h1, .info-title { color: var(--erp-invoice-accent) !important; }
    @media print { table.goods thead th, table.goods th, .goods-table thead th { background: #111827 !important; color: #ffffff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>`;
  return html.includes("</head>") ? html.replace("</head>", css + "</head>") : css + html;
}

export function openInvoiceDocument(
  input: TradeDocumentInput,
  templateId: InvoiceTemplateId | string,
  flags: InvoiceTemplateFlags = DEFAULT_TEMPLATE_FLAGS,
): void {
  if (typeof window === "undefined") return;
  const tpl = getInvoiceTemplate(templateId);
  const [titleKey, titleFb] = docTitleKeyFor(input);
  const title = t((input.lang || "en") as SupportedLanguage, titleKey as never, titleFb);
  printStore.openPrint(themedInvoiceHtml(tpl.render(input, flags)), `${title} — ${input.docNo}`, {
    lang: input.lang || "en",
    // in-preview language / orientation switch rebuilds from the same source input + template
    rebuild: ({ lang, orientation }) =>
      themedInvoiceHtml(tpl.render({ ...input, lang: lang as SupportedLanguage, orientation }, flags)),
  });
}
