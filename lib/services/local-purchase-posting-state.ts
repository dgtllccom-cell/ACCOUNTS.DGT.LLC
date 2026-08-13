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
  const complete = hasJournal && hasRoznamcha && statusIsPosted;

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
    !hasJournal ? "Journal posting is missing." :
    !statusIsPosted ? `Bill status is still '${status || "draft"}'.` :
    "Accounting proof is incomplete.";

  return {
    isComplete: false,
    visualStatus: "red",
    label: "RED",
    reason,
  };
}
