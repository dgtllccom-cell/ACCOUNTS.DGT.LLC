import { withLocalPg } from "@/lib/db/local-postgres";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/posting";
import { ApiClientError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

export interface PartnerBillInput {
  orderId: string;
  legId: string;
  providerAccountId: string;
  expenseAccountId?: string | null;
  agentName: string;
  countryOfService?: string | null;
  invoiceRef?: string | null;
  expenseCategory?: string | null;
  totalAmount: number;
  currencyCode?: string | null;
  exchangeRate?: number | null;
  remarks?: string | null;
  supportingDocuments?: any[];
  customsDuty?: number;
  portCharges?: number;
  demurrageCharges?: number;
  clearanceFee?: number;
  freightCharges?: number;
  otherCharges?: number;
}

export interface PartnerPaymentInput {
  billId: string;
  amount: number;
  paymentAccountId: string;
  paymentDate?: string;
  paymentMethod?: string;
  referenceNo?: string;
  narration?: string;
}

/**
 * List all partner bills and payments for a customer order, plus route leg partner details.
 */
export async function listPartnerBillsForOrder(orderId: string) {
  return withLocalPg(async (sql) => {
    // 1. Fetch order legs
    const legs = await sql`
      SELECT 
        l.id, l.leg_no, l.from_location_text, l.to_location_text,
        l.from_country_name, l.to_country_name, l.transport_mode,
        l.handler_type, l.partner_type, l.partner_name,
        l.partner_account_id, l.partner_country_name,
        l.estimated_expense_amount, l.actual_expense_amount, l.expense_currency,
        acc.code AS partner_account_code, acc.name AS partner_account_name,
        acc.currency AS partner_account_currency
      FROM public.clearing_customer_order_legs l
      LEFT JOIN public.ledgers acc ON acc.id = l.partner_account_id AND acc.deleted_at IS NULL
      WHERE l.order_id = ${orderId}::uuid AND l.deleted_at IS NULL
      ORDER BY l.leg_no ASC
    `;

    // 2. Fetch bills
    const bills = await sql`
      SELECT 
        b.id, b.order_id, b.leg_id, b.bill_no, b.order_no,
        b.agent_name, b.invoice_ref, b.expense_category, b.country_of_service,
        b.total_amount, b.paid_amount, b.remaining_balance,
        b.currency_code, b.exchange_rate, b.payment_status,
        b.posting_status, b.roznamcha_entry_id, b.posted_at,
        b.provider_account_id, b.expense_account_id,
        b.customs_duty, b.port_charges, b.demurrage_charges,
        b.clearance_fee, b.freight_charges, b.other_charges,
        b.supporting_documents, b.remarks, b.created_at,
        p_acc.code AS provider_account_code, p_acc.name AS provider_account_name,
        e_acc.code AS expense_account_code, e_acc.name AS expense_account_name,
        rz.voucher_no AS roznamcha_voucher_no, rz.journal_no AS roznamcha_journal_no
      FROM public.clearing_payment_bills b
      LEFT JOIN public.ledgers p_acc ON p_acc.id = b.provider_account_id AND p_acc.deleted_at IS NULL
      LEFT JOIN public.ledgers e_acc ON e_acc.id = b.expense_account_id AND e_acc.deleted_at IS NULL
      LEFT JOIN public.roznamcha_entries rz ON rz.id = b.roznamcha_entry_id AND rz.deleted_at IS NULL
      WHERE b.order_id = ${orderId}::uuid AND b.deleted_at IS NULL
      ORDER BY b.created_at ASC
    `;

    // 3. Fetch all payments for these bills
    const billIds = bills.map((b: any) => b.id);
    let payments: any[] = [];
    if (billIds.length > 0) {
      payments = await sql`
        SELECT 
          p.id, p.bill_id, p.order_id, p.leg_id, p.payment_serial,
          p.payment_no, p.payment_date, p.amount, p.currency_code,
          p.exchange_rate, p.payment_method, p.reference_no, p.narration,
          p.provider_account_id, p.payment_account_id, p.roznamcha_entry_id,
          p.created_at,
          pay_acc.code AS payment_account_code, pay_acc.name AS payment_account_name,
          rz.voucher_no AS roznamcha_voucher_no
        FROM public.clearing_payment_bill_payments p
        LEFT JOIN public.ledgers pay_acc ON pay_acc.id = p.payment_account_id AND pay_acc.deleted_at IS NULL
        LEFT JOIN public.roznamcha_entries rz ON rz.id = p.roznamcha_entry_id AND rz.deleted_at IS NULL
        WHERE p.bill_id = ANY(${billIds}::uuid[]) AND p.deleted_at IS NULL
        ORDER BY p.payment_date ASC, p.payment_serial ASC
      `;
    }

    // Attach payments to each bill
    const billsWithPayments = bills.map((b: any) => ({
      ...b,
      payments: payments.filter((p: any) => p.bill_id === b.id)
    }));

    return { legs, bills: billsWithPayments };
  });
}

/**
 * Creates or updates a partner bill against a customer order leg.
 * Does NOT post journal entries, does NOT invent amounts, does NOT mark paid.
 */
export async function createOrUpdatePartnerBill(
  input: PartnerBillInput,
  actorId: string,
  scope: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }
) {
  return withLocalPg(async (sql) => {
    // 1. Verify customer order exists
    const [order] = await sql`
      SELECT id, order_no, country_id, country_branch_id, city_branch_id
      FROM public.clearing_customer_orders
      WHERE id = ${input.orderId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!order) {
      throw new ApiClientError("Customer order not found.", { status: 404, code: "ORDER_NOT_FOUND" });
    }

    // 2. Verify leg exists and belongs to this order
    const [leg] = await sql`
      SELECT id, leg_no, handler_type, partner_type, partner_name, partner_account_id, from_country_name, to_country_name
      FROM public.clearing_customer_order_legs
      WHERE id = ${input.legId}::uuid AND order_id = ${input.orderId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!leg) {
      throw new ApiClientError("Route leg not found for this order.", { status: 404, code: "LEG_NOT_FOUND" });
    }

    // 3. Provider account is mandatory from Account Master
    if (!input.providerAccountId) {
      throw new ApiClientError(
        "An active provider account from Account Master is required. Please select or register the provider ledger.",
        { status: 400, code: "PROVIDER_ACCOUNT_REQUIRED" }
      );
    }

    const [providerLedger] = await sql`
      SELECT id, code, name, is_active, currency, scope
      FROM public.ledgers
      WHERE id = ${input.providerAccountId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!providerLedger) {
      throw new ApiClientError(
        "The selected provider account was not found in Account Master. Please register it first.",
        { status: 404, code: "PROVIDER_ACCOUNT_NOT_FOUND" }
      );
    }
    if (providerLedger.is_active === false) {
      throw new ApiClientError(
        `The provider ledger account ${providerLedger.code} (${providerLedger.name}) is inactive.`,
        { status: 400, code: "PROVIDER_ACCOUNT_INACTIVE" }
      );
    }

    // 3b. The bill belongs to the external partner chosen on THIS leg — never another account.
    if (leg.partner_account_id && leg.partner_account_id !== input.providerAccountId) {
      throw new ApiClientError(
        `Leg ${leg.leg_no} is handled by ${leg.partner_name ?? "another partner"}; the bill must be raised on that partner's account.`,
        { status: 422, code: "PROVIDER_NOT_LEG_PARTNER" }
      );
    }

    // 4. Resolve expense account (if not explicitly chosen, find or fall back to standard clearing/freight expense)
    let expenseAccountId = input.expenseAccountId;
    if (!expenseAccountId) {
      const expenseLedgers = await sql`
        SELECT id FROM public.ledgers
        WHERE deleted_at IS NULL AND is_active = true
          AND (
            code IN ('4002', 'DEVTEST-CHM-SHIP-EXP', 'SHIP-EXP')
            OR lower(name) LIKE '%clearing charges%'
            OR lower(name) LIKE '%freight%'
          )
        ORDER BY (code = '4002') DESC
        LIMIT 1
      `;
      expenseAccountId = expenseLedgers[0]?.id ?? null;
    }

    const totalAmount = Number(input.totalAmount || 0);
    if (totalAmount <= 0) {
      throw new ApiClientError("Bill total amount must be greater than zero.", { status: 400, code: "INVALID_AMOUNT" });
    }

    const year = new Date().getFullYear();
    const countRows = await sql`SELECT count(*)::int AS c FROM public.clearing_payment_bills`;
    const serial = String((countRows[0]?.c || 0) + 1).padStart(4, "0");
    const autoBillNo = `CL-PARTNER-${year}-${serial}`;

    const countryOfService = input.countryOfService || leg.to_country_name || leg.from_country_name || "International";

    // 5. Insert bill with posting_status='unposted', payment_status='pending', remaining_balance=totalAmount
    const [bill] = await sql`
      INSERT INTO public.clearing_payment_bills (
        order_id, leg_id, country_id, country_branch_id, city_branch_id,
        bill_no, order_no, agent_name, provider_account_id, expense_account_id,
        invoice_ref, expense_category, country_of_service,
        customs_duty, port_charges, demurrage_charges, clearance_fee, freight_charges, other_charges,
        total_amount, paid_amount, remaining_balance, currency_code, exchange_rate,
        payment_status, posting_status, remarks, supporting_documents, is_active, status, created_by
      ) VALUES (
        ${input.orderId}::uuid, ${input.legId}::uuid,
        ${order.country_id}, ${order.country_branch_id}, ${order.city_branch_id},
        ${autoBillNo}, ${order.order_no},
        ${input.agentName.trim()}, ${input.providerAccountId}::uuid, ${expenseAccountId ? sql`${expenseAccountId}::uuid` : null},
        ${input.invoiceRef ? input.invoiceRef.trim() : null},
        ${input.expenseCategory || 'customs_clearance'},
        ${countryOfService},
        ${Number(input.customsDuty || 0)}, ${Number(input.portCharges || 0)},
        ${Number(input.demurrageCharges || 0)}, ${Number(input.clearanceFee || 0)},
        ${Number(input.freightCharges || 0)}, ${Number(input.otherCharges || 0)},
        ${totalAmount}, 0, ${totalAmount},
        ${input.currencyCode || 'USD'}, ${Number(input.exchangeRate || 1)},
        'pending', 'unposted',
        ${input.remarks || null},
        ${JSON.stringify(input.supportingDocuments || [])}::jsonb,
        true, 'active', ${actorId}::uuid
      )
      RETURNING *
    `;

    // 6. Update leg with partner attribution if not already set
    await sql`
      UPDATE public.clearing_customer_order_legs
      SET 
        handler_type = 'external_partner',
        partner_name = ${input.agentName.trim()},
        partner_account_id = ${input.providerAccountId}::uuid,
        partner_country_name = ${countryOfService},
        estimated_expense_amount = COALESCE(estimated_expense_amount, ${totalAmount}),
        actual_expense_amount = ${totalAmount},
        expense_currency = ${input.currencyCode || 'USD'},
        updated_at = now()
      WHERE id = ${input.legId}::uuid
    `;

    return bill;
  });
}

/**
 * Reviews and approves the provider bill, posting the expense to Roznamcha
 * (DR Expense Ledger / CR Provider Payable Ledger) at proper exchange rate.
 * Prevents duplicate posting.
 */
export async function approveAndPostPartnerBill(
  billId: string,
  actorId: string,
  sessionScope: { isSuperAdmin: boolean; countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }
) {
  const prepared = await withLocalPg(async (sql) => {
    const [bill] = await sql`
      SELECT b.*, o.order_no, o.customer_name
      FROM public.clearing_payment_bills b
      JOIN public.clearing_customer_orders o ON o.id = b.order_id
      WHERE b.id = ${billId}::uuid AND b.deleted_at IS NULL
      LIMIT 1
    `;
    if (!bill) {
      throw new ApiClientError("Partner bill not found.", { status: 404, code: "BILL_NOT_FOUND" });
    }

    if (bill.posting_status === "posted") {
      throw new ApiClientError("This bill has already been approved and posted to the journal.", {
        status: 409,
        code: "ALREADY_POSTED"
      });
    }

    if (Number(bill.total_amount) <= 0) {
      throw new ApiClientError("Bill amount must be positive to post.", { status: 400, code: "ZERO_AMOUNT" });
    }

    if (!bill.provider_account_id) {
      throw new ApiClientError("Provider account is required before posting.", { status: 400, code: "ACCOUNT_REQUIRED" });
    }

    // Verify provider ledger exists and is active
    const [providerLedger] = await sql`
      SELECT id, code, name, currency, scope, is_active
      FROM public.ledgers
      WHERE id = ${bill.provider_account_id}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!providerLedger || providerLedger.is_active === false) {
      throw new ApiClientError("Provider ledger account is missing or inactive in Account Master.", {
        status: 400,
        code: "INVALID_PROVIDER_ACCOUNT"
      });
    }

    // Resolve or verify expense ledger
    let expenseLedgerId = bill.expense_account_id;
    if (!expenseLedgerId) {
      const [defaultExpense] = await sql`
        SELECT id FROM public.ledgers
        WHERE deleted_at IS NULL AND is_active = true
          AND (code IN ('4002', 'DEVTEST-CHM-SHIP-EXP', 'SHIP-EXP') OR lower(name) LIKE '%clearing%')
        ORDER BY (code = '4002') DESC LIMIT 1
      `;
      if (!defaultExpense) {
        throw new ApiClientError("Expense ledger account not found. Please configure an expense account.", {
          status: 400,
          code: "EXPENSE_ACCOUNT_NOT_FOUND"
        });
      }
      expenseLedgerId = defaultExpense.id;
    }

    const [expenseLedger] = await sql`
      SELECT id, code, name, currency, scope
      FROM public.ledgers
      WHERE id = ${expenseLedgerId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;

    return { bill, providerLedger, expenseLedger };
  });

  if (!prepared) throw new Error("Failed to prepare partner bill for approval");
  const { bill, providerLedger, expenseLedger } = prepared;
  const billAmount = Number(bill.total_amount);
  const currency = bill.currency_code || "USD";
  const exchangeRate = Number(bill.exchange_rate || 1);
  const entryDate = new Date().toISOString().slice(0, 10);
  const uniq = Date.now().toString(36).toUpperCase().slice(-5);
  const billRef = bill.bill_no || bill.id.slice(0, 8);
  const journalNo = `PBILL-${billRef}-${uniq}`.slice(0, 118);
  const voucherNo = `PBILLV-${billRef}-${uniq}`.slice(0, 118);
  const narration = `Partner Bill Approval (${bill.agent_name}) on Order ${bill.order_no} [Ref: ${bill.invoice_ref || billRef}]`;

  // Post via Roznamcha engine:
  // DR Expense Ledger (Cost of Service)
  // CR Provider Payable Ledger (Liability)
  const roznamchaBody = {
    mode: "post" as const,
    type: "super_admin" as const,
    entryDate,
    journalNo,
    voucherNo,
    narration,
    referenceNo: billRef,
    roznamchaCategory: "shipping" as const,
    sourceModule: "clearing_payment_bills",
    sourceTransactionType: "partner_bill_expense",
    sourceTransactionId: bill.id,
    lines: [
      {
        ledgerId: expenseLedger.id,
        debit: billAmount,
        credit: 0,
        currency,
        exchangeRate,
        description: `Partner Service Expense: ${bill.expense_category} (${bill.agent_name})`,
        paymentEntryType: "debit" as const
      },
      {
        ledgerId: providerLedger.id,
        debit: 0,
        credit: billAmount,
        currency,
        exchangeRate,
        description: `Payable to Partner: ${bill.agent_name} [${bill.invoice_ref || billRef}]`,
        paymentEntryType: "credit" as const
      }
    ]
  };

  const { entryId } = await postRoznamchaWithErpSession({
    sessionUserId: actorId,
    body: roznamchaBody as never
  });

  // Update bill to posted status
  const updatedBill = await withLocalPg(async (sql) => {
    const [row] = await sql`
      UPDATE public.clearing_payment_bills
      SET
        posting_status = 'posted',
        expense_account_id = ${expenseLedger.id}::uuid,
        roznamcha_entry_id = ${entryId}::uuid,
        posted_at = now(),
        remaining_balance = ${billAmount},
        paid_amount = 0,
        payment_status = 'pending',
        updated_at = now()
      WHERE id = ${bill.id}::uuid
      RETURNING *
    `;
    return row;
  });

  return { ok: true, bill: updatedBill, roznamchaEntryId: entryId };
}

/**
 * Records a partial or full payment against an approved provider bill.
 * Validates:
 * - Bill is posted
 * - Amount > 0
 * - Amount <= remaining_balance (prevents overpayment!)
 * - Payment account is active and distinct from provider account
 * Posts payment journal entry:
 * - DR Provider Payable Ledger (reducing liability)
 * - CR Cash/Bank Ledger (reducing cash asset)
 * Automatically updates paid_amount, remaining_balance, and payment_status.
 */
export async function recordPartnerBillPayment(
  input: PartnerPaymentInput,
  actorId: string
) {
  const prepared = await withLocalPg(async (sql) => {
    const [bill] = await sql`
      SELECT b.*, o.order_no
      FROM public.clearing_payment_bills b
      JOIN public.clearing_customer_orders o ON o.id = b.order_id
      WHERE b.id = ${input.billId}::uuid AND b.deleted_at IS NULL
      LIMIT 1
    `;
    if (!bill) {
      throw new ApiClientError("Partner bill not found.", { status: 404, code: "BILL_NOT_FOUND" });
    }

    if (bill.posting_status !== "posted") {
      throw new ApiClientError("Bill must be approved and posted before recording payments.", {
        status: 400,
        code: "BILL_NOT_POSTED"
      });
    }

    const paymentAmount = Number(input.amount);
    if (!paymentAmount || paymentAmount <= 0) {
      throw new ApiClientError("Payment amount must be greater than zero.", { status: 400, code: "INVALID_AMOUNT" });
    }

    const remaining = Number(bill.remaining_balance ?? (Number(bill.total_amount) - Number(bill.paid_amount || 0)));
    if (paymentAmount > remaining) {
      throw new ApiClientError(
        `Payment amount (${paymentAmount.toLocaleString()}) exceeds the outstanding balance (${remaining.toLocaleString()}). Payment prevented.`,
        { status: 400, code: "OVERPAYMENT_PREVENTED" }
      );
    }

    if (input.paymentAccountId === bill.provider_account_id) {
      throw new ApiClientError("Payment account cannot be the same as the provider payable account.", {
        status: 400,
        code: "SAME_ACCOUNT"
      });
    }

    const [payAccount] = await sql`
      SELECT id, code, name, currency, is_active
      FROM public.ledgers
      WHERE id = ${input.paymentAccountId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!payAccount || payAccount.is_active === false) {
      throw new ApiClientError("Payment account (bank/cash) is invalid or inactive.", {
        status: 400,
        code: "INVALID_PAYMENT_ACCOUNT"
      });
    }

    const [providerLedger] = await sql`
      SELECT id, code, name, currency
      FROM public.ledgers
      WHERE id = ${bill.provider_account_id}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;

    const countRows = await sql`
      SELECT count(*)::int AS c FROM public.clearing_payment_bill_payments WHERE bill_id = ${bill.id}::uuid
    `;
    const nextSerial = (countRows[0]?.c || 0) + 1;

    return { bill, paymentAmount, remaining, payAccount, providerLedger, nextSerial };
  });

  if (!prepared) throw new Error("Failed to prepare partner bill payment");
  const { bill, paymentAmount, remaining, payAccount, providerLedger, nextSerial } = prepared;
  const currency = bill.currency_code || "USD";
  const exchangeRate = Number(bill.exchange_rate || 1);
  const paymentDate = input.paymentDate || new Date().toISOString().slice(0, 10);
  const uniq = Date.now().toString(36).toUpperCase().slice(-5);
  const paymentId = randomUUID();
  const paymentNo = `PAY-${bill.bill_no || bill.id.slice(0, 8)}-#${nextSerial}`;
  const journalNo = `PBAY-${bill.bill_no}-${nextSerial}-${uniq}`.slice(0, 118);
  const voucherNo = `PBAYV-${bill.bill_no}-${nextSerial}-${uniq}`.slice(0, 118);
  const narration =
    input.narration ||
    `Payment #${nextSerial} to ${bill.agent_name} for Bill ${bill.bill_no} (Order ${bill.order_no}) [Paid via ${payAccount.name}]`;

  // Post payment journal entry:
  // DR Provider Payable Ledger (clearing liability)
  // CR Cash/Bank Ledger (asset reduction)
  const roznamchaBody = {
    mode: "post" as const,
    type: "super_admin" as const,
    entryDate: paymentDate,
    journalNo,
    voucherNo,
    narration,
    referenceNo: input.referenceNo || paymentNo,
    roznamchaCategory: "shipping" as const,
    sourceModule: "clearing_payment_bill_payments",
    sourceTransactionType: "partner_bill_payment",
    sourceTransactionId: paymentId,
    lines: [
      {
        ledgerId: providerLedger.id,
        debit: paymentAmount,
        credit: 0,
        currency,
        exchangeRate,
        description: `Settlement of ${bill.bill_no} payable to ${bill.agent_name}`,
        paymentEntryType: "debit" as const
      },
      {
        ledgerId: payAccount.id,
        debit: 0,
        credit: paymentAmount,
        currency,
        exchangeRate,
        description: `Disbursement for bill ${bill.bill_no}`,
        paymentEntryType: "credit" as const
      }
    ]
  };

  const { entryId } = await postRoznamchaWithErpSession({
    sessionUserId: actorId,
    body: roznamchaBody as never
  });

  // Insert payment record
  const result = await withLocalPg(async (sql) => {
    const [payment] = await sql`
      INSERT INTO public.clearing_payment_bill_payments (
        id, bill_id, order_id, leg_id, payment_serial, payment_no,
        payment_date, amount, currency_code, exchange_rate,
        provider_account_id, payment_account_id, payment_method,
        reference_no, narration, roznamcha_entry_id, created_by
      ) VALUES (
        ${paymentId}::uuid, ${bill.id}::uuid, ${bill.order_id}::uuid, ${bill.leg_id ? sql`${bill.leg_id}::uuid` : null},
        ${nextSerial}, ${paymentNo}, ${paymentDate}, ${paymentAmount},
        ${currency}, ${exchangeRate},
        ${providerLedger.id}::uuid, ${payAccount.id}::uuid,
        ${input.paymentMethod || 'bank_transfer'},
        ${input.referenceNo || null}, ${narration},
        ${entryId}::uuid, ${actorId}::uuid
      )
      RETURNING *
    `;

    // Fetch updated bill with new balance
    const [updatedBill] = await sql`
      SELECT * FROM public.clearing_payment_bills WHERE id = ${bill.id}::uuid
    `;

    return { payment, bill: updatedBill };
  });

  if (!result) throw new Error("Payment record failed");

  return {
    ok: true,
    payment: result.payment,
    bill: result.bill,
    roznamchaEntryId: entryId
  };
}
