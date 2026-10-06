type LocalPurchaseLike = {
  status?: string | null;
  bill_status?: string | null;
  journal_entry_id?: string | null;
  roznamcha_entry_id?: string | null;
};

export type LocalPurchasePostingState = {
  isComplete: boolean;
  visualStatus: "red" | "black";
  label: "RED" | "BLACK";
  reason: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function deriveLocalPurchasePostingState(row: LocalPurchaseLike): LocalPurchasePostingState {
  const status = normalize(row.status || row.bill_status);
  const hasJournal = Boolean(row.journal_entry_id);
  const hasRoznamcha = Boolean(row.roznamcha_entry_id);
  const statusIsPosted = status === "posted" || status === "transferred" || status === "paid";
  // Modern ERP accounts are stored in enterprise_accounts and are posted via
  // Roznamcha, which updates the linked ledger directly. The legacy
  // journal_entries path is retained only when both selected accounts have a
  // legacy accounts link, so a successful modern posting must not remain RED
  // merely because journal_entry_id is intentionally null.
  const complete = hasRoznamcha && statusIsPosted;

  if (complete) {
    return {
      isComplete: true,
      visualStatus: "black",
      label: "BLACK",
      reason: "Canonical journal and Roznamcha proof is complete.",
    };
  }

  const reason =
    !hasRoznamcha ? "Roznamcha posting is missing." :
    !statusIsPosted ? `Bill status is still '${status || "draft"}'.` :
    hasJournal ? "Canonical journal and Roznamcha proof is complete." :
    "Canonical Roznamcha and ledger posting is complete.";

  return {
    isComplete: false,
    visualStatus: "red",
    label: "RED",
    reason,
  };
}
