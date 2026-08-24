import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { listBanks, getBankById, type BankRecord } from "@/features/banks/bank-api";
import { BankForm } from "@/features/banks/components/bank-form";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { localizeTerm } from "@/features/companies/components/company-registry";
import { transliterateProperNoun } from "@/lib/i18n/transliteration";

function toOption(row: BankRecord, lang: string = "en"): SearchSelectOption {
  const bankName = localizeTerm(row.bank_name, lang);
  const accountTitle = localizeTerm(row.account_title, lang);
  const branchName = row.branch_name ? localizeTerm(row.branch_name, lang) : null;
  // Label shows: Bank Name — Account Title
  const label = `${bankName} — ${accountTitle}`;
  const keywords = [
    bankName,
    row.bank_name,
    accountTitle,
    row.account_title,
    row.account_number,
    branchName,
    row.branch_name,
    row.branch_code,
    row.short_name,
    row.iban_number,
    row.currency,
    row.swift_bic
  ]
    .filter(Boolean)
    .join(" ");
  return { value: row.id, label, keywords };
}

/**
 * BankPicker — Master Form picker for banks.
 *
 * Queries the dedicated /api/erp/banks endpoint (Bank Master database).
 * Supports searching by: Bank Name, Account Name, Account Number,
 * Branch Name, Branch Code.
 *
 * The "+ New Bank" button opens the Bank Master Form in a modal,
 * saves the record, and immediately selects the new bank.
 *
 * RULE: Always use BankPicker — never create a free-text bank input.
 */
export function BankPicker({
  label,
  value,
  onValueChange,
  disabled,
  placeholder
}: {
  label: string;
  value: string;
  onValueChange: (bankId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const lang = useActiveLanguage();
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<BankRecord[]>([]);
  const [openCreate, setOpenCreate] = useState(false);

  async function loadList() {
    setLoading(true);
    try {
      const rows = await listBanks({ limit: 100 });
      setBanks(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If a value is selected but not in the current list, fetch it individually
  useEffect(() => {
    if (!value) return;
    if (banks.some((b) => b.id === value)) return;

    let cancelled = false;
    (async () => {
      try {
        const bank = await getBankById(value);
        if (cancelled) return;
        if (bank) {
          setBanks((current) => {
            if (current.some((b) => b.id === bank.id)) return current;
            return [...current, bank];
          });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const options: SearchSelectOption[] = useMemo(() => banks.map((b) => toOption(b, lang)), [banks, lang]);
  const [viewBank, setViewBank] = useState<BankRecord | null>(null);
  const [editBankId, setEditBankId] = useState<string | null>(null);

  return (
    <>
      <SearchSelect
        label={label}
        value={value}
        placeholder={placeholder ?? (loading ? t(lang, "bankreg.bankreg_loading_banks", "Loading banks...") : t(lang, "bankreg.bp_search_bank_placeholder", "Search bank by name, account, branch..."))}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        createLabel={t(lang, "bankreg.bankreg_new_bank", "New Bank")}
        createButtonPlacement="both"
        onCreateNew={async () => setOpenCreate(true)}
        viewTitle={t(lang, "bankreg.bp_view_bank_details", "View Bank Details")}
        editTitle={t(lang, "bankreg.bp_edit_bank_master", "Edit Bank Master")}
        onViewOption={(bankId) => {
          const found = banks.find((b) => b.id === bankId);
          if (found) setViewBank(found);
        }}
        onEditOption={(bankId) => {
          setEditBankId(bankId);
        }}
      />

      {/* View Bank Modal */}
      {viewBank ? (
        <SimpleModal
          title={`${t(lang, "bankreg.bp_bank_details_dash", "Bank Details —")} ${localizeTerm(viewBank.bank_name, lang)}`}
          onClose={() => setViewBank(null)}
          className="w-[96vw] max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl font-sans shadow-2xl"
        >
          <div className="p-5 space-y-4 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
              <div>
                <h3 className="text-base font-black tracking-wide text-slate-900 dark:text-white">{localizeTerm(viewBank.bank_name, lang)}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{t(lang, "bankreg.bp_account_title_colon", "Account Title:")} <span className="font-bold text-slate-700 dark:text-slate-300">{localizeTerm(viewBank.account_title, lang)}</span></p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900">
                  {viewBank.is_active !== false ? t(lang, "bankreg.bp_active_bank", "Active Bank") : t(lang, "god.inactive", "Inactive")}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">{t(lang, "purchase.currency_colon_label", "Currency:")} <span className="font-bold text-slate-800 dark:text-white">{viewBank.currency || "AED"}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "bank.account_number", "Account Number")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white text-sm" dir="ltr">{viewBank.account_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "bankreg.bp_branch_name_code", "Branch Name / Code")}</span>
                <span className="font-bold text-slate-800 dark:text-white text-sm">{viewBank.branch_name ? localizeTerm(viewBank.branch_name, lang) : "—"} ({viewBank.branch_code || "N/A"})</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "bankreg.bp_short_name", "Short Name")}</span>
                <span className="font-bold text-slate-800 dark:text-white text-sm">{viewBank.short_name || "—"}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "bankreg.bp_iban_number", "IBAN Number")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white text-xs" dir="ltr">{viewBank.iban_number || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "bankreg.bp_swift_bic_code", "SWIFT / BIC Code")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white text-xs" dir="ltr">{viewBank.swift_bic || "—"}</span>
              </div>
              <div className="sm:col-span-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "bankreg.bp_opening_net_balance", "Opening / Net Balance")}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                  {viewBank.currency || "AED"} {Number(viewBank.opening_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditBankId(viewBank.id);
                  setViewBank(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition"
              >
                {t(lang, "hr.pp_edit_master", "Edit Master")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewBank(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                >
                  {t(lang, "purchase.close_btn", "Close")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange(viewBank.id);
                    setViewBank(null);
                  }}
                  className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                >
                  {t(lang, "bankreg.bp_select_this_bank", "Select This Bank")}
                </button>
              </div>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {/* Edit Bank Modal */}
      {editBankId ? (
        <SimpleModal
          title={t(lang, "bankreg.bp_edit_bank_dash_master_form", "Edit Bank — Bank Master Form")}
          onClose={() => setEditBankId(null)}
          className="max-w-[90vw] lg:max-w-6xl max-h-[90vh] overflow-y-auto"
        >
          <BankForm
            mode="embedded"
            initialBankId={editBankId}
            onSave={(bankId) => {
              loadList().catch(() => null);
              onValueChange(bankId);
              setEditBankId(null);
            }}
            onCancel={() => setEditBankId(null)}
          />
        </SimpleModal>
      ) : null}

      {/* Create Bank Modal */}
      {openCreate ? (
        <SimpleModal
          title={t(lang, "bankreg.bp_new_bank_dash_master_form", "New Bank — Bank Master Form")}
          onClose={() => setOpenCreate(false)}
          className="max-w-[90vw] lg:max-w-6xl max-h-[90vh] overflow-y-auto"
        >
          <BankForm
            mode="embedded"
            onSave={(bankId) => {
              loadList().catch(() => null);
              onValueChange(bankId);
              setOpenCreate(false);
            }}
            onCancel={() => setOpenCreate(false)}
          />
        </SimpleModal>
      ) : null}
    </>
  );
}
