import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uuidSchema } from "@/lib/api/erp-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { revalidatePath } from "next/cache";

type RoznamchaHeader = {
  id: string;
  type: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  journal_no: string;
  voucher_no: string;
  entry_date: string;
  payment_method_id: string | null;
  reference_no: string | null;
  narration: string | null;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
};

type RoznamchaLine = {
  id: string;
  payment_entry_type: string;
  account_id: string | null;
  enterprise_account_id: string | null;
  account_number: string | null;
  manual_reference_number: string | null;
  customer_number: string | null;
  country_serial_number: string | null;
  branch_serial_number: string | null;
  ledger_id: string | null;
  description: string | null;
  debit: number;
  credit: number;
  currency: string;
  usd_rate: number;
  usd_amount: number;
  accounts?: { id: string; code: string; name: string } | null;
  ledgers?: { id: string; code: string; name: string } | null;
};

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = await context.params;
    const id = uuidSchema.parse(params.id);

    const supabase = createSupabaseAdminClient() as any;

    const { data: header, error: headerError } = await supabase
      .from("roznamcha_entries")
      .select(
        // Disambiguate profiles embedding (created_by vs approved_by) by pinning to the FK.
        // We keep the `profiles` key in the response for backward compatibility with the UI types.
        "id, type, country_id, countries(name,currency_code), country_branch_id, country_branches(name,code), city_branch_id, city_branches(name,code), journal_no, voucher_no, entry_date, payment_method_id, payment_methods(name,code), reference_no, narration, status, created_by, profiles!roznamcha_entries_created_by_fkey(full_name), approved_by, approver_profile:profiles!roznamcha_entries_approved_by_fkey(full_name), approved_at, posted_at, created_at, updated_at, source_module, source_transaction_type, source_transaction_id, source_reference_no"
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (headerError) throw new Error(headerError.message);

    if (!header) {
      return apiOk({
        found: false,
        id,
        header: null,
        lines: [],
        totals: { debit: 0, credit: 0, lines: 0 }
      });
    }

    authorizeApiScope(session, {
      resource: "roznamcha",
      action: "read",
      countryId: (header.country_id as string | null) ?? null,
      countryBranchId: (header.country_branch_id as string | null) ?? null,
      cityBranchId: (header.city_branch_id as string | null) ?? null
    });

    const { data: lines, error: linesError } = await supabase
      .from("roznamcha_lines")
      .select(
        "id, payment_entry_type, account_id, enterprise_account_id, account_number, manual_reference_number, customer_number, country_serial_number, branch_serial_number, ledger_id, description, debit, credit, currency, usd_rate, usd_amount, accounts(id,code,name), ledgers(id,code,name)"
      )
      .eq("roznamcha_entry_id", id)
      .order("id", { ascending: true });

    if (linesError) throw new Error(linesError.message);

    const safeLines = (lines ?? []) as RoznamchaLine[];
    const totals = safeLines.reduce(
      (acc, row) => {
        acc.lines += 1;
        acc.debit += Number(row.debit || 0);
        acc.credit += Number(row.credit || 0);
        return acc;
      },
      { lines: 0, debit: 0, credit: 0 }
    );

    return apiOk({
      found: true,
      id,
      header: header as RoznamchaHeader,
      lines: safeLines,
      totals
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const params = await context.params;
    const id = uuidSchema.parse(params.id);

    const adminSupabase = createSupabaseAdminClient() as any;

    const { data: header, error: headerError } = await adminSupabase
      .from("roznamcha_entries")
      .select("country_id, country_branch_id, city_branch_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (headerError) throw new Error(headerError.message);
    if (!header) {
      return apiOk({ success: false, message: "Entry not found" });
    }

    authorizeApiScope(session, {
      resource: "roznamcha",
      action: "post",
      countryId: (header.country_id as string | null) ?? null,
      countryBranchId: (header.country_branch_id as string | null) ?? null,
      cityBranchId: (header.city_branch_id as string | null) ?? null
    });

    // Inject the authenticated user's UUID into the Postgres session so that
    // auth.uid() returns a valid value inside the security-definer RPC.
    // The service-role admin client does not carry a Supabase Auth JWT, so
    // auth.uid() would otherwise be null, causing assert_enterprise_scope_access
    // to throw "Authentication is required".
    const actorId = session.userId ?? null;
    if (actorId) {
      const claimsJson = JSON.stringify({ sub: actorId, role: "authenticated" });
      try {
        await adminSupabase.rpc("set_config", {
          setting: "request.jwt.claims",
          value: claimsJson,
          is_local: true
        });
      } catch (e) {
        // best-effort - fallback if set_config not exposed
      }
    }

    const { data, error } = await adminSupabase.rpc("reverse_roznamcha_entry", {
      p_original_entry_id: id,
      p_reason: "Deleted or edited from cash entry page",
      p_approval_request_id: null
    });

    if (error) throw new Error(error.message);

    // Requirement 9 & 11: Real-time Synchronization
    revalidatePath("/dashboard/roznamcha", "layout");
    revalidatePath("/dashboard/reports", "layout");
    revalidatePath("/dashboard/journal", "layout");

    return apiOk({ success: true, reversalId: data });
  } catch (error) {
    return handleApiError(error);
  }
}


