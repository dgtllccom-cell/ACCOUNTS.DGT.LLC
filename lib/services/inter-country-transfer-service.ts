/* eslint-disable @typescript-eslint/no-explicit-any */
import { withLocalPg } from "@/lib/db/local-postgres";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/posting";
import type { ErpSession } from "@/lib/auth/session";

/**
 * Inter-Country Transfer & Claim Service
 * -------------------------------------------------------------
 * Operates across the 4 authoritative Country Accounts:
 * 1. Pakistan Country Account (PAK-CORP-GEN-001)
 * 2. Afghanistan Country Account (AFG-CORP-GEN-001)
 * 3. India Country Account (IND-CORP-GEN-001 / 0005-IND-HUB)
 * 4. Dubai / UAE Country Account (UAE-CORP-GEN-001)
 *
 * Workflow:
 * 1. Originating country records an amount paid / claimed against destination country.
 *    Sender Roznamcha: Debit Destination Country Account, Credit Originating Bank/Cash.
 * 2. Destination country receives notification in "Incoming Country Transfers / Claims".
 * 3. Destination country reviews complete details & references (Bill, Container, BL, Order, Party).
 * 4. Destination country selects relevant local account/party/ledger and accepts.
 *    Receiver Roznamcha: Debit Selected Local Account, Credit Originating Country Account.
 * 5. Both sides are balanced, auditable, and driven by the existing Roznamcha engine.
 */

export type CountryMainAccount = {
  ledgerId: string;
  accountId: string | null;
  code: string;
  name: string;
  currency: string;
  countryId: string;
  countryName: string;
};

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
  amount: number;
  originalCurrency: string;
  exchangeRate?: number;
  finalCurrency?: string;
  finalAmount?: number;
  direction?: "debit" | "credit";
  // Specific supporting references
  billNumber?: string | null;
  containerNumber?: string | null;
  orderReference?: string | null;
  blNumber?: string | null;
  jobNumber?: string | null;
  customerPartyName?: string | null;
  referenceDate?: string | null;
  claimCategory?: "general_business" | "shipping_line" | "trade";
  claimDescription?: string | null;
  narration?: string | null;
  remarks?: string | null;
  idempotencyKey?: string | null;
};

export type AcceptInterCountryTransferInput = {
  session: ErpSession;
  transferId: string;
  selectedLocalLedgerId: string; // The receiving country's local account/party/customer ledger
  debitLedgerId?: string | null; // Optional alias for backward compatibility
  creditLedgerId?: string | null; // Optional override
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

// ─── 4 COUNTRY ACCOUNTS RESOLVER ─────────────────────────────────────────────

/**
 * Dynamically resolves the authoritative Country Account for any of the 4 core countries:
 * Pakistan, Afghanistan, India, Dubai/UAE.
 * Does not hardcode IDs. Queries live database matching country codes / central clearing ledgers.
 */
export async function getCountryMainAccount(countryId: string): Promise<CountryMainAccount | null> {
  if (!countryId) return null;

  return withLocalPg(async (sql) => {
    const rows = await sql`
      select 
        l.id as ledger_id,
        coalesce(ea.id, a.id) as account_id,
        coalesce(l.code, ea.code, a.code) as code,
        coalesce(l.name, ea.name, a.name) as name,
        coalesce(l.currency, ea.currency, c.currency_code) as currency,
        c.id as country_id,
        c.name as country_name
      from public.countries c
      left join public.ledgers l on l.country_id = c.id and l.deleted_at is null
        and (
          l.code in ('PAK-CORP-GEN-001', 'AFG-CORP-GEN-001', 'IND-CORP-GEN-001', '0005-IND-HUB', 'UAE-CORP-GEN-001')
          or l.name ilike '%Central Clearing%'
          or l.name ilike '%Inter-Country%'
          or l.name ilike '%Main Country Clearing%'
        )
      left join public.enterprise_accounts ea on (ea.id = l.enterprise_account_id or (ea.country_id = c.id and ea.deleted_at is null and ea.code in ('PAK-CORP-GEN-001', 'AFG-CORP-GEN-001', 'IND-CORP-GEN-001', 'UAE-CORP-GEN-001')))
      left join public.accounts a on a.id = l.account_id
      where c.id = ${countryId}
      order by (
        case 
          when l.code in ('PAK-CORP-GEN-001', 'AFG-CORP-GEN-001', 'IND-CORP-GEN-001', 'UAE-CORP-GEN-001') then 1
          when l.code = '0005-IND-HUB' then 2
          when l.name ilike '%Inter-Country%' then 3
          else 4
        end
      )
      limit 1
    `;

    if (!rows[0] || !rows[0].ledger_id) return null;

    return {
      ledgerId: rows[0].ledger_id,
      accountId: rows[0].account_id,
      code: rows[0].code,
      name: rows[0].name,
      currency: rows[0].currency,
      countryId: rows[0].country_id,
      countryName: rows[0].country_name,
    };
  });
}

/**
 * Returns all 4 authoritative Country Accounts for frontend selection & display.
 */
export async function listAllCountryMainAccounts(): Promise<CountryMainAccount[]> {
  return (await withLocalPg(async (sql) => {
    const rows = await sql`
      select 
        l.id as ledger_id,
        coalesce(ea.id, a.id) as account_id,
        coalesce(l.code, ea.code, a.code) as code,
        coalesce(l.name, ea.name, a.name) as name,
        coalesce(l.currency, ea.currency, c.currency_code) as currency,
        c.id as country_id,
        c.name as country_name
      from public.countries c
      join public.ledgers l on l.country_id = c.id and l.deleted_at is null
        and (
          l.code in ('PAK-CORP-GEN-001', 'AFG-CORP-GEN-001', 'IND-CORP-GEN-001', '0005-IND-HUB', 'UAE-CORP-GEN-001')
          or l.name ilike '%Central Clearing%'
          or l.name ilike '%Inter-Country%'
          or l.name ilike '%Main Country Clearing%'
        )
      left join public.enterprise_accounts ea on (ea.id = l.enterprise_account_id or (ea.country_id = c.id and ea.deleted_at is null and ea.code in ('PAK-CORP-GEN-001', 'AFG-CORP-GEN-001', 'IND-CORP-GEN-001', 'UAE-CORP-GEN-001')))
      left join public.accounts a on a.id = l.account_id
      where c.name ilike '%pakistan%' or c.name ilike '%afghanistan%' or c.name ilike '%india%' or c.name ilike '%emirates%' or c.name ilike '%uae%'
      order by c.name
    `;

    // Deduplicate by country_id
    const seen = new Set<string>();
    const result: CountryMainAccount[] = [];
    for (const r of rows) {
      if (!seen.has(r.country_id)) {
        seen.add(r.country_id);
        result.push({
          ledgerId: r.ledger_id,
          accountId: r.account_id,
          code: r.code,
          name: r.name,
          currency: r.currency,
          countryId: r.country_id,
          countryName: r.country_name,
        });
      }
    }
    return result;
  })) || [];
}

// ─── CREATE TRANSFER / CLAIM ──────────────────────────────────────────────────

export async function createInterCountryTransfer(
  input: CreateInterCountryTransferInput
): Promise<{ id: string; transferNo: string; globalReferenceId: string }> {
  const transferNo = generateTransferNo();
  const globalRefId = generateGlobalRefId();

  // Resolve Destination Country Account (the claim target)
  const destCountryAccount = await getCountryMainAccount(input.destCountryId);
  const destCountryLedgerId = destCountryAccount?.ledgerId || null;

  const exRate = Number(input.exchangeRate || 1);
  const finalCurr = input.finalCurrency || input.originalCurrency;
  const finalAmt = Number(input.finalAmount || (input.amount * exRate));
  const claimCat = input.claimCategory || "general_business";
  const refDate = input.referenceDate || new Date().toISOString().slice(0, 10);

  // 1. Create the transfer record in database with all references
  const row = await withLocalPg(async (sql) => {
    const r = await sql`
      insert into public.inter_country_transfers (
        transfer_no, source_country_id, source_country_branch_id, source_city_branch_id,
        source_bank_cash_ledger_id, source_party_ledger_id,
        dest_country_id, dest_country_branch_id, dest_city_branch_id,
        dest_bank_cash_ledger_id, dest_party_ledger_id,
        amount, original_currency, exchange_rate, final_currency, final_amount, direction,
        narration, remarks, status, idempotency_key, global_reference_id,
        sender_user_id, created_by,
        bill_number, container_number, order_reference, bl_number, job_number,
        customer_party_name, reference_date, claim_category, claim_description
      ) values (
        ${transferNo}, ${input.sourceCountryId}, ${input.sourceCountryBranchId ?? null}, ${input.sourceCityBranchId ?? null},
        ${input.sourceBankCashLedgerId ?? null}, ${destCountryLedgerId},
        ${input.destCountryId}, ${input.destCountryBranchId ?? null}, ${input.destCityBranchId ?? null},
        null, null,
        ${input.amount}, ${input.originalCurrency}, ${exRate}, ${finalCurr}, ${finalAmt}, ${input.direction || "debit"},
        ${input.narration ?? null}, ${input.remarks ?? null}, 'pending',
        ${input.idempotencyKey ?? null}, ${globalRefId},
        ${input.session.userId}, ${input.session.userId},
        ${input.billNumber ?? null}, ${input.containerNumber ?? null}, ${input.orderReference ?? null},
        ${input.blNumber ?? null}, ${input.jobNumber ?? null},
        ${input.customerPartyName ?? null}, ${refDate}, ${claimCat},
        ${input.claimDescription ?? null}
      )
      returning id, transfer_no`;
    return r[0];
  });

  if (!row) throw new Error("Failed to create inter-country transfer.");

  // 2. Post sending-side voucher via existing Roznamcha engine
  // Debit: Destination Country Account (Receivable/Claim against destination country)
  // Credit: Source Bank / Cash ledger (Cash/Payment paid by originating country)
  if (destCountryLedgerId && input.sourceBankCashLedgerId) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const descParts = [
        `Inter-Country Claim to ${destCountryAccount?.countryName || "Destination"} [${transferNo}]`,
        input.billNumber ? `Bill: ${input.billNumber}` : null,
        input.containerNumber ? `Cont: ${input.containerNumber}` : null,
        input.blNumber ? `BL: ${input.blNumber}` : null,
        input.orderReference ? `Order: ${input.orderReference}` : null,
        input.customerPartyName ? `Party: ${input.customerPartyName}` : null,
      ].filter(Boolean).join(" | ");

      const lines = [
        {
          ledgerId: destCountryLedgerId,
          debit: input.amount,
          credit: 0,
          currency: input.originalCurrency,
          usdRate: exRate,
          usdAmount: finalAmt,
          description: descParts,
        },
        {
          ledgerId: input.sourceBankCashLedgerId,
          debit: 0,
          credit: input.amount,
          currency: input.originalCurrency,
          usdRate: exRate,
          usdAmount: finalAmt,
          description: descParts,
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
          narration: input.narration || descParts,
          lines,
          sourceModule: "inter_country_transfer",
          sourceTransactionType: "send",
          sourceTransactionId: row.id as string,
          sourceReferenceNo: transferNo,
          originalLanguage: "en",
        } as any,
      });

      if (result?.entryId) {
        await withLocalPg(async (sql) => {
          await sql`
            update public.inter_country_transfers
            set sender_roznamcha_entry_id = ${result.entryId}, updated_at = now()
            where id = ${row.id}`;
        });
      }
    } catch (err: any) {
      console.error(`[inter-country-transfer] Sender Roznamcha posting failed for ${transferNo}:`, err?.message);
    }
  }

  // 3. Activity audit
  await withLocalPg(async (sql) => {
    await sql`
      insert into public.erp_activity_events (actor_id, action, resource, record_table, record_id, country_id, metadata)
      values (
        ${input.session.userId}, 'create', 'inter_country_transfer', 'inter_country_transfers', ${row.id}::uuid,
        ${input.sourceCountryId}::uuid,
        ${JSON.stringify({
          transferNo,
          amount: input.amount,
          currency: input.originalCurrency,
          destCountryId: input.destCountryId,
          destCountryAccount: destCountryAccount?.name,
          billNumber: input.billNumber,
          containerNumber: input.containerNumber,
          category: claimCat,
        })}::jsonb
      )`;
  });

  return { id: row.id as string, transferNo: row.transfer_no as string, globalReferenceId: globalRefId };
}

// ─── ACCEPT TRANSFER / CLAIM ──────────────────────────────────────────────────

export async function acceptInterCountryTransfer(
  input: AcceptInterCountryTransferInput
): Promise<{ status: "accepted" | "already_accepted"; entryId: string; transferNo: string }> {
  const chosenLocalLedgerId = input.selectedLocalLedgerId || input.debitLedgerId;
  if (!chosenLocalLedgerId) {
    throw new Error("Please select the local account/party/ledger against which this amount belongs.");
  }

  // 1. Atomic update to claim transfer
  const claimed = await withLocalPg(async (sql) => {
    const r = await sql`
      update public.inter_country_transfers
        set status = 'accepted',
            accepted_by = ${input.session.userId},
            accepted_at = now(),
            receiver_user_id = ${input.session.userId},
            dest_party_ledger_id = ${chosenLocalLedgerId},
            updated_at = now()
      where id = ${input.transferId} and status = 'pending' and deleted_at is null
      returning *`;
    return r[0] ?? null;
  });

  if (!claimed) {
    // Check if already processed
    const existing = await withLocalPg(async (sql) => {
      const r = await sql`
        select id, transfer_no, receiver_roznamcha_entry_id
        from public.inter_country_transfers where id = ${input.transferId} and deleted_at is null limit 1`;
      return r[0] ?? null;
    });

    if (existing?.receiver_roznamcha_entry_id) {
      return { status: "already_accepted", entryId: existing.receiver_roznamcha_entry_id as string, transferNo: existing.transfer_no as string };
    }
    throw new Error("Transfer claim not found or has already been accepted/rejected.");
  }

  // 2. Resolve originating country's Country Account (Credit side on receiving country's books)
  const sourceCountryAccount = await getCountryMainAccount(claimed.source_country_id as string);
  const sourceCountryLedgerId = input.creditLedgerId || sourceCountryAccount?.ledgerId;

  if (!sourceCountryLedgerId) {
    throw new Error(`Authoritative Country Account for source country (${claimed.source_country_id}) could not be resolved.`);
  }

  // 3. Post receiving-side Roznamcha voucher in accepting country's books
  // Debit: Recipient-chosen local account/party/customer
  // Credit: Originating Country Account (Payable to originating country)
  const today = new Date().toISOString().slice(0, 10);
  const transferNo = claimed.transfer_no as string;
  const amount = Number(claimed.amount);
  const currency = claimed.original_currency as string;
  const exRate = Number(claimed.exchange_rate || 1);
  const finalAmount = Number(claimed.final_amount || (amount * exRate));

  const narrationParts = [
    `Inter-Country Claim Accepted [${transferNo}] from ${sourceCountryAccount?.countryName || "Origin"}`,
    claimed.bill_number ? `Bill: ${claimed.bill_number}` : null,
    claimed.container_number ? `Cont: ${claimed.container_number}` : null,
    claimed.bl_number ? `BL: ${claimed.bl_number}` : null,
    claimed.customer_party_name ? `Party: ${claimed.customer_party_name}` : null,
    input.note ? `Note: ${input.note}` : null,
  ].filter(Boolean).join(" | ");

  const lines = [
    {
      ledgerId: chosenLocalLedgerId,
      debit: amount,
      credit: 0,
      currency,
      usdRate: exRate,
      usdAmount: finalAmount,
      description: narrationParts,
    },
    {
      ledgerId: sourceCountryLedgerId,
      debit: 0,
      credit: amount,
      currency,
      usdRate: exRate,
      usdAmount: finalAmount,
      description: narrationParts,
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
      narration: narrationParts,
      lines,
      sourceModule: "inter_country_transfer",
      sourceTransactionType: "accept",
      sourceTransactionId: input.transferId,
      sourceReferenceNo: transferNo,
      originalLanguage: "en",
    } as any,
  });

  const entryId = result?.entryId || "";

  // 4. Link receiver voucher back to transfer
  await withLocalPg(async (sql) => {
    await sql`
      update public.inter_country_transfers
      set receiver_roznamcha_entry_id = ${entryId || null}, updated_at = now()
      where id = ${input.transferId}`;
  });

  // 5. Record activity audit
  await withLocalPg(async (sql) => {
    await sql`
      insert into public.erp_activity_events (actor_id, action, resource, record_table, record_id, country_id, metadata)
      values (
        ${input.session.userId}, 'accept', 'inter_country_transfer', 'inter_country_transfers', ${input.transferId}::uuid,
        ${claimed.dest_country_id}::uuid,
        ${JSON.stringify({
          transferNo,
          chosenLocalLedgerId,
          sourceCountryLedgerId,
          sourceCountryAccount: sourceCountryAccount?.name,
          voucherId: entryId,
          note: input.note,
        })}::jsonb
      )`;
  });

  return { status: "accepted", entryId, transferNo };
}

// ─── REJECT TRANSFER / CLAIM ──────────────────────────────────────────────────

export async function rejectInterCountryTransfer(
  input: RejectInterCountryTransferInput
): Promise<{ status: "rejected"; transferNo: string }> {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("A reason is required when rejecting a transfer or claim.");
  }

  const result = await withLocalPg(async (sql) => {
    const r = await sql`
      update public.inter_country_transfers
        set status = 'rejected',
            rejection_reason = ${input.reason},
            rejected_by = ${input.session.userId},
            rejected_at = now(),
            receiver_user_id = ${input.session.userId},
            updated_at = now()
      where id = ${input.transferId} and status = 'pending' and deleted_at is null
      returning transfer_no, dest_country_id`;
    return r[0] ?? null;
  });

  if (!result) {
    throw new Error("Transfer claim not found or has already been accepted/rejected.");
  }

  await withLocalPg(async (sql) => {
    await sql`
      insert into public.erp_activity_events (actor_id, action, resource, record_table, record_id, country_id, metadata)
      values (
        ${input.session.userId}, 'reject', 'inter_country_transfer', 'inter_country_transfers', ${input.transferId}::uuid,
        ${result.dest_country_id}::uuid,
        ${JSON.stringify({ transferNo: result.transfer_no, reason: input.reason })}::jsonb
      )`;
  });

  return { status: "rejected", transferNo: result.transfer_no as string };
}

// ─── EDIT RECEIVING LEDGER (PRE-ACCEPTANCE CORRECTION) ─────────────────────────

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

// ─── LIST TRANSFERS WITH WORKFLOW TABS & SCOPE ────────────────────────────────

export async function listInterCountryTransfers(filters: {
  countryId?: string | null;
  status?: string | null;
  direction?: "sent" | "received" | null;
  tab?: "incoming" | "sent" | "pending" | "accepted" | "rejected" | "all" | null;
  limit?: number;
  offset?: number;
}): Promise<{
  transfers: any[];
  total: number;
  pendingIncomingCount: number;
}> {
  return (await withLocalPg(async (sql) => {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const cId = filters.countryId || null;
    const tab = filters.tab || (filters.direction === "received" ? "incoming" : filters.direction === "sent" ? "sent" : "all");

    // Base query conditions depending on tab
    let whereCondition = sql`t.deleted_at is null`;

    if (cId) {
      if (tab === "incoming") {
        whereCondition = sql`${whereCondition} and t.dest_country_id = ${cId}`;
      } else if (tab === "sent") {
        whereCondition = sql`${whereCondition} and t.source_country_id = ${cId}`;
      } else {
        whereCondition = sql`${whereCondition} and (t.source_country_id = ${cId} or t.dest_country_id = ${cId})`;
      }
    }

    if (tab === "pending") {
      whereCondition = sql`${whereCondition} and t.status = 'pending'`;
    } else if (tab === "accepted") {
      whereCondition = sql`${whereCondition} and t.status = 'accepted'`;
    } else if (tab === "rejected") {
      whereCondition = sql`${whereCondition} and t.status in ('rejected', 'returned')`;
    } else if (filters.status) {
      whereCondition = sql`${whereCondition} and t.status = ${filters.status}`;
    }

    const rows = await sql`
      select 
        t.*,
        sc.name as source_country_name,
        dc.name as dest_country_name,
        scb.name as source_branch_name,
        dcb.name as dest_branch_name,
        sl.name as source_bank_cash_name,
        coalesce(dpl.name, dest_ca.name) as dest_ledger_name,
        coalesce(dest_ca.name, 'Destination Country Account') as dest_country_account_name,
        coalesce(src_ca.name, 'Source Country Account') as src_country_account_name,
        sp.full_name as sender_name,
        rp.full_name as receiver_name,
        ap.full_name as accepted_by_name,
        rjp.full_name as rejected_by_name
      from public.inter_country_transfers t
      left join public.countries sc on sc.id = t.source_country_id
      left join public.countries dc on dc.id = t.dest_country_id
      left join public.country_branches scb on scb.id = t.source_country_branch_id
      left join public.country_branches dcb on dcb.id = t.dest_country_branch_id
      left join public.ledgers sl on sl.id = t.source_bank_cash_ledger_id
      left join public.ledgers dpl on dpl.id = t.dest_party_ledger_id
      left join public.ledgers dest_ca on dest_ca.country_id = t.dest_country_id and dest_ca.deleted_at is null
        and (dest_ca.code in ('PAK-CORP-GEN-001', 'AFG-CORP-GEN-001', 'IND-CORP-GEN-001', '0005-IND-HUB', 'UAE-CORP-GEN-001'))
      left join public.ledgers src_ca on src_ca.country_id = t.source_country_id and src_ca.deleted_at is null
        and (src_ca.code in ('PAK-CORP-GEN-001', 'AFG-CORP-GEN-001', 'IND-CORP-GEN-001', '0005-IND-HUB', 'UAE-CORP-GEN-001'))
      left join public.profiles sp on sp.id = t.sender_user_id
      left join public.profiles rp on rp.id = t.receiver_user_id
      left join public.profiles ap on ap.id = t.accepted_by
      left join public.profiles rjp on rjp.id = t.rejected_by
      where ${whereCondition}
      order by t.created_at desc
      limit ${limit} offset ${offset}
    `;

    const countRows = await sql`
      select count(*)::int as total from public.inter_country_transfers t
      where ${whereCondition}
    `;

    // Calculate pending incoming count for notification badge
    let pendingIncomingCount = 0;
    if (cId) {
      const incomingPendingRows = await sql`
        select count(*)::int as count 
        from public.inter_country_transfers 
        where dest_country_id = ${cId} and status = 'pending' and deleted_at is null
      `;
      pendingIncomingCount = incomingPendingRows[0]?.count || 0;
    } else {
      const allPendingRows = await sql`
        select count(*)::int as count 
        from public.inter_country_transfers 
        where status = 'pending' and deleted_at is null
      `;
      pendingIncomingCount = allPendingRows[0]?.count || 0;
    }

    return {
      transfers: rows || [],
      total: countRows?.[0]?.total || 0,
      pendingIncomingCount,
    };
  })) || { transfers: [], total: 0, pendingIncomingCount: 0 };
}
