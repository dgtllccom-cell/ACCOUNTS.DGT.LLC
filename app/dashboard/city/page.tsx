import { Card, CardContent } from "@/components/ui/card";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BranchAdminDashboardOverview } from "@/features/dashboard/components/branch-admin-dashboard-overview";

type CustomerRow = {
  id: string;
  customer_name: string;
  company_name: string | null;
  mobile: string | null;
  email: string | null;
};

type LedgerRow = {
  id: string;
  name: string;
  code: string;
  current_balance: number;
  currency: string;
};

type RecentEntry = {
  id: string;
  voucher_no: string | null;
  entry_date: string | null;
  type: string | null;
  status: string | null;
  created_at: string | null;
  narration: string | null;
};

type BranchDashboardData = {
  branchName: string;
  branchCode: string;
  currency: string;
  todayCount: number;
  usersCount: number;
  customersCount: number;
  totalLedgersCount: number;
  purchaseTotal: number;
  salesTotal: number;
  purchaseCount: number;
  salesCount: number;
  cashBalance: number;
  bankBalance: number;
  pendingPayments: number;
  productsCount: number;
  ledgers: LedgerRow[];
  customers: CustomerRow[];
  recentRoznamcha: RecentEntry[];
  databaseReady: boolean;
  error: string | null;
};

async function loadBranchDashboardData(
  sessionCountryBranchId: string | null,
  sessionCityBranchId: string | null
): Promise<BranchDashboardData> {
  try {
    const supabase = createSupabaseAdminClient() as any;

    let branchName = "Branch Scoped";
    let branchCode = "BR";
    let countryId = "";
    let currency = "USD";
    let queryField = "";
    let queryValue = "";

    if (sessionCityBranchId) {
      const res = await supabase
        .from("city_branches")
        .select("name, code, country_id, local_currency")
        .eq("id", sessionCityBranchId)
        .maybeSingle();
      branchName = res.data?.name || "City Branch";
      branchCode = res.data?.code || "CBR";
      countryId = res.data?.country_id || "";
      currency = res.data?.local_currency || "USD";
      queryField = "city_branch_id";
      queryValue = sessionCityBranchId;
    } else if (sessionCountryBranchId) {
      const res = await supabase
        .from("country_branches")
        .select("name, code, country_id, local_currency")
        .eq("id", sessionCountryBranchId)
        .maybeSingle();
      branchName = res.data?.name || "Main Branch";
      branchCode = res.data?.code || "MBR";
      countryId = res.data?.country_id || "";
      currency = res.data?.local_currency || "USD";
      queryField = "country_branch_id";
      queryValue = sessionCountryBranchId;
    } else {
      throw new Error("No branch scope configuration found in active user session");
    }

    const todayStr = new Date().toISOString().split("T")[0];

    const [
      todayPostings,
      usersRes,
      customersCountRes,
      ledgersRes,
      customersRes,
      recentRows,
      purchaseRows,
      salesRows,
      productsCountRes
    ] = await Promise.all([
      supabase.from("roznamcha_entries").select("id", { count: "exact", head: true }).eq(queryField, queryValue).eq("entry_date", todayStr).is("deleted_at", null),
      supabase.from("user_role_assignments").select("user_id", { count: "exact", head: true }).eq(queryField, queryValue).eq("is_active", true).is("deleted_at", null),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("country_id", countryId).is("deleted_at", null),
      supabase.from("ledgers").select("id, name, code, current_balance, currency").eq(queryField, queryValue).is("deleted_at", null).order("code"),
      supabase.from("customers").select("id, customer_name, company_name, mobile, email").eq("country_id", countryId).is("deleted_at", null).order("customer_name").limit(8),
      supabase
        .from("roznamcha_entries")
        .select("id, voucher_no, entry_date, type, status, created_at, narration")
        .eq(queryField, queryValue)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("purchase_orders").select("order_total, payment_status, status").eq(queryField, queryValue).is("deleted_at", null),
      supabase.from("sales_orders").select("order_total, payment_status, status").eq(queryField, queryValue).is("deleted_at", null),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("country_id", countryId).is("deleted_at", null)
    ]);

    const rawLedgers = ledgersRes.data ?? [];
    const purchaseTotal = (purchaseRows.data ?? []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
    const salesTotal = (salesRows.data ?? []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
    const cashBalance = rawLedgers
      .filter((l: any) => `${l.name || ""} ${l.code || ""}`.toLowerCase().includes("cash"))
      .reduce((sum: number, l: any) => sum + Number(l.current_balance || 0), 0);
    const bankBalance = rawLedgers
      .filter((l: any) => `${l.name || ""} ${l.code || ""}`.toLowerCase().includes("bank"))
      .reduce((sum: number, l: any) => sum + Number(l.current_balance || 0), 0);

    const ledgers: LedgerRow[] = rawLedgers.map((l: any) => ({
      id: l.id,
      name: l.name,
      code: l.code,
      current_balance: Number(l.current_balance || 0),
      currency: l.currency || currency
    }));

    const customers: CustomerRow[] = (customersRes.data ?? []).map((c: any) => ({
      id: c.id,
      customer_name: c.customer_name,
      company_name: c.company_name,
      mobile: c.mobile,
      email: c.email
    }));

    const recentRoznamcha: RecentEntry[] = (recentRows.data ?? []).map((row: any) => ({
      id: row.id,
      voucher_no: row.voucher_no,
      entry_date: row.entry_date,
      type: row.type,
      status: row.status,
      created_at: row.created_at,
      narration: row.narration
    }));

    return {
      branchName,
      branchCode,
      currency,
      todayCount: todayPostings.count || 0,
      usersCount: usersRes.count || 0,
      customersCount: customersCountRes.count || 0,
      totalLedgersCount: ledgers.length,
      purchaseTotal,
      salesTotal,
      purchaseCount: purchaseRows.data?.length || 0,
      salesCount: salesRows.data?.length || 0,
      cashBalance,
      bankBalance,
      pendingPayments: Math.max(purchaseTotal - salesTotal, 0),
      productsCount: productsCountRes.count || 0,
      ledgers,
      customers,
      recentRoznamcha,
      databaseReady: true,
      error: null
    };
  } catch (error) {
    return {
      branchName: "Branch Dashboard",
      branchCode: "BR",
      currency: "USD",
      todayCount: 0,
      usersCount: 0,
      customersCount: 0,
      totalLedgersCount: 0,
      purchaseTotal: 0,
      salesTotal: 0,
      purchaseCount: 0,
      salesCount: 0,
      cashBalance: 0,
      bankBalance: 0,
      pendingPayments: 0,
      productsCount: 0,
      ledgers: [],
      customers: [],
      recentRoznamcha: [],
      databaseReady: false,
      error: error instanceof Error ? error.message : "Failed to load branch data"
    };
  }
}

export default async function CityDashboardPage() {
  const session = await getCurrentErpSession();

  const cityBranchId = session?.cityBranchIds?.[0] || null;
  const countryBranchId = session?.countryBranchIds?.[0] || null;

  if (!cityBranchId && !countryBranchId) {
    return (
      <div className="p-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold">Branch Access Required</h2>
            <p className="mt-1 text-sm">Your user role does not have an assigned City Branch or Country Branch. Please contact administration to assign your branch location.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = await loadBranchDashboardData(countryBranchId, cityBranchId);

  return (
    <div className="space-y-6">
      {!data.databaseReady ? (
        <Card className="border-red-200 bg-red-50 text-red-900 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-300">
          <CardContent className="p-4 text-sm font-semibold">
            Branch data could not load: {data.error}
          </CardContent>
        </Card>
      ) : null}
      <BranchAdminDashboardOverview data={data} />
    </div>
  );
}
