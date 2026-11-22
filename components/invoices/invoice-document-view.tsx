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
import { billAccounts, purchaseSupplierName, type BillAccounts } from "@/lib/purchases/bill-accounts";

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

type Built = { input: TradeDocumentInput; html: string; templateId: string; flags: InvoiceTemplateFlags; accounts: BillAccounts };

/** fill a missing account name from the account master (read only); the code stays as saved */
async function withAccountNames(accounts: BillAccounts): Promise<BillAccounts> {
  const fill = async (a: BillAccounts["debit"]) => {
    if (a.name || !a.code) return a;
    try {
      const res = await apiGet<any>(`/api/erp/accounting/accounts/lookup?q=${encodeURIComponent(a.code)}&limit=50`);
      const acc = res?.account ?? res?.data?.account;
      const name = acc?.accountName || acc?.ledgerName || acc?.name || "";
      return { ...a, name: String(name || "") };
    } catch {
      return a;
    }
  };
  const [debit, credit] = await Promise.all([fill(accounts.debit), fill(accounts.credit)]);
  return { debit, credit };
}

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
        // the two accounts of the bill, shown separately above the document (Purchase Dr / Supplier Cr, or Customer Dr / Sales Cr)
        const accounts = await withAccountNames(billAccounts(source, record));
        // a purchase invoice's supplier is the Cr party — never our own purchase office (often saved in supplierName)
        const savedSupplier = source === "local_purchase" ? record?.supplier_name : (record?.form_data?.form?.supplierName ?? record?.supplier_name);
        const supplier = source === "sales_order" ? "" : purchaseSupplierName(accounts, savedSupplier);
        const overrides: any = {
          seller: {
            ...(supplier ? { name: supplier } : {}),
            accountCode: source === "sales_order" ? accounts.credit.code : accounts.credit.code || accounts.debit.code,
            accountName: source === "sales_order" ? accounts.credit.name : accounts.credit.name || accounts.debit.name,
          },
          buyer: {
            accountCode: source === "sales_order" ? accounts.debit.code : accounts.debit.code || accounts.credit.code,
            accountName: source === "sales_order" ? accounts.debit.name : accounts.debit.name || accounts.credit.name,
          },
        };
        const input = mapRecordToInvoice(source, record, { docType: type, lang, branding, bank, orientation: "portrait", autoPrint: false, configuredTaxName, overrides });
        const flags: InvoiceTemplateFlags = { ...DEFAULT_TEMPLATE_FLAGS, showLogo: def.showLogo, showBankDetails: def.showBankDetails, showTerms: def.showTerms };
        let colorId: string | null = null;
        try { colorId = normalizeTemplateColor(window.localStorage.getItem("erp_color")); } catch { /* default colour */ }
        // phones must not enlarge the invoice's text inside the frame (text autosizing breaks the A4 table layout)
        const noAutosize = "<style>html,body{-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important}</style>";
        const raw = renderInvoiceHtml(input, def.templateId, flags, colorId);
        const html = raw.includes("</head>") ? raw.replace("</head>", noAutosize + "</head>") : noAutosize + raw;
        if (alive) setBuilt({ input, html, templateId: def.templateId, flags, accounts });
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
        <>
        {(built.accounts.debit.code || built.accounts.debit.name || built.accounts.credit.code || built.accounts.credit.name) && (
          <div className="grid grid-cols-2 gap-2 px-3 pt-3 print:hidden" data-testid="invoice-accounts">
            {([
              ["debit", source === "sales_order" ? t(lang, "idv.acc_customer", "Customer Account (Dr)") : t(lang, "idv.acc_purchase", "Purchase Account (Dr)"), built.accounts.debit],
              ["credit", source === "sales_order" ? t(lang, "idv.acc_sales", "Sales Account (Cr)") : t(lang, "idv.acc_supplier", "Sales / Supplier Account (Cr)"), built.accounts.credit],
            ] as const).map(([kind, label, a]) => (
              <div key={kind} className={`rounded-lg border px-3 py-2 ${kind === "debit" ? "border-sky-200 bg-sky-50" : "border-amber-200 bg-amber-50"}`}>
                <div className={`text-[10px] font-black uppercase tracking-wider ${kind === "debit" ? "text-sky-700" : "text-amber-700"}`}>{label}</div>
                <div className="text-xs font-bold text-slate-800 break-words" dir="ltr">
                  {a.code ? <span className="font-mono">{a.code}</span> : null} {a.name || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
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
        </>
      )}
    </A4DocumentViewer>
  );
}
