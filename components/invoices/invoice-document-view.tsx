"use client";

/**
 * View a Purchase Booking / Sales Booking / Local Purchase record as its COMPLETE invoice — the same Damaan document the
 * Commercial Document Center prints (company header and TRN, parties, shipping / loading / receiving, goods with HS code,
 * rate, taxable value, VAT, totals, amount in words, bank details, terms, signatory) — full screen, as one A4 page.
 *
 * Read-only: it maps the saved record with the existing mappers (lib/reports/trade-documents/from-transaction.ts) and
 * renders it with the existing template engine (renderInvoiceHtml). Nothing is saved while viewing; Print uses the
 * normal invoice pipeline (openInvoiceDocument), exactly as the Document Center does.
 */

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { A4DocumentViewer } from "@/components/ui/a4-document-viewer";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { resolveDocumentBranding, type BrandingScope } from "@/lib/reports/resolve-document-branding";
import {
  purchaseOrderToTradeInput,
  salesOrderToTradeInput,
  localPurchaseToTradeInput,
  type MapOptions,
} from "@/lib/reports/trade-documents/from-transaction";
import type { BeneficiaryBank, TradeDocType, TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import { renderInvoiceHtml } from "@/lib/reports/invoice-templates/render-invoice-html";
import { openInvoiceDocument } from "@/lib/reports/invoice-templates/open-invoice-document";
import { resolveInvoiceTemplateDefault } from "@/lib/reports/invoice-templates/resolve-default";
import { DEFAULT_TEMPLATE_FLAGS, type InvoiceTemplateFlags } from "@/lib/reports/invoice-templates/types";
import { normalizeTemplateColor } from "@/lib/ui/template-colors";
import { apiGet } from "@/lib/api/client";

export type InvoiceSource = "purchase_order" | "sales_order" | "local_purchase";

export function defaultDocTypeFor(source: InvoiceSource): TradeDocType {
  return source === "sales_order" ? "sales_invoice" : "purchase_invoice";
}

export function mapRecordToInvoice(source: InvoiceSource, record: Record<string, any>, opts: MapOptions): TradeDocumentInput {
  if (source === "sales_order") return salesOrderToTradeInput(record, opts);
  if (source === "local_purchase") return localPurchaseToTradeInput(record, opts);
  return purchaseOrderToTradeInput(record, opts);
}

export interface InvoiceDocumentViewProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  source: InvoiceSource;
  record: Record<string, any>;
  scope: BrandingScope;
  companyId?: string | null;
  docType?: TradeDocType;
  /** extra toolbar buttons (e.g. "View Full Bill") */
  actions?: React.ReactNode;
}

type Built = { input: TradeDocumentInput; html: string; templateId: string; flags: InvoiceTemplateFlags };

export function InvoiceDocumentView({ isOpen, onClose, title, source, record, scope, companyId, docType, actions }: InvoiceDocumentViewProps) {
  const lang = useActiveLanguage() as SupportedLanguage;
  const [built, setBuilt] = useState<Built | null>(null);
  const [error, setError] = useState(false);
  const [height, setHeight] = useState(1123);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const type = docType ?? defaultDocTypeFor(source);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setBuilt(null);
    setError(false);
    (async () => {
      try {
        const [branding, def] = await Promise.all([
          resolveDocumentBranding(scope || {}, lang),
          resolveInvoiceTemplateDefault({
            documentType: type,
            companyId: companyId ?? null,
            countryId: scope?.countryId ?? null,
            countryBranchId: scope?.countryBranchId ?? null,
            cityBranchId: scope?.cityBranchId ?? null,
          }),
        ]);
        // the country's default tax from Settings → Tax Rate Management (read only); its name labels the tax columns
        let configuredTaxName: string | null = null;
        if (scope?.countryId) {
          try {
            const res = await apiGet<any>(`/api/erp/tax?countryId=${encodeURIComponent(scope.countryId)}`);
            const taxes: any[] = Array.isArray(res?.taxes) ? res.taxes : [];
            const kind = source === "sales_order" ? "sales" : "purchase";
            const usable = taxes.filter((x) => x?.isActive !== false && (!x?.appliesTo || x.appliesTo === "both" || x.appliesTo === kind));
            configuredTaxName = (usable.find((x) => x?.isDefault) || usable[0])?.taxName ?? null;
          } catch { /* no tax master: the country's standard word is used */ }
        }
        let bank: BeneficiaryBank | null = branding.bank ?? null;
        if (!bank && companyId) {
          try {
            const res = await apiGet<any>(`/api/erp/companies/${companyId}/bank-accounts`);
            bank = (Array.isArray(res?.banks) ? res.banks[0] : null) ?? null;
          } catch { /* no bank block */ }
        }
        const input = mapRecordToInvoice(source, record, { docType: type, lang, branding, bank, orientation: "portrait", autoPrint: false, configuredTaxName });
        const flags: InvoiceTemplateFlags = { ...DEFAULT_TEMPLATE_FLAGS, showLogo: def.showLogo, showBankDetails: def.showBankDetails, showTerms: def.showTerms };
        let colorId: string | null = null;
        try { colorId = normalizeTemplateColor(window.localStorage.getItem("erp_color")); } catch { /* default colour */ }
        // phones must not enlarge the invoice's text inside the frame (text autosizing breaks the A4 table layout)
        const noAutosize = "<style>html,body{-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important}</style>";
        const raw = renderInvoiceHtml(input, def.templateId, flags, colorId);
        const html = raw.includes("</head>") ? raw.replace("</head>", noAutosize + "</head>") : noAutosize + raw;
        if (alive) setBuilt({ input, html, templateId: def.templateId, flags });
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, source, record, scope, companyId, type, lang]);

  // the iframe grows to the document's own height, so the viewer scrolls the whole A4 page (no inner scrollbar)
  // (re-measured whenever the document resizes: web fonts and Urdu / Arabic text settle after the load event)
  const observerRef = useRef<ResizeObserver | null>(null);
  const fitHeight = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.documentElement) return;
    const measure = () => setHeight(Math.max(1123, doc.documentElement.scrollHeight));
    measure();
    observerRef.current?.disconnect();
    if (typeof ResizeObserver !== "undefined") {
      observerRef.current = new ResizeObserver(measure);
      observerRef.current.observe(doc.documentElement);
      if (doc.body) observerRef.current.observe(doc.body);
    }
    (doc as any).fonts?.ready?.then?.(measure).catch?.(() => {});
  };
  useEffect(() => () => observerRef.current?.disconnect(), []);

  return (
    <A4DocumentViewer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      fit="page"
      bodyClassName="!p-0"
      testId="invoice-document-view"
      actions={
        <>
          {actions}
          <button
            type="button"
            disabled={!built}
            onClick={() => { if (built) void openInvoiceDocument(built.input, built.templateId, built.flags); }}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" /> {t(lang, "common.print", "Print")}
          </button>
        </>
      }
    >
      {error ? (
        <p className="p-8 text-center text-sm font-semibold text-rose-600">
          {t(lang, "tdoc.preview_failed", "Could not build this document. Please try again.")}
        </p>
      ) : !built ? (
        <div className="flex items-center justify-center gap-2 p-16 text-sm font-semibold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> {t(lang, "common.loading", "Loading...")}
        </div>
      ) : (
        <iframe
          ref={frameRef}
          title={typeof title === "string" ? title : "invoice"}
          srcDoc={built.html}
          sandbox="allow-same-origin"
          onLoad={fitHeight}
          className="block w-full border-0 bg-white"
          style={{ height }}
          data-testid="invoice-document-frame"
        />
      )}
    </A4DocumentViewer>
  );
}
