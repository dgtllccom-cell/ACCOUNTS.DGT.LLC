/**
 * Client-side opener for the template-aware invoice engine. Mirrors
 * `lib/reports/trade-documents/open-trade-document.ts` but renders through
 * the SELECTED template instead of the single fixed layout, and feeds the
 * SAME `printStore` — there is still only one print/PDF/Email/WhatsApp
 * delivery pipe in the app.
 *
 * Each opened invoice also gets a public link (saved snapshot + random token,
 * see /api/erp/public-document-links and /public/invoice/[token]); the QR code
 * on the document encodes that link.
 */

import { t } from "@/lib/i18n/ui";
import { printStore } from "@/lib/store/print-store";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { docTitleKeyFor } from "@/lib/reports/trade-documents/build-trade-document";
import type { TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import { DEFAULT_TEMPLATE_FLAGS, type InvoiceTemplateFlags, type InvoiceTemplateId } from "./types";
import { renderInvoiceHtml } from "./render-invoice-html";
import { normalizeTemplateColor } from "@/lib/ui/template-colors";

/** Save a snapshot of this document and return its public link, or null if it could not be saved. */
async function createPublicInvoiceLink(
  input: TradeDocumentInput,
  templateId: string,
  flags: InvoiceTemplateFlags,
  colorId: string,
): Promise<string | null> {
  try {
    const { publicUrl: _ignored, ...snapshot } = input;
    const res = await fetch("/api/erp/public-document-links", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot, templateId, flags, colorId, docNo: input.docNo }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const url = json?.data?.url;
    return typeof url === "string" && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

export async function openInvoiceDocument(
  input: TradeDocumentInput,
  templateId: InvoiceTemplateId | string,
  flags: InvoiceTemplateFlags = DEFAULT_TEMPLATE_FLAGS,
): Promise<void> {
  if (typeof window === "undefined") return;
  const colorId = normalizeTemplateColor(window.localStorage.getItem("erp_color"));
  const [titleKey, titleFb] = docTitleKeyFor(input);
  const title = t((input.lang || "en") as SupportedLanguage, titleKey as never, titleFb);
  const publicUrl = await createPublicInvoiceLink(input, String(templateId), flags, colorId);
  const linked: TradeDocumentInput = { ...input, publicUrl };
  printStore.openPrint(renderInvoiceHtml(linked, String(templateId), flags, colorId), `${title} — ${input.docNo}`, {
    lang: input.lang || "en",
    // in-preview language / orientation switch rebuilds from the same source input + template
    rebuild: ({ lang, orientation }) =>
      renderInvoiceHtml({ ...linked, lang: lang as SupportedLanguage, orientation }, String(templateId), flags, colorId),
  });
}
