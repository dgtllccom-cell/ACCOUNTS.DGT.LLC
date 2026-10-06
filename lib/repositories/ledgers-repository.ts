import type { LedgerPostingLine } from "@/lib/services/ledger-service";

export type LedgerPostingRecord = {
  journalEntryId: string;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  entryDate: string;
  lines: LedgerPostingLine[];
};

export type LedgersRepository = {
  postJournal(input: LedgerPostingRecord): Promise<{ ledgerEntryIds: string[] }>;
  updateBalances(input: LedgerPostingRecord): Promise<void>;
};

