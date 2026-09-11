import { withLocalPg } from "@/lib/db/local-postgres";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/posting";

export interface ClearingBillCustomerChargeInput {
  billId: string;
  orderId?: string | null;
  customerId: string;
  chargeType?: string;
  currencyCode?: string;
  amount: number;
  remarks?: string | null;
  createdBy?: string | null;
}

export async function listChargesForBill(billId: string) {
  return withLocalPg(async (sql) => {
    return sql`
      SELECT * FROM public.clearing_bill_customer_charges
      WHERE bill_id = ${billId} AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;
  });
}

export async function createBillCustomerCharge(input: ClearingBillCustomerChargeInput) {
  return withLocalPg(async (sql) => {
    const rows = await sql`
      INSERT INTO public.clearing_bill_customer_charges
        (bill_id, order_id, customer_id, charge_type, currency_code, amount, remarks, created_by)
      VALUES
        (${input.billId}, ${input.orderId ?? null}, ${input.customerId},
         ${input.chargeType ?? "other"}, ${input.currencyCode ?? "USD"}, ${input.amount},
         ${input.remarks ?? null}, ${input.createdBy ?? null})
      RETURNING *
    `;
    return rows[0];
  });
}

/**
 * A customer's shipping AR is a single, per-customer enterprise_account with
 * operational_domain='shipping' — check-before-create so the same customer
 * never gets a second shipping account (mirrors the existing business-side
 * per-customer account pattern; "customer account reuse without duplicate
 * customer creation" from the shipping/clearing wishlist).
 * Returns the ledgers.id (the id postRoznamchaWithErpSession lines need),
 * not the enterprise_accounts.id.
 */
export async function ensureCustomerShippingLedger(
  customerId: string,
  scope: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null },
  actorId: string | null
): Promise<string> {
  const ledgerId = await withLocalPg(async (sql) => {
    const existing = await sql`
      SELECT l.id AS ledger_id
      FROM public.enterprise_accounts ea
      JOIN public.ledgers l ON l.enterprise_account_id = ea.id AND l.deleted_at IS NULL
      WHERE ea.customer_id = ${customerId} AND ea.operational_domain = 'shipping' AND ea.deleted_at IS NULL
      LIMIT 1
    `;
    if (existing[0]?.ledger_id) return existing[0].ledger_id as string;

    const [customer] = await sql`SELECT id, customer_name FROM public.customers WHERE id = ${customerId} LIMIT 1`;
    const accountName = `${customer?.customer_name ?? "Customer"} — Shipping AR`;
    const accountScope = scope.cityBranchId ? "city_branch" : scope.countryBranchId ? "main_branch" : scope.countryId ? "country" : "super_admin";

    const accountCode = `SHIP-AR-${customerId.slice(0, 8).toUpperCase()}`;

    // These *_serial_number / *_number / branch_* columns are the display
    // numbering for the full customer-facing account form (see
    // app/api/erp/accounting/accounts/route.ts) — meaningless for an internal
    // control account like this one, so placeholder values are correct here,
    // not a shortcut around real serial allocation.
    const accountRows = await sql`
      INSERT INTO public.enterprise_accounts
        (scope, operational_domain, category, country_id, country_branch_id, city_branch_id,
         customer_id, code, name, kind, currency, opening_balance, current_balance, status, created_by,
         account_number, customer_number, account_serial_number, creation_date, branch_code,
         branch_account_sequence, country_serial_number, branch_serial_number)
      VALUES
        (${accountScope}, 'shipping', 'SHIP_AR', ${scope.countryId ?? null}, ${scope.countryBranchId ?? null}, ${scope.cityBranchId ?? null},
         ${customerId}, ${accountCode}, ${accountName}, 'asset', 'USD', 0, 0, 'active', ${actorId},
         ${accountCode}, ${accountCode}, 0, now(), 'SHIP', 0, ${accountCode}, ${accountCode})
      RETURNING id
    `;
    const accountId = accountRows[0].id as string;

    const ledgerRows = await sql`
      INSERT INTO public.ledgers
        (scope, country_id, country_branch_id, city_branch_id, enterprise_account_id,
         code, name, currency, opening_balance, current_balance, debit_total, credit_total, is_active, created_by)
      VALUES
        (${accountScope}, ${scope.countryId ?? null}, ${scope.countryBranchId ?? null}, ${scope.cityBranchId ?? null}, ${accountId},
         ${accountCode}, ${accountName}, 'USD', 0, 0, 0, 0, true, ${actorId})
      RETURNING id
    `;
    return ledgerRows[0].id as string;
  });
  if (!ledgerId) throw new Error("Shipping ledger creation needs a direct database connection.");
  return ledgerId;
}

/**
 * The one shared "Shipping — Unallocated Receipts" suspense ledger — created
 * once, reused by every allocation_type='unallocated' receipt until it is
 * manually reallocated (reallocation flow is out of scope for this pass).
 */
export async function ensureUnallocatedSuspenseLedger(actorId: string | null): Promise<string> {
  const ledgerId = await withLocalPg(async (sql) => {
    const existing = await sql`
      SELECT l.id AS ledger_id
      FROM public.enterprise_accounts ea
      JOIN public.ledgers l ON l.enterprise_account_id = ea.id AND l.deleted_at IS NULL
      WHERE ea.operational_domain = 'shipping' AND ea.category = 'SHIP_UNALLOC' AND ea.customer_id IS NULL AND ea.deleted_at IS NULL
      LIMIT 1
    `;
    if (existing[0]?.ledger_id) return existing[0].ledger_id as string;

    const accountRows = await sql`
      INSERT INTO public.enterprise_accounts
        (scope, operational_domain, category, code, name, kind, currency, opening_balance, current_balance, status, created_by,
         account_number, customer_number, account_serial_number, creation_date, branch_code,
         branch_account_sequence, country_serial_number, branch_serial_number)
      VALUES
        ('super_admin', 'shipping', 'SHIP_UNALLOC', 'SHIP-UNALLOC', 'Shipping — Unallocated Receipts', 'liability', 'USD', 0, 0, 'active', ${actorId},
         'SHIP-UNALLOC', 'SHIP-UNALLOC', 0, now(), 'SHIP', 0, 'SHIP-UNALLOC', 'SHIP-UNALLOC')
      RETURNING id
    `;
    const accountId = accountRows[0].id as string;

    const ledgerRows = await sql`
      INSERT INTO public.ledgers
        (scope, enterprise_account_id, code, name, currency, opening_balance, current_balance, debit_total, credit_total, is_active, created_by)
      VALUES
        ('super_admin', ${accountId}, 'SHIP-UNALLOC', 'Shipping — Unallocated Receipts', 'USD', 0, 0, 0, 0, true, ${actorId})
      RETURNING id
    `;
    return ledgerRows[0].id as string;
  });
  if (!ledgerId) throw new Error("Suspense ledger creation needs a direct database connection.");
  return ledgerId;
}

/** The shared Shipping & Clearing Revenue ledger (one enterprise-wide income account, not per-customer). */
export async function ensureShippingRevenueLedger(actorId: string | null): Promise<string> {
  const ledgerId = await withLocalPg(async (sql) => {
    const existing = await sql`
      SELECT l.id AS ledger_id
      FROM public.enterprise_accounts ea
      JOIN public.ledgers l ON l.enterprise_account_id = ea.id AND l.deleted_at IS NULL
      WHERE ea.operational_domain = 'shipping' AND ea.category = 'SHIP_REV' AND ea.deleted_at IS NULL
      LIMIT 1
    `;
    if (existing[0]?.ledger_id) return existing[0].ledger_id as string;

    const accountRows = await sql`
      INSERT INTO public.enterprise_accounts
        (scope, operational_domain, category, code, name, kind, currency, opening_balance, current_balance, status, created_by,
         account_number, customer_number, account_serial_number, creation_date, branch_code,
         branch_account_sequence, country_serial_number, branch_serial_number)
      VALUES
        ('super_admin', 'shipping', 'SHIP_REV', 'SHIP-REV', 'Shipping & Clearing Revenue', 'income', 'USD', 0, 0, 'active', ${actorId},
         'SHIP-REV', 'SHIP-REV', 0, now(), 'SHIP', 0, 'SHIP-REV', 'SHIP-REV')
      RETURNING id
    `;
    const accountId = accountRows[0].id as string;

    const ledgerRows = await sql`
      INSERT INTO public.ledgers
        (scope, enterprise_account_id, code, name, currency, opening_balance, current_balance, debit_total, credit_total, is_active, created_by)
      VALUES
        ('super_admin', ${accountId}, 'SHIP-REV', 'Shipping & Clearing Revenue', 'USD', 0, 0, 0, 0, true, ${actorId})
      RETURNING id
    `;
    return ledgerRows[0].id as string;
  });
  if (!ledgerId) throw new Error("Revenue ledger creation needs a direct database connection.");
  return ledgerId;
}

/**
 * Post one customer charge: DR the customer's shipping AR / CR the shared
 * Shipping Revenue account. Same engine as bill-expenses' expense posting
 * (postRoznamchaWithErpSession) — no new DR/CR mechanism.
 */
export async function postBillCustomerCharge(
  chargeId: string,
  actorId: string,
  scope: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }
) {
  const charge = await withLocalPg(async (sql) => {
    const [row] = await sql`
      SELECT c.*, b.bill_no
      FROM public.clearing_bill_customer_charges c
      JOIN public.clearing_payment_bills b ON b.id = c.bill_id
      WHERE c.id = ${chargeId} AND c.deleted_at IS NULL LIMIT 1
    `;
    return row;
  });
  if (!charge) throw new Error("Customer charge not found.");
  if (charge.posting_status === "posted") throw new Error("This charge is already posted.");
  if (Number(charge.amount) <= 0) throw new Error("A zero-amount charge cannot be posted.");

  const customerAccountId = await ensureCustomerShippingLedger(charge.customer_id, scope, actorId);
  const revenueAccountId = await ensureShippingRevenueLedger(actorId);

  const entryDate = new Date().toISOString().slice(0, 10);
  const uniq = Date.now().toString(36).toUpperCase().slice(-5);
  const billRef = charge.bill_no || charge.bill_id.slice(0, 8);
  const journalNo = `SHPC-${billRef}-${uniq}`.slice(0, 118);
  const voucherNo = `SHPCV-${billRef}-${uniq}`.slice(0, 118);

  // The customer shipping-AR and Shipping Revenue ledgers are deliberately
  // single shared control accounts (super_admin scope, not per-country) — see
  // ensureCustomerShippingLedger/ensureShippingRevenueLedger. A roznamcha
  // entry's `type` must match the SCOPE of the ledgers it posts to
  // (isLedgerScopeCompatible in posting.ts rejects a super_admin-scoped
  // ledger under a country/branch-type entry), so this posting is always
  // super_admin-type regardless of the order's own country/branch — the
  // order's real scope is still enforced separately via authorizeApiScope/
  // canAccessOrder in the API route before this service is ever called.
  const { entryId } = await postRoznamchaWithErpSession({
    sessionUserId: actorId,
    body: {
      mode: "post",
      type: "super_admin",
      entryDate,
      journalNo,
      voucherNo,
      narration: `Shipping customer charge (${charge.charge_type}) on bill ${billRef}` + (charge.remarks ? ` — ${charge.remarks}` : ""),
      referenceNo: billRef,
      roznamchaCategory: "shipping",
      sourceModule: "clearing_bill_customer_charges",
      sourceTransactionType: "clearing_bill_customer_charge",
      sourceTransactionId: charge.id,
      lines: [
        {
          ledgerId: customerAccountId,
          debit: Number(charge.amount),
          credit: 0,
          currency: charge.currency_code,
          exchangeRate: 1,
          description: `Shipping charge: ${charge.charge_type}`,
          paymentEntryType: "debit"
        },
        {
          ledgerId: revenueAccountId,
          debit: 0,
          credit: Number(charge.amount),
          currency: charge.currency_code,
          exchangeRate: 1,
          description: `Shipping revenue: ${charge.charge_type}`,
          paymentEntryType: "credit"
        }
      ]
    } as never
  });

  await withLocalPg(async (sql) => {
    await sql`
      UPDATE public.clearing_bill_customer_charges
      SET posting_status = 'posted', revenue_account_id = ${revenueAccountId},
          customer_account_id = ${customerAccountId}, roznamcha_entry_id = ${entryId},
          posted_at = now(), updated_at = now()
      WHERE id = ${chargeId}
    `;
  });

  return { entryId, amount: Number(charge.amount), currency: charge.currency_code };
}
