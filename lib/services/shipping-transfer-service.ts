import { withLocalPg } from "@/lib/db/local-postgres";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/route";
import type { ErpSession } from "@/lib/auth/session";

/**
 * Inter-country / inter-branch Shipping expense transfer service.
 *
 * A transfer is an APPROVAL/hand-off record — it does NOT post anything on creation. On acceptance
 * it posts once into the EXISTING Roznamcha/Journal/Ledger engine (postRoznamchaWithErpSession)
 * using the receiving office's own CoA ledger selections (debit/credit ledger ids passed in) — no
 * hard-coded DR/CR pair, no second cashbook. Acceptance is idempotent: pressing Accept twice can
 * never create a second posting.
 */

export type CreateShippingTransferInput = {
  session: ErpSession;
  sourceTable: string;
  sourceId: string;
  sourceReferenceNo?: string | null;
  sourceLedgerId?: string | null;
  clearingAgentId?: string | null;
  origin: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null };
  destination: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null };
  amount: number;
  currencyCode: string;
  exchangeRate?: number;
  category?: string | null;
  blReference?: string | null;
  supportingDocument?: string | null;
  transferNo?: string | null;
};

export async function createShippingTransfer(input: CreateShippingTransferInput): Promise<{ id: string; transferNo: string }> {
  const transferNo = input.transferNo || `SHTR-${Date.now().toString(36).toUpperCase()}`;
  const row = await withLocalPg(async (sql) => {
    const r = await sql`
      insert into public.shipping_expense_transfers
        (transfer_no, source_table, source_id, source_reference_no, source_ledger_id, clearing_agent_id,
         origin_country_id, origin_country_branch_id, origin_city_branch_id,
         dest_country_id, dest_country_branch_id, dest_city_branch_id,
         amount, currency_code, exchange_rate, category, bl_reference, supporting_document,
         status, created_by)
      values
        (${transferNo}, ${input.sourceTable}, ${input.sourceId}, ${input.sourceReferenceNo ?? null}, ${input.sourceLedgerId ?? null}, ${input.clearingAgentId ?? null},
         ${input.origin.countryId ?? null}, ${input.origin.countryBranchId ?? null}, ${input.origin.cityBranchId ?? null},
         ${input.destination.countryId ?? null}, ${input.destination.countryBranchId ?? null}, ${input.destination.cityBranchId ?? null},
         ${input.amount}, ${input.currencyCode}, ${input.exchangeRate ?? 1}, ${input.category ?? null}, ${input.blReference ?? null}, ${input.supportingDocument ?? null},
         'pending', ${input.session.userId})
      returning id, transfer_no`;
    return r[0];
  });
  if (!row) throw new Error("Failed to create shipping transfer (no local DB).");
  return { id: row.id as string, transferNo: row.transfer_no as string };
}

export type AcceptShippingTransferInput = {
  session: ErpSession;
  transferId: string;
  debitLedgerId: string;   // receiving office's own CoA account (no hard-coded DR/CR)
  creditLedgerId: string;
  note?: string | null;
};

export async function acceptShippingTransfer(
  input: AcceptShippingTransferInput
): Promise<{ status: "accepted" | "already_accepted"; entryId: string; transferNo: string }> {
  // 1) Atomic claim: only the FIRST accept flips pending -> accepted. This is the idempotency gate:
  //    a concurrent/second accept fails to claim and returns the existing posting instead.
  const claimed = await withLocalPg(async (sql) => {
    const r = await sql`
      update public.shipping_expense_transfers
         set status = 'accepted', decided_by = ${input.session.userId}, decided_at = now(), updated_at = now(),
             accepted_debit_ledger_id = ${input.debitLedgerId}, accepted_credit_ledger_id = ${input.creditLedgerId},
             decision_note = ${input.note ?? null}
       where id = ${input.transferId} and status = 'pending' and deleted_at is null
       returning *`;
    return r[0] ?? null;
  });

  if (!claimed) {
    // Already processed — return the existing posting (idempotent), or reject if not accepted.
    const existing = await withLocalPg((sql) => sql`
      select status, transfer_no, accepted_roznamcha_entry_id
        from public.shipping_expense_transfers where id = ${input.transferId} and deleted_at is null`);
    const e = existing?.[0];
    if (e?.status === "accepted" && e.accepted_roznamcha_entry_id) {
      return { status: "already_accepted", entryId: e.accepted_roznamcha_entry_id as string, transferNo: e.transfer_no as string };
    }
    throw new Error("Transfer is not pending (already decided or missing).");
  }

  // 2) Post ONCE into the existing Roznamcha/Ledger engine at the DESTINATION scope, using the
  //    receiving office's selected DR/CR ledgers. One underlying transaction — not a second cashbook.
  try {
    const posted = await postRoznamchaWithErpSession({
      sessionUserId: input.session.userId,
      session: input.session,
      body: {
        type: "branch",
        countryId: claimed.dest_country_id,
        countryBranchId: claimed.dest_country_branch_id,
        cityBranchId: claimed.dest_city_branch_id,
        entryDate: new Date().toISOString().slice(0, 10),
        journalNo: `SHTR-${claimed.transfer_no}`,
        voucherNo: `VCH-${claimed.transfer_no}`,
        narration: `Shipping expense transfer ${claimed.transfer_no} (${claimed.source_reference_no ?? claimed.source_id})`,
        referenceNo: claimed.transfer_no,
        lines: [
          {
            ledgerId: input.debitLedgerId,
            debit: Number(claimed.amount),
            credit: 0,
            currency: claimed.currency_code,
            exchangeRate: Number(claimed.exchange_rate) || 1,
            description: claimed.category ?? "Shipping expense",
            paymentEntryType: "transfer"
          },
          {
            ledgerId: input.creditLedgerId,
            debit: 0,
            credit: Number(claimed.amount),
            currency: claimed.currency_code,
            exchangeRate: Number(claimed.exchange_rate) || 1,
            description: "Shipping transfer settlement",
            paymentEntryType: "transfer"
          }
        ]
      } as any
    });
    const entryId = posted.entryId;
    await withLocalPg((sql) => sql`
      update public.shipping_expense_transfers
         set accepted_roznamcha_entry_id = ${entryId}, updated_at = now()
       where id = ${input.transferId}`);
    return { status: "accepted", entryId, transferNo: claimed.transfer_no as string };
  } catch (err) {
    // Posting failed after the claim — revert to pending so it can be retried (no orphan "accepted").
    await withLocalPg((sql) => sql`
      update public.shipping_expense_transfers
         set status = 'pending', accepted_roznamcha_entry_id = null, updated_at = now()
       where id = ${input.transferId} and accepted_roznamcha_entry_id is null`);
    throw err;
  }
}

export async function decideShippingTransferReject(input: {
  session: ErpSession;
  transferId: string;
  action: "rejected" | "returned";
  note?: string | null;
}): Promise<{ status: string }> {
  const row = await withLocalPg(async (sql) => {
    const r = await sql`
      update public.shipping_expense_transfers
         set status = ${input.action}, decided_by = ${input.session.userId}, decided_at = now(),
             decision_note = ${input.note ?? null}, updated_at = now()
       where id = ${input.transferId} and status = 'pending' and deleted_at is null
       returning status`;
    return r[0] ?? null;
  });
  if (!row) throw new Error("Transfer is not pending (already decided or missing).");
  return { status: row.status as string };
}
