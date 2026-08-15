"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { listBanks, getBankById, type BankRecord } from "@/features/banks/bank-api";
import { BankForm } from "@/features/banks/components/bank-form";

function toOption(row: BankRecord): SearchSelectOption {
  // Label shows: Bank Name — Account Title (Account No)
  const label = `${row.bank_name} — ${row.account_title}`;
  const keywords = [
    row.bank_name,
    row.account_title,
    row.account_number,
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

  const options: SearchSelectOption[] = useMemo(() => banks.map(toOption), [banks]);
  const [viewBank, setViewBank] = useState<BankRecord | null>(null);
  const [editBankId, setEditBankId] = useState<string | null>(null);

  return (
    <>
      <SearchSelect
        label={label}
        value={value}
        placeholder={placeholder ?? (loading ? "Loading banks..." : "Search bank by name, account, branch...")}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        createLabel="+ New Bank"
        createButtonPlacement="both"
        onCreateNew={async () => setOpenCreate(true)}
        viewTitle="View Bank Details"
        editTitle="Edit Bank Master"
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
          title={`Bank Details — ${viewBank.bank_name}`}
          onClose={() => setViewBank(null)}
          className="w-[96vw] max-w-[700px] max-h-[85vh] overflow-y-auto rounded-2xl font-sans"
        >
          <div className="p-4 space-y-4 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-xl">
              <div>
                <h3 className="text-base font-black uppercase tracking-wide">{viewBank.bank_name}</h3>
                <p className="text-xs text-slate-300 font-medium">Account Title: {viewBank.account_title}</p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-slate-950">
                  {viewBank.is_active !== false ? "Active Bank" : "Inactive"}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">Currency: <span className="font-bold text-white">{viewBank.currency || "AED"}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Account Number</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">{viewBank.account_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Branch Name / Code</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewBank.branch_name || "-"} ({viewBank.branch_code || "N/A"})</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Short Name</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewBank.short_name || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">IBAN Number</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">{viewBank.iban_number || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">SWIFT / BIC Code</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">{viewBank.swift_bic || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Opening / Net Balance</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {viewBank.currency || "AED"} {Number(viewBank.opening_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditBankId(viewBank.id);
                  setViewBank(null);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition"
              >
                Edit Master
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewBank(null)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange(viewBank.id);
                    setViewBank(null);
                  }}
                  className="px-4 py-1.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                >
                  Select This Bank
                </button>
              </div>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {/* Edit Bank Modal */}
      {editBankId ? (
        <SimpleModal
          title="Edit Bank — Bank Master Form"
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
          title="New Bank — Bank Master Form"
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
