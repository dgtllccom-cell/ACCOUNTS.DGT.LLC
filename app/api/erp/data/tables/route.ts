import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";

const DATA_TABLES = [
  { name: "enterprise_accounts", label: "Account Master", scope: true },
  { name: "ledgers", label: "Ledgers", scope: true },
  { name: "roznamcha_entries", label: "Roznamcha Entries", scope: true },
  { name: "roznamcha_lines", label: "Roznamcha Lines", scope: false },
  { name: "purchase_orders", label: "Purchase Orders", scope: true },
  { name: "purchase_order_payments", label: "Purchase Payments", scope: false },
  { name: "purchase_loading_records", label: "Purchase Loading", scope: true },
  { name: "sales_orders", label: "Sales Orders", scope: true },
  { name: "shipping_line_records", label: "Shipping Line Records", scope: true },
  { name: "bl_records", label: "Bill of Lading Records", scope: true },
  { name: "countries", label: "Countries", scope: false },
  { name: "country_branches", label: "Country Branches", scope: true },
  { name: "city_branches", label: "City Branches", scope: true },
  { name: "profiles", label: "Users / Profiles", scope: false }
] as const;

export async function GET() {
  try {
    await requireErpSession();
    return apiOk({ tables: DATA_TABLES });
  } catch (error) {
    return handleApiError(error);
  }
}