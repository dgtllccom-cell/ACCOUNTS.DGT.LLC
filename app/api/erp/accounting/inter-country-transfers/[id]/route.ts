/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames, wantsRawRecord } from "@/lib/i18n/localize-records";
import {
  acceptInterCountryTransfer,
  rejectInterCountryTransfer,
  editReceivingLedger,
} from "@/lib/services/inter-country-transfer-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    const transfer = await withLocalPg(async (sql) => {
      const rows = await sql`
        select t.*,
               sc.name as source_country_name,
               dc.name as dest_country_name,
               scb.name as source_branch_name,
               dcb.name as dest_branch_name,
               sl.name as source_bank_cash_name,
               spl.name as source_party_name,
               dl.name as dest_bank_cash_name,
               dpl.name as dest_party_name,
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
        left join public.ledgers spl on spl.id = t.source_party_ledger_id
        left join public.ledgers dl on dl.id = t.dest_bank_cash_ledger_id
        left join public.ledgers dpl on dpl.id = t.dest_party_ledger_id
        left join public.profiles sp on sp.id = t.sender_user_id
        left join public.profiles rp on rp.id = t.receiver_user_id
        left join public.profiles ap on ap.id = t.accepted_by
        left join public.profiles rjp on rjp.id = t.rejected_by
        where t.id = ${id} and t.deleted_at is null
        limit 1
      `;
      return rows[0] || null;
    });

    if (!transfer) {
      throw new Error("Inter-country transfer record not found");
    }

    // ONE transfer record → the READER'S language. The sender may have created it in
    // English; a Pashto/Urdu/etc. receiver opening the same record sees every joined
    // party / branch / country / bank-cash / user name in their own language. Amounts,
    // Bill/Serial/Container/BL numbers and every identifier are untouched.
    // `remarks` is free-form financial narration → left exactly as entered (contract rule).
    let localized = transfer;
    if (!wantsRawRecord(request)) {
      const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
      [localized] = await localizeJoinedNames<any>([localized], lang, [
        { idField: "source_country_id", nameField: "source_country_name", table: "countries" },
        { idField: "dest_country_id", nameField: "dest_country_name", table: "countries" },
        { idField: "source_country_branch_id", nameField: "source_branch_name", table: "country_branches" },
        { idField: "dest_country_branch_id", nameField: "dest_branch_name", table: "country_branches" },
        { idField: "source_bank_cash_ledger_id", nameField: "source_bank_cash_name", table: "ledgers" },
        { idField: "dest_bank_cash_ledger_id", nameField: "dest_bank_cash_name", table: "ledgers" },
        { idField: "source_party_ledger_id", nameField: "source_party_name", table: "ledgers" },
        { idField: "dest_party_ledger_id", nameField: "dest_party_name", table: "ledgers" },
        { idField: "sender_user_id", nameField: "sender_name", table: "profiles", field: "full_name" },
        { idField: "receiver_user_id", nameField: "receiver_name", table: "profiles", field: "full_name" },
        { idField: "accepted_by", nameField: "accepted_by_name", table: "profiles", field: "full_name" },
        { idField: "rejected_by", nameField: "rejected_by_name", table: "profiles", field: "full_name" },
      ]);
    }
    return apiOk(localized);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const body = await request.json();
    const action = body.action as "accept" | "reject" | "edit_ledger";

    if (action === "accept") {
      if (!body.debitLedgerId || !body.creditLedgerId) {
        throw new Error("Debit and Credit Ledger IDs are required for acceptance");
      }
      const result = await acceptInterCountryTransfer({
        session,
        transferId: id,
        debitLedgerId: body.debitLedgerId,
        creditLedgerId: body.creditLedgerId,
        note: body.note,
      });
      return apiOk(result);
    }

    if (action === "reject") {
      if (!body.reason || !body.reason.trim()) {
        throw new Error("Rejection reason is required");
      }
      const result = await rejectInterCountryTransfer({
        session,
        transferId: id,
        reason: body.reason,
      });
      return apiOk(result);
    }

    if (action === "edit_ledger") {
      const result = await editReceivingLedger({
        session,
        transferId: id,
        destBankCashLedgerId: body.destBankCashLedgerId,
        destPartyLedgerId: body.destPartyLedgerId,
      });
      return apiOk(result);
    }

    throw new Error(`Unsupported action: ${action}`);
  } catch (error) {
    return handleApiError(error);
  }
}
