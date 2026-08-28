import { withLocalPg } from "@/lib/db/local-postgres";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/posting";
import type { ErpSession } from "@/lib/auth/session";

/**
 * Inter-Country Transfer Service
 *
 * Handles transfers between two different Countries (e.g. UAE → Pakistan).
 * Uses the EXISTING Roznamcha/Journal/Ledger posting engine.
 * Acceptance is idempotent — pressing Accept twice can never create a second posting.
 * Supports Edit (receiving side can correct party/ledger before accepting),
 * Accept and Reject/Return with mandatory reason.
 */

export type CreateInterCountryTransferInput = {
  session: ErpSession;
  sourceCountryId: string;
  sourceCountryBranchId?: string | null;
  sourceCityBranchId?: string | null;
  sourceBankCashLedgerId?: string | null;
  sourcePartyLedgerId?: string | null;
  destCountryId: string;
  destCountryBranchId?: string | null;
  destCityBranchId?: string | null;
  destBankCashLedgerId?: string | null;
  destPartyLedgerId?: string | null;
  amount: number;
  originalCurrency: string;
  exchangeRate: number;
  finalCurrency: string;
  finalAmount: number;
  direction: "debit" | "credit";
  narration?: string | null;
  remarks?: string | null;
  idempotencyKey?: string | null;
};

export type AcceptInterCountryTransferInput = {
  session: ErpSession;
  transferId: string;
  debitLedgerId: string;
  creditLedgerId: string;
  note?: string | null;
};

export type RejectInterCountryTransferInput = {
  session: ErpSession;
  transferId: string;
  reason: string;
};

export type EditReceivingLedgerInput = {
  session: ErpSession;
  transferId: string;
  destBankCashLedgerId?: string | null;
  destPartyLedgerId?: string | null;
};

function generateTransferNo(): string {
  return `ICT-${Date.now().toString(36).toUpperCase()}`;
}

function generateGlobalRefId(): string {
  return `GREF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createInterCountryTransfer(
  input: CreateInterCountryTransferInput
): Promise<{ id: string; transferNo: string; globalReferenceId: string }> {
  const transferNo = generateTransferNo();
  const globalRefId = generateGlobalRefId();

  // 1. Create the transfer record
  const row = await withLocalPg(async (sql) => {
    const r = await sql`
      insert into public.inter_country_transfers (
        transfer_no, source_country_id, source_country_branch_id, source_city_branch_id,
        source_bank_cash_ledger_id, source_party_ledger_id,
        dest_country_id, dest_country_branch_id, dest_city_branch_id,
        dest_bank_cash_ledger_id, dest_party_ledger_id,
        amount, original_currency, exchange_rate, final_currency, final_amount, direction,
        narration, remarks, status, idempotency_key, global_reference_id,
        sender_user_id, created_by
      ) values (
        ${transferNo}, ${input.sourceCountryId}, ${input.sourceCountryBranchId ?? null}, ${input.sourceCityBranchId ?? null},
        ${input.sourceBankCashLedgerId ?? null}, ${input.sourcePartyLedgerId ?? null},
        ${input.destCountryId}, ${input.destCountryBranchId ?? null}, ${input.destCityBranchId ?? null},
        ${input.destBankCashLedgerId ?? null}, ${input.destPartyLedgerId ?? null},
        ${input.amount}, ${input.originalCurrency}, ${input.exchangeRate}, ${input.finalCurrency}, ${input.finalAmount}, ${input.direction},
        ${input.narration ?? null}, ${input.remarks ?? null}, 'pending',
        ${input.idempotencyKey ?? null}, ${globalRefId},
        ${input.session.userId}, ${input.session.userId}
      )
      returning id, transfer_no`;
    return r[0];
  });

  if (!row) throw new Error("Failed to create inter-country transfer.");

  // 2. Post sending-side via existing Roznamcha engine
  if (input.sourceBankCashLedgerId && input.sourcePartyLedgerId) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const lines = [
        {
          ledgerId: input.sourcePartyLedgerId,
          debit: input.direction === "debit" ? input.amount : 0,
          credit: input.direction === "credit" ? input.amount : 0,
          currency: input.originalCurrency,
          usdRate: input.exchangeRate,
          usdAmount: input.finalAmount,
          description: `Inter-Country Transfer to ${input.destCountryId} - ${transferNo}`,
        },
        {
          ledgerId: input.sourceBankCashLedgerId,
          debit: input.direction === "credit" ? input.amount : 0,
          credit: input.direction === "debit" ? input.amount : 0,
          currency: input.originalCurrency,
          usdRate: input.exchangeRate,
          usdAmount: input.finalAmount,
          description: `Inter-Country Transfer to ${input.destCountryId} - ${transferNo}`,
        },
      ];

      const result = await postRoznamchaWithErpSession({
        sessionUserId: input.session.userId,
        session: input.session,
        body: {
          mode: "post",
          type: "country",
          countryId: input.sourceCountryId,
          countryBranchId: input.sourceCountryBranchId ?? undefined,
          cityBranchId: input.sourceCityBranchId ?? undefined,
          entryDate: today,
          journalNo: `JRN-${transferNo}`,
          voucherNo: `VCH-${transferNo}`,
          narration: input.narration || `Inter-Country Transfer ${transferNo}`,
          lines,
          sourceModule: "inter_country_transfer",
          sourceTransactionType: "send",
          sourceTransactionId: row.id as string,
          sourceReferenceNo: transferNo,
          originalLanguage: "en",
        } as any,
      });

      // Link the roznamcha entry back to the transfer
      if (result?.entryId) {
        await withLocalPg(async (sql) => {
          await sql`
            update public.inter_country_transfers
            set sender_roznamcha_entry_id = ${result.entryId}, updated_at = now()
            where id = ${row.id}`;
        });
      }
    } catch (err: any) {
      console.error(`[inter-country-transfer] Sending-side posting failed for ${transferNo}:`, err?.message);
      // Transfer record exists but posting failed — admin can re-post manually
    }
  }

  // 3. Record audit
  await withLocalPg(async (sql) => {
    await sql`
      insert into public.erp_activity_events (actor_id, action, resource, record_table, record_id, country_id, metadata)
      values (${input.session.userId}, 'create', 'inter_country_transfer', 'inter_country_transfers', ${row.id}::uuid,
              ${input.sourceCountryId}::uuid, ${JSON.stringify({ transferNo, amount: input.amount, currency: input.originalCurrency, destCountry: input.destCountryId })}::jsonb)`;
  });

  return { id: row.id as string, transferNo: row.transfer_no as string, globalReferenceId: globalRefId };
}


// ─── ACCEPT ──────────────────────────────────────────────────────────────────

export async function acceptInterCountryTransfer(
  input: AcceptInterCountryTransferInput
): Promise<{ status: "accepted" | "already_accepted"; entryId: string; transferNo: string }> {
  // 1. Atomic claim: only the FIRST accept flips pending → accepted
  const claimed = await withLocalPg(async (sql) => {
    const r = await sql`
      update public.inter_country_transfers
        set status = 'accepted', accepted_by = ${input.session.userId}, accepted_at = now(),
            receiver_user_id = ${input.session.userId}, updated_at = now()
      where id = ${input.transferId} and status = 'pending' and deleted_at is null
      returning *`;
    return r[0] ?? null;
  });

  if (!claimed) {
    // Already accepted or doesn't exist — check for existing posting
    const existing = await withLocalPg(async (sql) => {
      const r = await sql`
        select id, transfer_no, receiver_roznamcha_entry_id
        from public.inter_country_transfers where id = ${input.transferId} and deleted_at is null limit 1`;
      return r[0] ?? null;
    });

    if (existing?.receiver_roznamcha_entry_id) {
      return { status: "already_accepted", entryId: existing.receiver_roznamcha_entry_id as string, transferNo: existing.transfer_no as string };
    }
    throw new Error("Transfer not found or already processed.");
  }

  // 2. Post receiving-side via existing Roznamcha engine
  const today = new Date().toISOString().slice(0, 10);
  const transferNo = claimed.transfer_no as string;
  const amount = Number(claimed.amount);
  const currency = claimed.original_currency as string;

  const lines = [
    {
      ledgerId: input.debitLedgerId,
      debit: amount,
      credit: 0,
      currency,
      usdRate: Number(claimed.exchange_rate || 1),
      usdAmount: Number(claimed.final_amount || amount),
      description: `Inter-Country Transfer received from ${claimed.source_country_id} - ${transferNo}`,
    },
    {
      ledgerId: input.creditLedgerId,
      debit: 0,
      credit: amount,
      currency,
      usdRate: Number(claimed.exchange_rate || 1),
      usdAmount: Number(claimed.final_amount || amount),
      description: `Inter-Country Transfer received from ${claimed.source_country_id} - ${transferNo}`,
    },
  ];

  const result = await postRoznamchaWithErpSession({
    sessionUserId: input.session.userId,
    session: input.session,
    body: {
      mode: "post",
      type: "country",
      countryId: claimed.dest_country_id as string,
      countryBranchId: (claimed.dest_country_branch_id as string) || undefined,
      cityBranchId: (claimed.dest_city_branch_id as string) || undefined,
      entryDate: today,
      journalNo: `JRN-RCV-${transferNo}`,
      voucherNo: `VCH-RCV-${transferNo}`,
      narration: input.note || `Received Inter-Country Transfer ${transferNo}`,
      lines,
      sourceModule: "inter_country_transfer",
      sourceTransactionType: "accept",
      sourceTransactionId: input.transferId,
      sourceReferenceNo: transferNo,
      originalLanguage: "en",
    } as any,
  });

  const entryId = result?.entryId || "";

  // 3. Link the posting back to the transfer
  await withLocalPg(async (sql) => {
    await sql`
      update public.inter_country_transfers
      set receiver_roznamcha_entry_id = ${entryId || null}, updated_at = now()
      where id = ${input.transferId}`;
  });

  // 4. Record audit
  await withLocalPg(async (sql) => {
    await sql`
      insert into public.erp_activity_events (actor_id, action, resource, record_table, record_id, country_id, metadata)
      values (${input.session.userId}, 'accept', 'inter_country_transfer', 'inter_country_transfers', ${input.transferId}::uuid,
              ${claimed.dest_country_id}::uuid, ${JSON.stringify({ transferNo, note: input.note })}::jsonb)`;
  });

  return { status: "accepted", entryId, transferNo };
}


// ─── REJECT ──────────────────────────────────────────────────────────────────

export async function rejectInterCountryTransfer(
  input: RejectInterCountryTransferInput
): Promise<{ status: "rejected"; transferNo: string }> {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("A reason is required when rejecting a transfer.");
  }

  const result = await withLocalPg(async (sql) => {
    const r = await sql`
      update public.inter_country_transfers
        set status = 'rejected', rejection_reason = ${input.reason},
            rejected_by = ${input.session.userId}, rejected_at = now(),
            receiver_user_id = ${input.session.userId}, updated_at = now()
      where id = ${input.transferId} and status = 'pending' and deleted_at is null
      returning transfer_no, dest_country_id`;
    return r[0] ?? null;
  });

  if (!result) throw new Error("Transfer not found or already processed.");

  // Record audit
  await withLocalPg(async (sql) => {
    await sql`
      insert into public.erp_activity_events (actor_id, action, resource, record_table, record_id, country_id, metadata)
      values (${input.session.userId}, 'reject', 'inter_country_transfer', 'inter_country_transfers', ${input.transferId}::uuid,
              ${result.dest_country_id}::uuid, ${JSON.stringify({ transferNo: result.transfer_no, reason: input.reason })}::jsonb)`;
  });

  return { status: "rejected", transferNo: result.transfer_no as string };
}


// ─── EDIT RECEIVING LEDGER ───────────────────────────────────────────────────

export async function editReceivingLedger(
  input: EditReceivingLedgerInput
): Promise<{ status: "updated" }> {
  const existing = await withLocalPg(async (sql) => {
    const r = await sql`
      select id, status, dest_bank_cash_ledger_id, dest_party_ledger_id, edit_history
      from public.inter_country_transfers
      where id = ${input.transferId} and status = 'pending' and deleted_at is null
      limit 1`;
    return r[0] ?? null;
  });

  if (!existing) throw new Error("Transfer not found or not in pending status.");

  const editHistory = Array.isArray(existing.edit_history) ? existing.edit_history : [];
  editHistory.push({
    editedBy: input.session.userId,
    editedAt: new Date().toISOString(),
    before: {
      destBankCashLedgerId: existing.dest_bank_cash_ledger_id,
      destPartyLedgerId: existing.dest_party_ledger_id,
    },
    after: {
      destBankCashLedgerId: input.destBankCashLedgerId,
      destPartyLedgerId: input.destPartyLedgerId,
    },
  });

  await withLocalPg(async (sql) => {
    await sql`
      update public.inter_country_transfers
        set dest_bank_cash_ledger_id = ${input.destBankCashLedgerId ?? null},
            dest_party_ledger_id = ${input.destPartyLedgerId ?? null},
            edit_history = ${JSON.stringify(editHistory)}::jsonb,
            updated_at = now()
      where id = ${input.transferId}`;
  });

  return { status: "updated" };
}


// ─── LIST ────────────────────────────────────────────────────────────────────

export async function listInterCountryTransfers(filters: {
  countryId?: string | null;
  status?: string | null;
  direction?: "sent" | "received" | null;
  limit?: number;
  offset?: number;
}): Promise<{ transfers: any[]; total: number }> {
  const result = await withLocalPg(async (sql) => {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    let rows: any[];
    let countRows: any[];

    if (filters.direction === "received" && filters.countryId) {
      rows = await sql`
        select t.*, sc.name as source_country_name, dc.name as dest_country_name,
               sp.full_name as sender_name, rp.full_name as receiver_name
        from public.inter_country_transfers t
        left join public.countries sc on sc.id = t.source_country_id
        left join public.countries dc on dc.id = t.dest_country_id
        left join public.profiles sp on sp.id = t.sender_user_id
        left join public.profiles rp on rp.id = t.receiver_user_id
        where t.dest_country_id = ${filters.countryId}
          and t.deleted_at is null
          ${filters.status ? sql`and t.status = ${filters.status}` : sql``}
        order by t.created_at desc
        limit ${limit} offset ${offset}`;
      countRows = await sql`
        select count(*)::int as total from public.inter_country_transfers t
        where t.dest_country_id = ${filters.countryId} and t.deleted_at is null
          ${filters.status ? sql`and t.status = ${filters.status}` : sql``}`;
    } else if (filters.direction === "sent" && filters.countryId) {
      rows = await sql`
        select t.*, sc.name as source_country_name, dc.name as dest_country_name,
               sp.full_name as sender_name, rp.full_name as receiver_name
        from public.inter_country_transfers t
        left join public.countries sc on sc.id = t.source_country_id
        left join public.countries dc on dc.id = t.dest_country_id
        left join public.profiles sp on sp.id = t.sender_user_id
        left join public.profiles rp on rp.id = t.receiver_user_id
        where t.source_country_id = ${filters.countryId}
          and t.deleted_at is null
          ${filters.status ? sql`and t.status = ${filters.status}` : sql``}
        order by t.created_at desc
        limit ${limit} offset ${offset}`;
      countRows = await sql`
        select count(*)::int as total from public.inter_country_transfers t
        where t.source_country_id = ${filters.countryId} and t.deleted_at is null
          ${filters.status ? sql`and t.status = ${filters.status}` : sql``}`;
    } else {
      rows = await sql`
        select t.*, sc.name as source_country_name, dc.name as dest_country_name,
               sp.full_name as sender_name, rp.full_name as receiver_name
        from public.inter_country_transfers t
        left join public.countries sc on sc.id = t.source_country_id
        left join public.countries dc on dc.id = t.dest_country_id
        left join public.profiles sp on sp.id = t.sender_user_id
        left join public.profiles rp on rp.id = t.receiver_user_id
        where t.deleted_at is null
          ${filters.countryId ? sql`and (t.source_country_id = ${filters.countryId} or t.dest_country_id = ${filters.countryId})` : sql``}
          ${filters.status ? sql`and t.status = ${filters.status}` : sql``}
        order by t.created_at desc
        limit ${limit} offset ${offset}`;
      countRows = await sql`
        select count(*)::int as total from public.inter_country_transfers t
        where t.deleted_at is null
          ${filters.countryId ? sql`and (t.source_country_id = ${filters.countryId} or t.dest_country_id = ${filters.countryId})` : sql``}
          ${filters.status ? sql`and t.status = ${filters.status}` : sql``}`;
    }

    return { transfers: rows || [], total: countRows?.[0]?.total || 0 };
  });

  return result || { transfers: [], total: 0 };
}
