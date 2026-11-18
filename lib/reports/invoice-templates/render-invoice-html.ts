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
  // The Damaan layout is the one design for every purchase and sales invoice (local sales included). The older
  // UAE tax builder is used only when another template is chosen explicitly.
  const html =
    input.layout === "uae_tax" && templateId !== "tax_invoice" && (input.docType === "sales_invoice" || input.docType === "tax_invoice")
      ? buildUaeTaxInvoiceHtml(input)
      : tpl.render(input, flags);
  return withGroupWatermark(stretchGoodsTable(themeInvoiceHtml(html, colorId), input.orientation === "landscape"));
}

/**
 * Every invoice template: the goods table grows down the page, so the totals and the bank block sit at the bottom
 * of the A4 sheet instead of leaving a gap under a short table. The sales tax layout already does this and is skipped.
 */
export function stretchGoodsTable(html: string, landscape = false): string {
  if (html.includes("grp-goods-fill") || html.includes("goods-wrap")) return html;
  const start = html.search(/<table[^>]*class="goods"/i);
  if (start < 0) return html;
  const end = html.indexOf("</table>", start);
  if (end < 0) return html;
  const wrapped = html.slice(0, start) + `<div class="grp-goods-fill">` + html.slice(start, end + 8) + `</div>` + html.slice(end + 8);
  // A fixed A4 sheet height (usable area) gives the goods area a definite height; content that is longer
  // still shows (overflow is visible), so no line is ever cut off.
  const sheet = landscape ? "190mm" : "277mm";
  // The chain from the sheet down to the goods table is made a flex column, so the table can take the leftover height.
  const css = `<style data-erp-invoice-fill>
    .page { height: ${sheet}; display: flex; flex-direction: column; box-sizing: border-box; }
    .page > *:has(.grp-goods-fill) { flex: 1 1 auto; min-height: 0; }
    *:has(> .grp-goods-fill) { display: flex !important; flex-direction: column; min-height: 0; }
    .grp-goods-fill { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
    .grp-goods-fill > table.goods { flex: 1 1 auto; height: 100%; }
  </style>`;
  return wrapped.includes("</head>") ? wrapped.replace("</head>", css + "</head>") : css + wrapped;
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
