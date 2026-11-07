"use client";

/**
 * Commercial Document Center — from ONE Purchase / Sales transaction, generate a
 * Commercial Invoice, Packing List or Proforma Invoice. No duplicate
 * transactions; the same source record feeds every document.
 *
 * Opens as a compact modal. The user picks the document type, language and
 * orientation, optionally a beneficiary bank (the branding company's own bank
 * accounts), and confirms any critical field missing from the source record —
 * then previews through the shared PDF preview modal (Print / PDF / Email /
 * WhatsApp already live there).
 */

import { useEffect, useRef, useState } from "react";
import { FileText, Package, FileSpreadsheet, Loader2, Star, CheckCircle2 } from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { apiGet } from "@/lib/api/client";
import { resolveDocumentBranding, type BrandingScope } from "@/lib/reports/resolve-document-branding";
import {
  purchaseOrderToTradeInput,
  salesOrderToTradeInput,
  localPurchaseToTradeInput,
  type TradeDocType,
  type TradeTxnKind,
  type BeneficiaryBank,
  type MapOptions,
} from "@/lib/reports/trade-documents";
import {
  INVOICE_TEMPLATES,
  DEFAULT_TEMPLATE_FLAGS,
  openInvoiceDocument,
  resolveInvoiceTemplateDefault,
  saveInvoiceTemplateDefault,
  type InvoiceTemplateId,
} from "@/lib/reports/invoice-templates";

type Source = "purchase_order" | "sales_order" | "local_purchase";

export type TradeDocumentCenterProps = {
  open: boolean;
  onClose: () => void;
  txnKind: TradeTxnKind;
  source?: Source;
  /** the full transaction record (purchase_orders / sales_orders / local_purchases row incl. form_data) */
  record: Record<string, any>;
  /** branding entity — used to look up the entity's own bank accounts */
  companyId?: string | null;
  scope?: BrandingScope;
  /** pre-select a document type when the panel opens (defaults to commercial invoice) */
  initialDocType?: TradeDocType;
};

const DOC_TYPES: Array<{ key: TradeDocType; labelKey: string; en: string; icon: typeof FileText }> = [
  { key: "commercial_invoice", labelKey: "tdoc.t_commercial_invoice", en: "Commercial Invoice", icon: FileText },
  { key: "packing_list", labelKey: "tdoc.t_packing_list", en: "Packing List", icon: Package },
  { key: "proforma_invoice", labelKey: "tdoc.t_proforma_invoice", en: "Proforma Invoice", icon: FileSpreadsheet },
  { key: "contract", labelKey: "tdoc.t_contract", en: "Contract", icon: FileText },
  // 2026-11: 4 new doc types × 5 templates = 20 new combinations the gallery can render.
  { key: "purchase_invoice", labelKey: "tdoc.t_purchase_invoice", en: "Purchase Invoice", icon: FileText },
  { key: "sales_invoice", labelKey: "tdoc.t_sales_invoice", en: "Sales Invoice", icon: FileText },
  { key: "tax_invoice", labelKey: "tdoc.t_tax_invoice", en: "Tax Invoice", icon: FileSpreadsheet },
  { key: "export_invoice", labelKey: "tdoc.t_export_invoice", en: "Export Invoice", icon: FileText },
  { key: "purchase_order", labelKey: "tdoc.t_purchase_order", en: "Purchase Order", icon: FileText },
];

// Each language option is shown in its OWN native script — this is not
// translatable UI chrome (a language name never changes with the active
// language), so it is exempt from the i18n dictionary.
const LANGS: Array<{ code: "en" | "ur" | "ps" | "fa" | "ar"; nativeName: string }> = [
  { code: "en", nativeName: "English" }, { code: "ur", nativeName: "اردو" }, { code: "ps", nativeName: "پښتو" },
  { code: "fa", nativeName: "فارسی" }, { code: "ar", nativeName: "العربية" },
];

/**
 * Document types the default-template API can store. The route's zod enum and the invoice_template_defaults
 * CHECK constraint both stop at these five, so a purchase / sales / tax invoice or purchase order cannot be
 * saved as a default yet and the gallery does not offer "Set Default" for it.
 */
export const DEFAULT_SAVABLE_DOC_TYPES: ReadonlyArray<TradeDocType> = [
  "commercial_invoice", "export_invoice", "packing_list", "proforma_invoice", "contract",
];

export function canSaveDefaultFor(docType: TradeDocType): boolean {
  return DEFAULT_SAVABLE_DOC_TYPES.includes(docType);
}

/**
 * Which mapper a record goes through. An explicit `source` always wins. Without one, a sale is a sales order,
 * a flat local_purchases row (goods_name, no form_data) is a local purchase, and anything else is a purchase order.
 */
export function resolveTradeSource(input: {
  source?: Source;
  txnKind: TradeTxnKind;
  record: Record<string, any> | null | undefined;
}): Source {
  if (input.source) return input.source;
  if (input.txnKind === "sales") return "sales_order";
  const rec = input.record ?? {};
  return rec.goods_name && !rec.form_data ? "local_purchase" : "purchase_order";
}

/**
 * The company whose bank accounts the picker lists. A caller's companyId always wins. When a caller leaves it
 * out, the saved form's own company is used: salesCompanyId for a sale, purchaseCompanyId for a purchase, and
 * company_id for a local purchase row.
 */
export function resolveBankCompanyId(input: {
  companyId?: string | null;
  source: Source;
  record: Record<string, any> | null | undefined;
}): string | null {
  if (input.companyId) return input.companyId;
  const rec = input.record ?? {};
  const form = (rec.form_data?.form ?? rec.form_data ?? {}) as Record<string, any>;
  if (input.source === "sales_order") return form.salesCompanyId || null;
  if (input.source === "purchase_order") return form.purchaseCompanyId || null;
  return rec.company_id || null;
}

export function TradeDocumentCenter(props: TradeDocumentCenterProps) {
  const { open, onClose, txnKind, record, companyId } = props;
  const scopeKey = JSON.stringify(props.scope || {});
  const scope = props.scope;
  const activeLang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(activeLang, key as never, fallback);
  const source: Source = resolveTradeSource({ source: props.source, txnKind, record });
  const bankCompanyId = resolveBankCompanyId({ companyId, source, record });

  const [docType, setDocType] = useState<TradeDocType>(props.initialDocType ?? "commercial_invoice");
  useEffect(() => { if (open && props.initialDocType) setDocType(props.initialDocType); }, [open, props.initialDocType]);
  const [lang, setLang] = useState<"en" | "ur" | "ps" | "fa" | "ar">(activeLang as never);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [banks, setBanks] = useState<BeneficiaryBank[]>([]);
  const [bankIdx, setBankIdx] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Invoice & Print Templates — visual layout choice (registry: classic / modern / professional / compact / premium)
  const [templateId, setTemplateId] = useState<InvoiceTemplateId>("classic");
  const [showLogo, setShowLogo] = useState(true);
  const [showBankDetails, setShowBankDetails] = useState(true);
  const [showTerms, setShowTerms] = useState(true);
  const [matchedScope, setMatchedScope] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSavedMsg, setDefaultSavedMsg] = useState<string | null>(null);
  // Preview waits for the saved default: a click that lands before the lookup returns would otherwise print the
  // placeholder template. A template the user chose is never replaced by a late default lookup.
  const [resolvingDefault, setResolvingDefault] = useState(true);
  const [defaultLoadFailed, setDefaultLoadFailed] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const templateChosenRef = useRef(false);

  useEffect(() => { setLang(activeLang as never); }, [activeLang, open]);

  // Each opening starts without a user choice, so the saved default may apply.
  useEffect(() => {
    if (!open) return;
    templateChosenRef.current = false;
    setPreviewError(null);
  }, [open]);

  // Resolve the default template + display flags for this transaction's scope
  // (Document Type → City Branch → Main Branch → Country → Company → global).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setResolvingDefault(true);
    (async () => {
      try {
        const resolved = await resolveInvoiceTemplateDefault({
          documentType: docType,
          companyId,
          countryId: scope?.countryId,
          countryBranchId: scope?.countryBranchId,
          cityBranchId: scope?.cityBranchId,
        });
        if (!alive) return;
        setDefaultLoadFailed(Boolean(resolved.loadFailed));
        setDefaultSavedMsg(null);
        if (templateChosenRef.current) return;
        setTemplateId(resolved.templateId);
        setShowLogo(resolved.showLogo);
        setShowBankDetails(resolved.showBankDetails);
        setShowTerms(resolved.showTerms);
        setMatchedScope(resolved.matchedScope);
      } finally {
        if (alive) setResolvingDefault(false);
      }
    })();
    return () => { alive = false; };
  }, [open, docType, companyId, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The user picked a template or display option: keep it, and stop claiming it is the saved default. */
  function markTemplateChosen() {
    templateChosenRef.current = true;
    setMatchedScope(null);
  }

  async function handleSetDefault() {
    if (!canSaveDefaultFor(docType) || resolvingDefault || defaultLoadFailed) return;
    setSavingDefault(true);
    setDefaultSavedMsg(null);
    try {
      const scopeType = scope?.cityBranchId ? "city_branch"
        : scope?.countryBranchId ? "country_branch"
        : scope?.countryId ? "country"
        : "global";
      const scopeId = scope?.cityBranchId || scope?.countryBranchId || scope?.countryId || null;
      await saveInvoiceTemplateDefault({
        scopeType,
        scopeId,
        documentType: docType,
        templateId,
        showLogo,
        showBankDetails,
        showTerms,
      });
      setDefaultSavedMsg(tt("invtpl.default_saved", "Default template saved"));
    } catch {
      setDefaultSavedMsg(tt("invtpl.default_save_failed", "Could not save default template"));
    } finally {
      setSavingDefault(false);
    }
  }

  useEffect(() => {
    if (!open) { setBanks([]); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      const list: BeneficiaryBank[] = [];
      try {
        const brand = await resolveDocumentBranding(scope || {}, activeLang);
        if (brand.bank) list.push(brand.bank);
      } catch { /* ignore */ }
      if (bankCompanyId) {
        try {
          const res = await apiGet<any>(`/api/erp/companies/${bankCompanyId}/bank-accounts`);
          for (const b of (Array.isArray(res?.banks) ? res.banks : [])) {
            if (!list.some((x) => x.accountNumber && x.accountNumber === b.accountNumber)) list.push(b);
          }
        } catch { /* ignore */ }
      }
      if (!alive) return;
      setBanks(list);
      setBankIdx(list.length ? 0 : -1);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [open, bankCompanyId, scopeKey, activeLang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePreview() {
    // Never print while the saved default is still loading or the bank list is incomplete: the output would
    // silently use the placeholder template or omit the bank.
    if (busy || loading || resolvingDefault) return;
    setBusy(true);
    setPreviewError(null);
    try {
      const branding = await resolveDocumentBranding(scope || {}, lang);
      const opts: MapOptions = {
        docType,
        lang,
        branding,
        orientation,
        autoPrint: false,
        bank: bankIdx >= 0 ? banks[bankIdx] : null,
      };
      const input =
        source === "sales_order" ? salesOrderToTradeInput(record, opts)
        : source === "local_purchase" ? localPurchaseToTradeInput(record, opts)
        : purchaseOrderToTradeInput(record, opts);
      openInvoiceDocument(input, templateId, { ...DEFAULT_TEMPLATE_FLAGS, showLogo, showBankDetails, showTerms });
      onClose();
    } catch {
      setPreviewError(tt("tdoc.preview_failed", "Could not build this document. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <SimpleModal
      title={tt("tdoc.center_title", "Commercial Document Center")}
      onClose={onClose}
      className="max-w-2xl w-[95vw]"
    >
      <div className="space-y-4 text-sm">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {tt("tdoc.center_hint", "Generate a professional document from this transaction. The same source record is used — no duplicate transaction is created.")}
        </p>

        {/* Document type */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{tt("tdoc.document_type", "Document Type")}</div>
          <div className="grid grid-cols-3 gap-2">
            {DOC_TYPES.map((d) => {
              const Icon = d.icon;
              const on = docType === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDocType(d.key)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-[11px] font-semibold transition ${on ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40" : "border-slate-200 dark:border-slate-700 text-slate-600 hover:border-slate-300"}`}
                >
                  <Icon className="h-4 w-4" />
                  {tt(d.labelKey, d.en)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Language + orientation */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{tt("tdoc.language", "Language")}</div>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as never)}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
            >
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{tt("tdoc.orientation", "Orientation")}</div>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as never)}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
            >
              <option value="portrait">{tt("tdoc.portrait", "Portrait")}</option>
              <option value="landscape">{tt("tdoc.landscape", "Landscape")}</option>
            </select>
          </div>
        </div>

        {/* Beneficiary bank */}
        {docType !== "packing_list" && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              {tt("tdoc.beneficiary_bank", "Beneficiary Bank")}
            </div>
            {loading ? (
              <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {tt("common.loading", "Loading…")}</div>
            ) : banks.length === 0 ? (
              <div className="text-xs text-slate-400">{tt("tdoc.no_bank", "No bank account on the company master — the bank section will be omitted.")}</div>
            ) : (
              <select
                value={bankIdx}
                onChange={(e) => setBankIdx(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
              >
                <option value={-1}>{tt("tdoc.no_bank_selected", "— none —")}</option>
                {banks.map((b, i) => (
                  <option key={i} value={i}>{[b.bankName, b.accountNumber || b.iban, b.currency].filter(Boolean).join(" · ")}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Invoice Template — visual layout choice, shared by Sales / Purchase / Local Sales / Local Purchase */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {tt("invtpl.choose_template", "Choose Template")}
            </div>
            {matchedScope && (
              <div className="text-[11px] text-slate-400">{tt("invtpl.matched_scope_hint", "Using the default set for")}: {matchedScope}</div>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {INVOICE_TEMPLATES.map((def) => {
              const on = templateId === def.id;
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => { markTemplateChosen(); setTemplateId(def.id); }}
                  title={tt(def.descKey, def.descFallback)}
                  className={`relative flex flex-col items-center gap-1 rounded-lg border p-1.5 transition ${on ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}
                >
                  {on && <CheckCircle2 className="absolute -top-1.5 -right-1.5 h-4 w-4 text-blue-600 bg-white dark:bg-slate-900 rounded-full" />}
                  <span className="w-full aspect-[3/4] rounded overflow-hidden border border-slate-100 dark:border-slate-800" dangerouslySetInnerHTML={{ __html: def.thumbnail }} />
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{tt(def.nameKey, def.nameFallback)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{tt("invtpl.display_options", "Display Options")}</div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={showLogo} onChange={(e) => { markTemplateChosen(); setShowLogo(e.target.checked); }} className="h-3.5 w-3.5" />
                {tt("invtpl.show_logo", "Logo")}
              </label>
              {docType !== "packing_list" && (
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={showBankDetails} onChange={(e) => { markTemplateChosen(); setShowBankDetails(e.target.checked); }} className="h-3.5 w-3.5" />
                  {tt("invtpl.show_bank", "Bank Details")}
                </label>
              )}
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={showTerms} onChange={(e) => { markTemplateChosen(); setShowTerms(e.target.checked); }} className="h-3.5 w-3.5" />
                {tt("invtpl.show_terms", "Terms")}
              </label>
            </div>
          </div>

          {defaultLoadFailed && (
            <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              {tt("invtpl.default_load_failed", "The saved default could not be loaded, so Classic is shown. Reopen this window to try again.")}
            </div>
          )}
          {!canSaveDefaultFor(docType) && (
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              {tt("invtpl.default_unsupported_doc", "Default templates are not available for this document type yet.")}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetDefault}
              disabled={savingDefault || resolvingDefault || defaultLoadFailed || !canSaveDefaultFor(docType)}
              className="text-xs"
            >
              {savingDefault ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Star className="h-3.5 w-3.5 mr-1.5" />}
              {tt("invtpl.set_default", "Set Default")}
            </Button>
            {defaultSavedMsg && <span className="text-[11px] text-slate-500">{defaultSavedMsg}</span>}
          </div>
        </div>

        {previewError && (
          <div role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">{previewError}</div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            {tt("common.cancel", "Cancel")}
          </Button>
          <Button size="sm" onClick={handlePreview} disabled={busy || loading || resolvingDefault} className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
            {tt("tdoc.preview", "Preview Document")}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
