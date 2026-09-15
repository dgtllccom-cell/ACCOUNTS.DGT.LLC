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

import { useEffect, useState } from "react";
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
];

// Each language option is shown in its OWN native script — this is not
// translatable UI chrome (a language name never changes with the active
// language), so it is exempt from the i18n dictionary.
const LANGS: Array<{ code: "en" | "ur" | "ps" | "fa" | "ar"; nativeName: string }> = [
  { code: "en", nativeName: "English" }, { code: "ur", nativeName: "اردو" }, { code: "ps", nativeName: "پښتو" },
  { code: "fa", nativeName: "فارسی" }, { code: "ar", nativeName: "العربية" },
];

export function TradeDocumentCenter(props: TradeDocumentCenterProps) {
  const { open, onClose, txnKind, record, companyId } = props;
  const scopeKey = JSON.stringify(props.scope || {});
  const scope = props.scope;
  const activeLang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(activeLang, key as never, fallback);

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

  useEffect(() => { setLang(activeLang as never); }, [activeLang, open]);

  // Resolve the default template + display flags for this transaction's scope
  // (Document Type → City Branch → Main Branch → Country → Company → global).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const resolved = await resolveInvoiceTemplateDefault({
        documentType: docType,
        companyId,
        countryId: scope?.countryId,
        countryBranchId: scope?.countryBranchId,
        cityBranchId: scope?.cityBranchId,
      });
      if (!alive) return;
      setTemplateId(resolved.templateId);
      setShowLogo(resolved.showLogo);
      setShowBankDetails(resolved.showBankDetails);
      setShowTerms(resolved.showTerms);
      setMatchedScope(resolved.matchedScope);
      setDefaultSavedMsg(null);
    })();
    return () => { alive = false; };
  }, [open, docType, companyId, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSetDefault() {
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
      if (companyId) {
        try {
          const res = await apiGet<any>(`/api/erp/companies/${companyId}/bank-accounts`);
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
  }, [open, companyId, scopeKey, activeLang]); // eslint-disable-line react-hooks/exhaustive-deps

  const source: Source = props.source
    ?? (txnKind === "sales" ? "sales_order" : record?.goods_name ? "local_purchase" : "purchase_order");

  async function handlePreview() {
    setBusy(true);
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
              <div className="text-[10px] text-slate-400">{tt("invtpl.matched_scope_hint", "Using the default set for")}: {matchedScope}</div>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {INVOICE_TEMPLATES.map((def) => {
              const on = templateId === def.id;
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => setTemplateId(def.id)}
                  title={tt(def.descKey, def.descFallback)}
                  className={`relative flex flex-col items-center gap-1 rounded-lg border p-1.5 transition ${on ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}
                >
                  {on && <CheckCircle2 className="absolute -top-1.5 -right-1.5 h-4 w-4 text-blue-600 bg-white dark:bg-slate-900 rounded-full" />}
                  <span className="w-full aspect-[3/4] rounded overflow-hidden border border-slate-100 dark:border-slate-800" dangerouslySetInnerHTML={{ __html: def.thumbnail }} />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{tt(def.nameKey, def.nameFallback)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{tt("invtpl.display_options", "Display Options")}</div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} className="h-3.5 w-3.5" />
                {tt("invtpl.show_logo", "Logo")}
              </label>
              {docType !== "packing_list" && (
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={showBankDetails} onChange={(e) => setShowBankDetails(e.target.checked)} className="h-3.5 w-3.5" />
                  {tt("invtpl.show_bank", "Bank Details")}
                </label>
              )}
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={showTerms} onChange={(e) => setShowTerms(e.target.checked)} className="h-3.5 w-3.5" />
                {tt("invtpl.show_terms", "Terms")}
              </label>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={handleSetDefault} disabled={savingDefault} className="text-xs">
              {savingDefault ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Star className="h-3.5 w-3.5 mr-1.5" />}
              {tt("invtpl.set_default", "Set Default")}
            </Button>
            {defaultSavedMsg && <span className="text-[11px] text-slate-500">{defaultSavedMsg}</span>}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            {tt("common.cancel", "Cancel")}
          </Button>
          <Button size="sm" onClick={handlePreview} disabled={busy} className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
            {tt("tdoc.preview", "Preview Document")}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
