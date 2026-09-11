import { withLocalPg } from "@/lib/db/local-postgres";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/posting";
import { ensureCustomerShippingLedger, ensureUnallocatedSuspenseLedger } from "@/lib/services/clearing-bill-customer-charge-service";

export interface CustomerReceiptAllocationInput {
  domain: "business" | "shipping" | "unallocated";
  amount: number;
  targetLedgerId?: string | null; // required for 'business' (caller resolves the existing business AR ledger); resolved automatically for 'shipping'/'unallocated'
  referenceType?: string | null;
  referenceId?: string | null;
  remarks?: string | null;
}

export interface CreateCustomerReceiptInput {
  customerId: string;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  receiptDate?: string;
  currencyCode?: string;
  amount: number;
  paymentMethod?: string;
  bankId?: string | null;
  cashLedgerId: string;
  allocationType: "business" | "shipping" | "split" | "unallocated";
  allocations: CustomerReceiptAllocationInput[];
  remarks?: string | null;
  createdBy?: string | null;
}

function assertAllocationsBalance(input: CreateCustomerReceiptInput) {
  const sum = input.allocations.reduce((acc, a) => acc + Number(a.amount || 0), 0);
  if (Math.abs(sum - Number(input.amount)) > 0.0001) {
    throw new Error(`Allocation amounts (${sum}) must sum to the receipt total (${input.amount}).`);
  }
  const expectedCount = input.allocationType === "split" ? 2 : 1;
  if (input.allocations.length !== expectedCount) {
    throw new Error(`allocation_type '${input.allocationType}' requires exactly ${expectedCount} allocation row(s).`);
  }
  if (input.allocationType !== "split" && input.allocations[0]?.domain !== input.allocationType) {
    throw new Error(`allocation_type '${input.allocationType}' requires a matching single allocation domain.`);
  }
}

export async function createReceipt(input: CreateCustomerReceiptInput) {
  assertAllocationsBalance(input);
  return withLocalPg(async (sql) => {
    await sql`BEGIN`;
    try {
      const receiptRows = await sql`
        INSERT INTO public.customer_receipts
          (customer_id, country_id, country_branch_id, city_branch_id, receipt_date, currency_code,
           amount, payment_method, bank_id, cash_ledger_id, allocation_type, remarks, created_by)
        VALUES
          (${input.customerId}, ${input.countryId ?? null}, ${input.countryBranchId ?? null}, ${input.cityBranchId ?? null},
           ${input.receiptDate ?? new Date().toISOString().slice(0, 10)}, ${input.currencyCode ?? "USD"},
           ${input.amount}, ${input.paymentMethod ?? "cash"}, ${input.bankId ?? null}, ${input.cashLedgerId},
           ${input.allocationType}, ${input.remarks ?? null}, ${input.createdBy ?? null})
        RETURNING *
      `;
      const receipt = receiptRows[0];

      for (const alloc of input.allocations) {
        await sql`
          INSERT INTO public.customer_receipt_allocations
            (receipt_id, domain, amount, target_ledger_id, reference_type, reference_id, remarks)
          VALUES
            (${receipt.id}, ${alloc.domain}, ${alloc.amount}, ${alloc.targetLedgerId ?? "00000000-0000-0000-0000-000000000000"},
             ${alloc.referenceType ?? null}, ${alloc.referenceId ?? null}, ${alloc.remarks ?? null})
        `;
      }

      await sql`COMMIT`;
      return receipt;
    } catch (e) {
      await sql`ROLLBACK`;
      throw e;
    }
  });
}

/**
 * Post a receipt: 1 debit line (cash/bank) + 1-2 credit lines resolved from
 * customer_receipt_allocations. 'shipping' and 'unallocated' allocation
 * ledgers are resolved/created here (check-before-create, same helpers the
 * bill customer-charge service uses); 'business' allocations must already
 * carry a real target_ledger_id (the customer's existing business AR ledger,
 * resolved by the caller — this service never creates business-side accounts).
 */
export async function postReceipt(
  receiptId: string,
  actorId: string,
  scope: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }
) {
  const { receipt, allocations } = await withLocalPg(async (sql) => {
    const [receipt] = await sql`SELECT * FROM public.customer_receipts WHERE id = ${receiptId} AND deleted_at IS NULL LIMIT 1`;
    const allocations = receipt
      ? await sql`SELECT * FROM public.customer_receipt_allocations WHERE receipt_id = ${receiptId} ORDER BY created_at ASC`
      : [];
    return { receipt, allocations };
  }).then((v) => v ?? { receipt: null, allocations: [] });

  if (!receipt) throw new Error("Receipt not found.");
  if (receipt.status === "posted") throw new Error("This receipt is already posted.");
  if (Number(receipt.amount) <= 0) throw new Error("A zero-amount receipt cannot be posted.");

  const creditLines: Array<{ ledgerId: string; amount: number; description: string }> = [];
  for (const alloc of allocations) {
    if (alloc.domain === "shipping") {
      const ledgerId = await ensureCustomerShippingLedger(receipt.customer_id, scope, actorId);
      creditLines.push({ ledgerId, amount: Number(alloc.amount), description: "Receipt allocated to Shipping AR" });
    } else if (alloc.domain === "unallocated") {
      const ledgerId = await ensureUnallocatedSuspenseLedger(actorId);
      creditLines.push({ ledgerId, amount: Number(alloc.amount), description: "Receipt pending allocation" });
    } else {
      // 'business' — the caller-resolved existing business AR ledger, never created here.
      if (!alloc.target_ledger_id || alloc.target_ledger_id === "00000000-0000-0000-0000-000000000000") {
        throw new Error("A business-domain allocation requires an existing business AR ledger id.");
      }
      creditLines.push({ ledgerId: alloc.target_ledger_id, amount: Number(alloc.amount), description: "Receipt allocated to Business AR" });
    }
  }

  const entryDate = new Date().toISOString().slice(0, 10);
  const uniq = Date.now().toString(36).toUpperCase().slice(-5);
  const receiptRef = receipt.receipt_no || receipt.id.slice(0, 8);
  const journalNo = `SHPR-${receiptRef}-${uniq}`.slice(0, 118);
  const voucherNo = `SHPRV-${receiptRef}-${uniq}`.slice(0, 118);
  const hasShipping = allocations.some((a: any) => a.domain === "shipping" || a.domain === "unallocated");

  // type: "super_admin" is a deliberate wildcard here (isLedgerScopeCompatible
  // treats it as compatible with ANY ledger scope) — a receipt's debit side is
  // a real branch-scoped cash/bank ledger the user picked, while shipping/
  // unallocated credit sides are the shared control ledgers from
  // clearing-bill-customer-charge-service.ts (super_admin scope); a
  // country/branch-type entry would reject whichever side doesn't match its
  // own scope. The order/receipt's real scope is still enforced separately
  // via authorizeApiScope before this service is called.
  const { entryId } = await postRoznamchaWithErpSession({
    sessionUserId: actorId,
    body: {
      mode: "post",
      type: "super_admin",
      entryDate,
      journalNo,
      voucherNo,
      narration: `Customer receipt (${receipt.allocation_type})` + (receipt.remarks ? ` — ${receipt.remarks}` : ""),
      referenceNo: receiptRef,
      roznamchaCategory: hasShipping ? "shipping" : "business",
      sourceModule: "customer_receipts",
      sourceTransactionType: "customer_receipt",
      sourceTransactionId: receipt.id,
      lines: [
        {
          ledgerId: receipt.cash_ledger_id,
          debit: Number(receipt.amount),
          credit: 0,
          currency: receipt.currency_code,
          exchangeRate: 1,
          description: "Customer receipt received",
          paymentEntryType: "debit"
        },
        ...creditLines.map((c) => ({
          ledgerId: c.ledgerId,
          debit: 0,
          credit: c.amount,
          currency: receipt.currency_code,
          exchangeRate: 1,
          description: c.description,
          paymentEntryType: "credit" as const
        }))
      ]
    } as never
  });

  await withLocalPg(async (sql) => {
    await sql`
      UPDATE public.customer_receipts
      SET status = 'posted', roznamcha_entry_id = ${entryId}, updated_at = now()
      WHERE id = ${receiptId}
    `;
    for (const c of creditLines) {
      // Backfill resolved ledger ids for shipping/unallocated allocations so
      // the Combined Customer Statement can join without re-resolving.
      await sql`
        UPDATE public.customer_receipt_allocations
        SET target_ledger_id = ${c.ledgerId}
        WHERE receipt_id = ${receiptId} AND target_ledger_id = '00000000-0000-0000-0000-000000000000'
      `;
    }
  });

  return { entryId, amount: Number(receipt.amount), currency: receipt.currency_code };
}
