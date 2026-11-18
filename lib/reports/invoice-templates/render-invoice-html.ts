/**
 * Server-safe invoice HTML renderer. Used by the in-app print opener AND by the
 * public invoice page (/public/invoice/[token]) so both show the same document.
 * No `window` or browser APIs in this file.
 */

import type { TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import { buildUaeTaxInvoiceHtml } from "@/lib/reports/trade-documents/uae-tax-invoice";
import { getInvoiceTemplate } from "./registry";
import { DEFAULT_TEMPLATE_FLAGS, type InvoiceTemplateFlags } from "./types";
import { normalizeTemplateColor, templateColors } from "@/lib/ui/template-colors";

/**
 * Invoice accent follows the saved ERP color; printed company names and goods
 * table headers stay black.
 */
export function themeInvoiceHtml(html: string, colorId: string | null | undefined): string {
  const selected = normalizeTemplateColor(colorId);
  const accent = templateColors.find((item) => item.id === selected)?.hex || "#5B21B6";
  const css = `<style data-erp-invoice-theme>
    :root { --erp-invoice-accent: ${accent}; }
    .brand-name, .company-name, .company-title { color: #111827 !important; }
    table.goods thead th, table.goods th, .goods-table thead th, table.items th { background: #111827 !important; color: #ffffff !important; }
    .accent-bar { background: var(--erp-invoice-accent) !important; }
    .doc-title h1, .info-title { color: var(--erp-invoice-accent) !important; }
    .summary .grand { background: var(--erp-invoice-accent) !important; }
    .pcard { border-inline-start-color: var(--erp-invoice-accent) !important; }
    .info-title { color: var(--erp-invoice-accent) !important; }
    table.goods tfoot td { border-top-color: var(--erp-invoice-accent) !important; }
    @media print { table.goods thead th, table.goods th, .goods-table thead th, table.items th { background: #111827 !important; color: #ffffff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>`;
  return html.includes("</head>") ? html.replace("</head>", css + "</head>") : css + html;
}

/** Render one invoice document (template + theme) to a full HTML page. */
export function renderInvoiceHtml(
  input: TradeDocumentInput,
  templateId: string,
  flags: InvoiceTemplateFlags = DEFAULT_TEMPLATE_FLAGS,
  colorId?: string | null,
): string {
  const tpl = getInvoiceTemplate(templateId);
  // A local sale's sales / tax invoice uses the local tax layout (proforma-style VAT table).
  const html =
    input.layout === "uae_tax" && (input.docType === "sales_invoice" || input.docType === "tax_invoice")
      ? buildUaeTaxInvoiceHtml(input)
      : tpl.render(input, flags);
  return withGroupWatermark(themeInvoiceHtml(html, colorId));
}

/**
 * The Damaan group logo as a large, faded background in the centre of every invoice template (the same on
 * every page, in every country). A template that already draws it (the Sales Tax Invoice) is left as it is.
 */
export function withGroupWatermark(html: string): string {
  if (html.includes('class="watermark"') || html.includes("grp-watermark")) return html;
  const css = `<style data-erp-invoice-watermark>
    .grp-watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 120mm; max-width: 80vw; opacity: .08; pointer-events: none; z-index: 0; }
  </style>`;
  const img = `<img class="grp-watermark" src="/images/damaan-logo.png" alt="" aria-hidden="true" />`;
  const withCss = html.includes("</head>") ? html.replace("</head>", css + "</head>") : css + html;
  return withCss.replace(/<body([^>]*)>/i, (m) => `${m}${img}`);
}
