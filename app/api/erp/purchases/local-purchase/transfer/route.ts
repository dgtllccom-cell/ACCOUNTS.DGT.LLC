export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { acquireIdempotencyLock, buildReplayedResponse, commitIdempotencySuccess, releaseIdempotencyLock } from "@/lib/api/idempotency";
import { deriveLocalPurchasePostingState } from "@/lib/services/local-purchase-posting-state";

const transferSchema = z.object({
  purchaseId: z.string().uuid(),
});

type ResolvedLedger = {
  id: string;
  code: string | null;
  name: string | null;
  account_id: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
};

function money(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 10000) / 10000 : 0;
}

function normalizePaymentMode(value: unknown) {
  return String(value ?? "").trim().toLowerCase().split("(")[0].trim();
}

function toTransferKind(paymentMode: unknown) {
  const normalized = normalizePaymentMode(paymentMode);
  if (normalized === "cash") return "local_purchase_cash";
  if (normalized === "credit") return "local_purchase_credit";
  if (normalized === "advance") return "local_purchase_advance";
  return "local_purchase_transfer";
}

function resolveRoznamchaType(row: any) {
  if (row.city_branch_id) return "branch";
  if (row.country_branch_id) return "branch";
  if (row.country_id) return "country";
  return "super_admin";
}

async function resolveLedger(tx: any, term: unknown): Promise<ResolvedLedger | null> {
  const clean = String(term ?? "").trim();
  if (!clean) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean);

  if (isUuid) {
    const byId = await tx`
      select id, code, name, account_id, country_id, country_branch_id, city_branch_id
      from ledgers
      where id = ${clean}::uuid
        and deleted_at is null
      limit 1;
    `;
    if (byId[0]) return byId[0];

    const byAccount = await tx`
      select id, code, name, account_id, country_id, country_branch_id, city_branch_id
      from ledgers
      where account_id = ${clean}::uuid
        and deleted_at is null
      limit 1;
    `;
    if (byAccount[0]) return byAccount[0];
  }

  const byCode = await tx`
    select id, code, name, account_id, country_id, country_branch_id, city_branch_id
    from ledgers
    where code = ${clean}
      and deleted_at is null
    limit 1;
  `;
  if (byCode[0]) return byCode[0];

  const accountByCode = await tx`
    select id from accounts
    where code = ${clean}
      and deleted_at is null
    limit 1;
  `;
  if (accountByCode[0]?.id) {
    const byLinkedAccount = await tx`
      select id, code, name, account_id, country_id, country_branch_id, city_branch_id
      from ledgers
      where account_id = ${accountByCode[0].id}::uuid
        and deleted_at is null
      limit 1;
    `;
    if (byLinkedAccount[0]) return byLinkedAccount[0];
  }

  return null;
}

function assertBalancedLines(lines: Array<{ debit: number; credit: number }>, label: string, expectedAmount: number) {
  if (!Array.isArray(lines) || lines.length !== 2) {
    throw new Error(`${label} must contain exactly two lines.`);
  }
  const debitTotal = lines.reduce((sum, line) => sum + money(line.debit), 0);
  const creditTotal = lines.reduce((sum, line) => sum + money(line.credit), 0);
  if (debitTotal !== creditTotal || debitTotal !== money(expectedAmount)) {
    throw new Error(`${label} must be balanced to the posting amount.`);
  }
}

export async function POST(request: NextRequest) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const { purchaseId } = transferSchema.parse(body);

    const lockRes = await acquireIdempotencyLock({
      req: request,
      scopeModule: "LOCAL_PURCHASE_TRANSFER",
      userId: session.userId,
      countryId: session.countryIds?.[0] ?? null,
      cityBranchId: session.cityBranchIds?.[0] ?? null,
      businessReference: purchaseId,
      payload: body
    });

    if (lockRes.isReplayed) {
      return buildReplayedResponse(lockRes.responseCode || 200, lockRes.responseBody);
    }

    if (!lockRes.acquired) {
      return NextResponse.json(
        { ok: false, error: { message: "A request with this idempotency key is currently being processed or duplicate submission detected. Please wait." } },
        { status: 409 }
      );
    }

    idempotencyKey = lockRes.idempotencyKey;
    tenantHash = lockRes.tenantHash;

    const result = await withLocalPg(async (sql) => {
      return await sql.begin(async (tx) => {
        await tx`
          select set_config(
            'request.jwt.claims',
            ${JSON.stringify({ sub: session.userId, role: "authenticated" })},
            true
          );
        `;

        const purchases = await tx`
          select *
          from local_purchases
          where id = ${purchaseId}::uuid
            and deleted_at is null
          limit 1
          for update;
        `;
        const purchase = purchases[0];
        if (!purchase) {
          throw new Error("Purchase record not found.");
        }

        authorizeApiScope(session, {
          resource: "purchases",
          action: "update",
          countryId: purchase.country_id,
          countryBranchId: purchase.country_branch_id,
          cityBranchId: purchase.city_branch_id ?? null,
        });

        const finalAmount = money(purchase.final_cost);
        if (finalAmount <= 0) {
          throw new Error("Cannot post a local purchase with zero or negative amount.");
        }

        const purchaseLedger = await resolveLedger(tx, purchase.purchase_account_no);
        const creditLedger = await resolveLedger(tx, purchase.sales_account_no || purchase.broker_account_no);
        if (!purchaseLedger || !creditLedger) {
          throw new Error("The selected Purchase (DR) and Sales/Payable (CR) ledgers must both exist before transfer.");
        }
        if (!purchaseLedger.account_id || !creditLedger.account_id) {
          throw new Error("The selected Purchase (DR) and Sales/Payable (CR) ledgers must each have a linked account.");
        }
        if (purchaseLedger.id === creditLedger.id) {
          throw new Error("Purchase (DR) and Sales/Payable (CR) must be different ledgers.");
        }

        const postingCurrency = String(purchase.local_currency || purchase.purchase_currency || "PKR").toUpperCase();
        const paymentMode = normalizePaymentMode(purchase.payment_mode);
        const transferKind = toTransferKind(purchase.payment_mode);
        const journalSerialNo = String(
          purchase.journal_serial_no ||
          purchase.debit_journal_serial ||
          purchase.credit_journal_serial ||
          `LP-JRN-${purchase.id.slice(0, 8).toUpperCase()}`
        );
        const countrySerialNo = purchase.country_serial || purchase.country_serial_no || null;
        const branchSerialNo = purchase.branch_serial || purchase.branch_serial_no || null;
        const entrySerial = purchase.entry_serial || null;
        const nowIso = new Date().toISOString();
        const entryDate = nowIso.slice(0, 10);

        let journalEntryId = purchase.journal_entry_id ?? null;
        let journalEntryNo = journalSerialNo;

        if (!journalEntryId) {
          const journalRows = await tx`
            insert into journal_entries (
              company_id,
              branch_id,
              entry_no,
              entry_date,
              status,
              memo,
              source_type,
              source_id,
              posted_at,
              posted_by,
              created_at,
              updated_at
            )
            values (
              ${purchase.company_id},
              ${null},
              ${`JV-${journalSerialNo}`},
              ${entryDate},
              'draft',
              ${`Local Purchase - ${purchase.supplier_name || "Local Vendor"} (${purchase.goods_name}) [${purchase.payment_mode || "Cash"}]`},
              'local_purchase',
              ${purchase.id}::uuid,
              null,
              null,
              now(),
              now()
            )
            returning id, entry_no;
          `;
          journalEntryId = journalRows[0]?.id ?? null;
          journalEntryNo = journalRows[0]?.entry_no ?? `JV-${journalSerialNo}`;

          if (!journalEntryId) {
            throw new Error("Journal entry creation failed.");
          }

          const purchaseLine = await tx`
            insert into journal_lines (
              journal_entry_id,
              account_id,
              description,
              debit,
              credit
            )
            values (
              ${journalEntryId}::uuid,
              ${purchaseLedger.account_id}::uuid,
              ${`DR: Local Purchase - ${purchase.goods_name}`},
              ${finalAmount},
              0
            )
            returning id;
          `;
          const creditLine = await tx`
            insert into journal_lines (
              journal_entry_id,
              account_id,
              description,
              debit,
              credit
            )
            values (
              ${journalEntryId}::uuid,
              ${creditLedger.account_id}::uuid,
              ${`CR: Payable - ${purchase.supplier_name || "Local Vendor"} [${purchase.payment_mode || "Cash"}]`},
              0,
              ${finalAmount}
            )
            returning id;
          `;

          if (!purchaseLine[0]?.id || !creditLine[0]?.id) {
            throw new Error("Journal lines could not be created.");
          }

          await tx`select post_journal_entry(${journalEntryId}::uuid);`;
        } else {
          const journalRows = await tx`
            select id, entry_no, status, posted_at
            from journal_entries
            where id = ${journalEntryId}::uuid
              and deleted_at is null
            limit 1
            for update;
          `;
          const journal = journalRows[0];
          if (!journal) {
            throw new Error("Linked journal entry was not found.");
          }

          const journalLines = await tx`
            select id, account_id, debit, credit
            from journal_lines
            where journal_entry_id = ${journalEntryId}::uuid
            order by id;
          `;
          assertBalancedLines(journalLines.map((line: any) => ({ debit: Number(line.debit || 0), credit: Number(line.credit || 0) })), "Journal entry", finalAmount);
          if (String(journal.status) !== "posted") {
            await tx`select post_journal_entry(${journalEntryId}::uuid);`;
          }
          journalEntryNo = journal.entry_no || journalEntryNo;
        }

        let roznamchaEntryId = purchase.roznamcha_entry_id ?? null;
        let roznamchaSerials: {
          super_admin_serial_number?: string | null;
          country_transaction_serial_number?: string | null;
          branch_transaction_serial_number?: string | null;
          main_branch_transaction_serial?: string | null;
          city_branch_transaction_serial?: string | null;
          entry_serial_number?: string | null;
        } = {};

        if (!roznamchaEntryId) {
          const lines = [
            {
              ledgerId: purchaseLedger.id,
              paymentEntryType: "debit",
              description: `DR: Local Purchase - ${purchase.goods_name}`,
              debit: finalAmount,
              credit: 0,
              currency: postingCurrency,
              exchangeRate: 1,
            },
            {
              ledgerId: creditLedger.id,
              paymentEntryType: "credit",
              description: `CR: Payable - ${purchase.supplier_name || "Local Vendor"}`,
              debit: 0,
              credit: finalAmount,
              currency: postingCurrency,
              exchangeRate: 1,
            }
          ];
          const createdRoznamchaRows = await tx`
            select post_roznamcha_entry(
              ${resolveRoznamchaType(purchase)}::roznamcha_type,
              ${purchase.country_id}::uuid,
              ${purchase.country_branch_id}::uuid,
              ${purchase.city_branch_id}::uuid,
              ${`JV-${journalSerialNo}`},
              ${`LP-ROZ-${journalSerialNo}`},
              ${entryDate}::date,
              ${null},
              ${journalSerialNo},
              ${`Local Purchase: ${purchase.goods_name} - ${purchase.supplier_name || "Local Vendor"} | ${postingCurrency} ${finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} [${purchase.payment_mode || "Cash"}]`},
              ${tx.json(lines)}
            ) as id;
          `;
          roznamchaEntryId = String(createdRoznamchaRows[0]?.id ?? "");
          if (!roznamchaEntryId) {
            const fallback = await tx`
              select id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, main_branch_transaction_serial, city_branch_transaction_serial, entry_serial_number
              from roznamcha_entries
              where source_module = 'local_purchase'
                and source_transaction_id = ${purchase.id}::uuid
              order by created_at desc
              limit 1;
            `;
            if (!fallback[0]?.id) {
              throw new Error("Roznamcha posting did not return an entry id.");
            }
            roznamchaEntryId = fallback[0].id;
            roznamchaSerials = fallback[0];
          }
        } else {
          const rozRows = await tx`
            select id, status, posted_at, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, main_branch_transaction_serial, city_branch_transaction_serial, entry_serial_number
            from roznamcha_entries
            where id = ${roznamchaEntryId}::uuid
              and deleted_at is null
            limit 1
            for update;
          `;
          const roz = rozRows[0];
          if (!roz) {
            throw new Error("Linked Roznamcha entry was not found.");
          }
          const rozLines = await tx`
            select ledger_id, debit, credit
            from roznamcha_lines
            where roznamcha_entry_id = ${roznamchaEntryId}::uuid
            order by id;
          `;
          assertBalancedLines(rozLines.map((line: any) => ({ debit: Number(line.debit || 0), credit: Number(line.credit || 0) })), "Roznamcha entry", finalAmount);
          if (String(roz.status) !== "posted" || !roz.posted_at) {
            throw new Error("Linked Roznamcha entry is not fully posted.");
          }
          roznamchaSerials = roz;
        }

        if (!journalEntryId || !roznamchaEntryId) {
          throw new Error("Local Purchase posting did not produce both journal and Roznamcha links.");
        }

        const updatedRows = await tx`
          update local_purchases
          set status = 'posted',
              transferred_at = ${nowIso},
              journal_entry_id = ${journalEntryId}::uuid,
              roznamcha_entry_id = ${roznamchaEntryId}::uuid,
              journal_serial_no = coalesce(journal_serial_no, ${journalEntryNo}),
              debit_journal_serial = coalesce(debit_journal_serial, ${`${journalEntryNo}-DR`} ),
              credit_journal_serial = coalesce(credit_journal_serial, ${`${journalEntryNo}-CR`} ),
              super_admin_serial = coalesce(super_admin_serial, ${roznamchaSerials.super_admin_serial_number || null}),
              country_serial = coalesce(country_serial, ${roznamchaSerials.country_transaction_serial_number || countrySerialNo || null}),
              country_serial_no = coalesce(country_serial_no, ${roznamchaSerials.country_transaction_serial_number || countrySerialNo || null}),
              branch_serial = coalesce(branch_serial, ${roznamchaSerials.branch_transaction_serial_number || null}),
              branch_serial_no = coalesce(branch_serial_no, ${roznamchaSerials.branch_transaction_serial_number || null}),
              entry_serial = coalesce(entry_serial, ${roznamchaSerials.entry_serial_number || entrySerial || null}),
              updated_at = ${nowIso}
          where id = ${purchase.id}::uuid
          returning *;
        `;
        const updated = updatedRows[0];
        if (!updated) {
          throw new Error("Failed to update the local purchase after posting.");
        }

        const proofState = deriveLocalPurchasePostingState(updated);
        return {
          purchase: updated,
          journalEntryId,
          journalEntryNo,
          roznamchaEntryId,
          proofState,
          transferKind,
          paymentMode: purchase.payment_mode || null,
          journalLines: 2,
          roznamchaLines: 2,
        };
      });
    });

    if (!result) {
      throw new Error("Local purchase posting could not be completed.");
    }

    const resPayload = {
      ok: true,
      data: {
        purchase: result.purchase,
        posting: {
          journalEntryId: result.journalEntryId,
          roznamchaEntryId: result.roznamchaEntryId,
          journalSerialNo: result.journalEntryNo,
          paymentRoute: result.transferKind,
          accountingStatus: result.proofState.visualStatus,
          accountingStatusLabel: result.proofState.label,
          accountingStatusReason: result.proofState.reason,
          journalLines: result.journalLines,
          roznamchaLines: result.roznamchaLines,
        }
      }
    };

    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 200, resPayload);
    }

    return NextResponse.json(resPayload);
  } catch (err: any) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    return handleApiError(err);
  }
}
