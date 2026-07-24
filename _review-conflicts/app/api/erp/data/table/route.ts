import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/api/erp-validation";

const TABLES: Record<string, { label: string; columns: string; resource: string; scoped: boolean; order?: string; search?: string[]; softDelete?: boolean }> = {
  enterprise_accounts: { label: "Account Master", resource: "accounts", scoped: true, softDelete: true, order: "created_at", columns: "id, code, account_number, manual_reference_number, customer_number, name, kind, currency, current_balance, status, country_id, country_branch_id, city_branch_id, branch_code, created_at", search: ["code", "account_number", "manual_reference_number", "customer_number", "name", "branch_code"] },
  ledgers: { label: "Ledgers", resource: "ledgers", scoped: true, softDelete: true, order: "created_at", columns: "id, code, name, currency, current_balance, debit_total, credit_total, scope, country_id, country_branch_id, city_branch_id, enterprise_account_id, is_active, created_at", search: ["code", "name", "currency"] },
  roznamcha_entries: { label: "Roznamcha Entries", resource: "roznamcha", scoped: true, order: "created_at", columns: "id, type, voucher_no, journal_no, entry_date, status, country_id, country_branch_id, city_branch_id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, narration, created_at", search: ["voucher_no", "journal_no", "narration", "super_admin_serial_number", "country_transaction_serial_number", "branch_transaction_serial_number"] },
  roznamcha_lines: { label: "Roznamcha Lines", resource: "roznamcha", scoped: false, order: "created_at", columns: "id, roznamcha_entry_id, enterprise_account_id, ledger_id, account_number, manual_reference_number, customer_number, debit, credit, currency, description, created_at", search: ["account_number", "manual_reference_number", "customer_number", "description"] },
  purchase_orders: { label: "Purchase Orders", resource: "purchases", scoped: true, softDelete: true, order: "created_at", columns: "id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, currency_code, order_total, advance_paid, remaining_due, payment_status, ledger_posting_status, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, created_at", search: ["purchase_order_no", "purchase_contract_no", "payment_status", "ledger_posting_status"] },
  purchase_order_payments: { label: "Purchase Payments", resource: "purchases", scoped: false, order: "created_at", columns: "id, purchase_order_id, payment_type, amount, currency, status, reference_no, created_at", search: ["payment_type", "status", "reference_no", "currency"] },
  purchase_loading_records: { label: "Purchase Loading", resource: "purchases", scoped: true, softDelete: true, order: "created_at", columns: "id, purchase_order_id, purchase_order_no, container_no, seal_no, loading_date, status, country_id, country_branch_id, city_branch_id, created_at", search: ["purchase_order_no", "container_no", "seal_no", "status"] },
  sales_orders: { label: "Sales Orders", resource: "sales", scoped: true, softDelete: true, order: "created_at", columns: "id, sales_order_no, sales_contract_no, customer_name, account_number, manual_reference_number, customer_number, country_id, country_branch_id, city_branch_id, currency_code, order_total, paid_amount, remaining_amount, sales_status, payment_status, created_at", search: ["sales_order_no", "sales_contract_no", "customer_name", "account_number", "manual_reference_number", "customer_number"] },
  shipping_line_records: { label: "Shipping Line Records", resource: "shipping", scoped: true, softDelete: true, order: "created_at", columns: "id, shipping_line_name, vessel_name, voyage_number, shipping_reference_no, account_number, manual_reference_number, country_id, country_branch_id, city_branch_id, shipment_status, created_at", search: ["shipping_line_name", "vessel_name", "voyage_number", "shipping_reference_no", "account_number", "manual_reference_number"] },
  bl_records: { label: "Bill of Lading Records", resource: "shipping", scoped: true, softDelete: true, order: "created_at", columns: "id, bl_number, bl_date, shipping_line_name, vessel_name, voyage_number, account_number, manual_reference_number, country_id, country_branch_id, city_branch_id, shipment_status, created_at", search: ["bl_number", "shipping_line_name", "vessel_name", "voyage_number", "account_number", "manual_reference_number"] },
  countries: { label: "Countries", resource: "settings", scoped: false, order: "name", columns: "id, name, iso2, iso3, currency_code, phone_code, status, created_at", search: ["name", "iso2", "iso3", "currency_code"] },
  country_branches: { label: "Country Branches", resource: "branches", scoped: true, softDelete: true, order: "created_at", columns: "id, country_id, name, code, local_currency, is_main, status, address, created_at", search: ["name", "code", "local_currency", "address"] },
  city_branches: { label: "City Branches", resource: "branches", scoped: true, softDelete: true, order: "created_at", columns: "id, country_id, country_branch_id, city_name, name, code, local_currency, status, address, created_at", search: ["city_name", "name", "code", "local_currency", "address"] },
  profiles: { label: "Users / Profiles", resource: "users", scoped: false, softDelete: true, order: "created_at", columns: "id, full_name, email, role, status, country_id, country_branch_id, city_branch_id, created_at", search: ["full_name", "email", "role", "status"] }
};

const querySchema = z.object({
  table: z.string().trim().min(1),
  q: z.string().trim().max(200).optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

function sanitizeSearch(value: string) {
  return value.replace(/[%,]/g, "").trim();
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      table: request.nextUrl.searchParams.get("table") ?? undefined,
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    const config = TABLES[query.table];
    if (!config) throw new Error("This data table is not enabled for ERP Data Page.");

    authorizeApiScope(session, {
      resource: config.resource,
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    const supabase = createSupabaseAdminClient() as any;
    let dbQuery = supabase.from(query.table).select(config.columns).limit(query.limit);
    if (config.order) dbQuery = dbQuery.order(config.order, { ascending: config.order === "name" });

    if (query.q && config.search?.length) {
      const term = sanitizeSearch(query.q);
      if (term) dbQuery = dbQuery.or(config.search.map((column) => `${column}.ilike.%${term}%`).join(","));
    }

    if (config.scoped) {
      if (query.cityBranchId) dbQuery = dbQuery.eq("city_branch_id", query.cityBranchId);
      else if (!session.isSuperAdmin && session.cityBranchIds.length) dbQuery = dbQuery.in("city_branch_id", session.cityBranchIds);
      else if (query.countryBranchId) dbQuery = dbQuery.eq("country_branch_id", query.countryBranchId);
      else if (!session.isSuperAdmin && session.countryBranchIds.length) dbQuery = dbQuery.in("country_branch_id", session.countryBranchIds);
      else if (query.countryId) dbQuery = dbQuery.eq("country_id", query.countryId);
      else if (!session.isSuperAdmin) dbQuery = dbQuery.in("country_id", session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    if (config.softDelete) dbQuery = dbQuery.is("deleted_at", null);

    const { data, error } = await dbQuery;
    if (error) throw new Error(error.message);
    const rows = Array.isArray(data) ? data : [];
    const columns = rows[0] ? Object.keys(rows[0]) : config.columns.split(",").map((c) => c.trim().split(":").pop() || c.trim());

    return apiOk({ table: query.table, label: config.label, rows, columns, limit: query.limit });
  } catch (error) {
    return handleApiError(error);
  }
}