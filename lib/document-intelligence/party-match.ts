/**
 * Pure helpers for Document Intake review: counter-party name matching, bank-detail comparison and
 * currency conversion. No DB / React so they are unit-tested and shared by the API and the UI.
 */

// ───────────────────────────── party name matching ─────────────────────────────

const LEGAL_NOISE = new Set([
  "co", "company", "ltd", "limited", "llc", "l.l.c", "llp", "inc", "incorporated", "corp", "corporation", "plc",
  "fze", "fzc", "fzco", "fz", "pvt", "private", "pte", "gmbh", "sa", "bv", "est", "establishment",
  "imp", "exp", "import", "export", "imports", "exports", "trading", "trade", "general", "international", "intl", "group", "the", "and", "of",
]);

/** lower-case, strip punctuation, drop legal-form / generic business words → the significant tokens. */
export function significantTokens(name: string | null | undefined): string[] {
  const base = String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  const toks = base.split(/\s+/).filter(Boolean);
  const sig = toks.filter((t) => !LEGAL_NOISE.has(t));
  return sig.length ? sig : toks;
}

export function normalisePartyName(name: string | null | undefined): string {
  return significantTokens(name).join(" ");
}

/** 0..1 — 1 = same significant words; partial overlap scales; unrelated = 0. */
export function partyNameScore(a: string | null | undefined, b: string | null | undefined): number {
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  if (!ta.length || !tb.length) return 0;
  const sa = new Set(ta);
  const sb = new Set(tb);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  if (!inter) return 0;
  if (ta.join(" ") === tb.join(" ")) return 1;
  const union = new Set([...sa, ...sb]).size;
  const jaccard = inter / union;
  // one name fully contained in the other ("Dalian Sunshine" ⊂ "Dalian Sunshine Plastics")
  const contained = inter === Math.min(sa.size, sb.size);
  return Math.min(0.95, contained ? Math.max(jaccard, 0.8) : jaccard);
}

// ──────────────────────────────── bank comparison ────────────────────────────────

export type ExtractedBank = {
  beneficiary?: string | null;
  bankName?: string | null;
  accountNo?: string | null;
  iban?: string | null;
  swift?: string | null;
};

export type KnownBank = {
  id: string;
  bankName?: string | null;
  accountTitle?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
};

export type BankComparison = {
  status: "none_extracted" | "party_has_no_banks" | "matched" | "changed" | "unmatched";
  bankId: string | null;
  differences: Array<{ field: "accountNumber" | "iban" | "swift" | "bankName" | "accountTitle"; extracted: string; existing: string }>;
};

const digits = (v: string | null | undefined) => String(v ?? "").replace(/[^0-9]/g, "");
const alnum = (v: string | null | undefined) => String(v ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/**
 * Compare the bank details printed on the document with the banks already linked to the selected party.
 * It only REPORTS; the caller never creates / edits a bank or ledger from the result.
 */
export function compareBank(extracted: ExtractedBank, known: KnownBank[]): BankComparison {
  const hasAny = Boolean(digits(extracted.accountNo) || alnum(extracted.iban) || alnum(extracted.swift) || String(extracted.bankName ?? "").trim());
  if (!hasAny) return { status: "none_extracted", bankId: null, differences: [] };
  if (!known.length) return { status: "party_has_no_banks", bankId: null, differences: [] };

  const exAcc = digits(extracted.accountNo);
  const exIban = alnum(extracted.iban);
  const exSwift = alnum(extracted.swift);

  for (const b of known) {
    if ((exIban && alnum(b.iban) === exIban) || (exAcc.length >= 6 && digits(b.accountNumber) === exAcc)) {
      return { status: "matched", bankId: b.id, differences: [] };
    }
  }
  // same institution (SWIFT or name) but a different account number / IBAN → "changed"
  const sameInstitution = known.find(
    (b) => (exSwift && alnum(b.swift) === exSwift) || (extracted.bankName && partyNameScore(extracted.bankName, b.bankName) >= 0.6),
  );
  if (sameInstitution) {
    const differences: BankComparison["differences"] = [];
    if (exAcc && digits(sameInstitution.accountNumber) && digits(sameInstitution.accountNumber) !== exAcc) {
      differences.push({ field: "accountNumber", extracted: String(extracted.accountNo), existing: String(sameInstitution.accountNumber) });
    }
    if (exIban && alnum(sameInstitution.iban) && alnum(sameInstitution.iban) !== exIban) {
      differences.push({ field: "iban", extracted: String(extracted.iban), existing: String(sameInstitution.iban) });
    }
    if (exSwift && alnum(sameInstitution.swift) && alnum(sameInstitution.swift) !== exSwift) {
      differences.push({ field: "swift", extracted: String(extracted.swift), existing: String(sameInstitution.swift) });
    }
    return { status: "changed", bankId: sameInstitution.id, differences };
  }
  return { status: "unmatched", bankId: null, differences: [] };
}

// ─────────────────────────────── currency conversion ───────────────────────────────

/** "multiply": 1 FROM = rate TO (final = amount × rate).  "divide": 1 TO = rate FROM (final = amount ÷ rate). */
export type RateDirection = "multiply" | "divide";

export function convertAmount(amount: number, rate: number, direction: RateDirection = "multiply"): number | null {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return null;
  const v = direction === "multiply" ? amount * rate : amount / rate;
  return Math.round(v * 100) / 100;
}

/** Cross rate FROM→TO (1 FROM = x TO) from "units of USD per 1 unit" rates. */
export function crossRate(fromToUsd: number | null | undefined, toToUsd: number | null | undefined): number | null {
  if (!fromToUsd || !toToUsd || fromToUsd <= 0 || toToUsd <= 0) return null;
  return Math.round((fromToUsd / toToUsd) * 1e8) / 1e8;
}

export function lineAmount(quantity: number | null | undefined, unitPrice: number | null | undefined): number | null {
  if (quantity == null || unitPrice == null || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return null;
  return Math.round(quantity * unitPrice * 100) / 100;
}
