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
      />

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
