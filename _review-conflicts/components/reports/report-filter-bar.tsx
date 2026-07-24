"use client";

import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { cn } from "@/lib/utils";

export type DatePresetKey = "today" | "yesterday" | "this_week" | "this_month" | "custom";

export function ReportFilterBar({
  className,
  accountNoLabel,
  accountNoValue,
  accountNoOptions,
  onAccountNoChange,
  ledgerLabel,
  ledgerValue,
  ledgerOptions,
  onLedgerChange,
  datePresetLabel,
  datePresetValue,
  datePresetOptions,
  onDatePresetChange,
  branchLabel,
  branchValue,
  branchOptions,
  onBranchChange,
  disabled
}: {
  className?: string;
  accountNoLabel: string;
  accountNoValue: string;
  accountNoOptions: SearchSelectOption[];
  onAccountNoChange: (value: string) => void;
  ledgerLabel: string;
  ledgerValue: string;
  ledgerOptions: SearchSelectOption[];
  onLedgerChange: (value: string) => void;
  datePresetLabel: string;
  datePresetValue: DatePresetKey;
  datePresetOptions: SearchSelectOption[];
  onDatePresetChange: (value: DatePresetKey) => void;
  branchLabel: string;
  branchValue: string;
  branchOptions: SearchSelectOption[];
  onBranchChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("grid gap-2 md:grid-cols-2 xl:grid-cols-4", className)}>
      <SearchSelect
        label={accountNoLabel}
        value={accountNoValue}
        placeholder={accountNoLabel}
        options={accountNoOptions}
        disabled={disabled}
        onValueChange={onAccountNoChange}
      />

      <SearchSelect
        label={ledgerLabel}
        value={ledgerValue}
        placeholder={ledgerLabel}
        options={ledgerOptions}
        disabled={disabled}
        onValueChange={onLedgerChange}
      />

      <SearchSelect
        label={datePresetLabel}
        value={datePresetValue}
        placeholder={datePresetLabel}
        options={datePresetOptions}
        disabled={disabled}
        onValueChange={(v) => onDatePresetChange(v as DatePresetKey)}
      />

      <SearchSelect
        label={branchLabel}
        value={branchValue}
        placeholder={branchLabel}
        options={branchOptions}
        disabled={disabled}
        onValueChange={onBranchChange}
      />
    </div>
  );
}
