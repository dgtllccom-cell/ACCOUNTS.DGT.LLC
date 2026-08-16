type PostedLineLike = {
  ledger_id?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
};

type PostedEntryLike = {
  status?: string | null;
  posted_at?: string | null;
  super_admin_serial_number?: string | null;
  country_transaction_serial_number?: string | null;
  branch_transaction_serial_number?: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
};

function asMoney(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 10000) / 10000 : 0;
}

export function assertDistinctBookingLedgers(debitLedgerId: string, creditLedgerId: string, label: string) {
  if (!debitLedgerId || !creditLedgerId) {
    throw new Error(`${label} posting requires both a debit and credit ledger.`);
  }

  if (debitLedgerId === creditLedgerId) {
    throw new Error(`${label} posting requires distinct debit and credit ledgers.`);
  }
}

export function assertBalancedPostedLines(params: {
  label: string;
  lines: PostedLineLike[] | null | undefined;
  expectedDebitLedgerId: string;
  expectedCreditLedgerId: string;
  expectedAmount: number;
  expectedExchangeRate?: number;
  expectedBaseAmount?: number;
}) {
  const lines = Array.isArray(params.lines) ? params.lines : [];
  if (lines.length !== 2) {
    throw new Error(`${params.label} posting verification failed: expected exactly 2 Roznamcha lines.`);
  }

  const debitLine = lines.find((line) => line?.ledger_id === params.expectedDebitLedgerId && asMoney(line.debit) > 0 && asMoney(line.credit) === 0);
  const creditLine = lines.find((line) => line?.ledger_id === params.expectedCreditLedgerId && asMoney(line.credit) > 0 && asMoney(line.debit) === 0);

  if (!debitLine || !creditLine) {
    throw new Error(`${params.label} posting verification failed: expected one distinct debit line and one distinct credit line.`);
  }

  const debitTotal = lines.reduce((sum, line) => sum + asMoney(line.debit), 0);
  const creditTotal = lines.reduce((sum, line) => sum + asMoney(line.credit), 0);
  const expectedAmount = asMoney(params.expectedAmount);
  const exRate = Number(params.expectedExchangeRate || 1) || 1;
  const expectedBaseAmount = params.expectedBaseAmount !== undefined
    ? asMoney(params.expectedBaseAmount)
    : asMoney(expectedAmount * exRate);

  if (debitTotal <= 0 || debitTotal !== creditTotal) {
    throw new Error(`${params.label} posting verification failed: debit and credit totals must balance to each other.`);
  }

  const matchesExpected =
    Math.abs(debitTotal - expectedAmount) < 0.01 ||
    Math.abs(debitTotal - expectedBaseAmount) < 0.01;

  if (!matchesExpected) {
    throw new Error(`${params.label} posting verification failed: debit and credit totals must balance to the posted amount.`);
  }
}

export function assertPostedRoznamchaTrace(params: {
  label: string;
  entry: PostedEntryLike | null | undefined;
}) {
  const entry = params.entry;
  if (!entry) {
    throw new Error(`${params.label} posting verification failed: linked Roznamcha entry is missing.`);
  }

  if (entry.status !== "posted" || !entry.posted_at) {
    throw new Error(`${params.label} posting verification failed: linked Roznamcha entry is not posted.`);
  }

  if (!entry.super_admin_serial_number || !entry.country_transaction_serial_number || !entry.branch_transaction_serial_number) {
    throw new Error(`${params.label} posting verification failed: linked Roznamcha entry is missing one or more authoritative serials.`);
  }

  // Scope fields are required for visibility in the selected country/branch views.
  if (!entry.country_id && !entry.country_branch_id && !entry.city_branch_id) {
    throw new Error(`${params.label} posting verification failed: linked Roznamcha entry is missing scope keys.`);
  }
}

