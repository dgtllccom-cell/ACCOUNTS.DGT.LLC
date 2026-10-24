import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  BranchShippingDashboardView,
  type BranchShippingData
} from "@/features/dashboard/components/branch-shipping-dashboard-view";
import { Card, CardContent } from "@/components/ui/card";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Branch Shipping Line Dashboard" };
export const dynamic = "force-dynamic";

type BranchOption = {
  id: string;
  name: string;
  code: string;
  type: "country" | "city";
  cityName?: string;
  countryName?: string;
  currency: string;
};

async function loadBranchShippingData(
  countryBranchId: string | null,
  cityBranchId: string | null
): Promise<BranchShippingData> {
  const supabase = createSupabaseAdminClient() as any;

  let branchName = "City Branch";
  let branchCode = "BR";
  let countryName = "Pakistan";
  let currency = "PKR";
  let queryField: "city_branch_id" | "country_branch_id" = "city_branch_id";
  let queryValue: string = cityBranchId || "";

  if (cityBranchId) {
    const res = await supabase
      .from("city_branches")
      .select("id, name, code, country_id, local_currency, city_name")
      .eq("id", cityBranchId)
      .maybeSingle();

    branchName = res.data?.name || res.data?.city_name || "City Branch";
    branchCode = res.data?.code || "BR";
    currency = res.data?.local_currency || "PKR";
    queryField = "city_branch_id";
    queryValue = cityBranchId;

    if (res.data?.country_id) {
      const cRes = await supabase
        .from("countries")
        .select("name")
        .eq("id", res.data.country_id)
        .maybeSingle();
      countryName = cRes.data?.name || "Pakistan";
    }
  } else if (countryBranchId) {
    const res = await supabase
      .from("country_branches")
      .select("id, name, code, country_id, local_currency")
      .eq("id", countryBranchId)
      .maybeSingle();

    branchName = res.data?.name || "Main Branch";
    branchCode = res.data?.code || "MBR";
    currency = res.data?.local_currency || "USD";
    queryField = "country_branch_id";
    queryValue = countryBranchId;

    if (res.data?.country_id) {
      const cRes = await supabase
        .from("countries")
        .select("name")
        .eq("id", res.data.country_id)
        .maybeSingle();
      countryName = cRes.data?.name || "Global";
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];

  const q = <T,>(p: PromiseLike<T>): Promise<{ data: any; count: number | null; error: any }> =>
    Promise.resolve(p).then(
      (r: any) => ({ data: r?.data ?? null, count: r?.count ?? null, error: r?.error ?? null }),
      (e: any) => ({ data: null, count: null, error: e })
    );

  const [
    todayPostingsRes,
    shippingLineRowsRes,
    blRecordsRes,
    clearingOrdersRes,
    ledgersRes
  ] = await Promise.all([
    q(
      supabase
        .from("roznamcha_entries")
        .select("id", { count: "exact", head: true })
        .eq(queryField, queryValue)
        .eq("entry_date", todayStr)
        .is("deleted_at", null)
    ),
    q(
      supabase
        .from("shipping_line_records")
        .select("id, shipping_reference_no, vessel_name, voyage_number, port_of_discharge, shipment_status, eta, created_at")
        .eq(queryField, queryValue)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100)
    ),
    q(
      supabase
        .from("shipping_bl_records")
        .select("id, bl_number, vessel_name, voyage_number, discharge_port, shipment_status, eta, created_at")
        .eq(queryField, queryValue)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100)
    ),
    q(
      supabase
        .from("clearing_customer_orders")
        .select("id, order_no, customer_name, destination_port_name, status, created_at")
        .eq(queryField, queryValue)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100)
    ),
    q(
      supabase
        .from("ledgers")
        .select("id, name, code, current_balance, currency")
        .eq(queryField, queryValue)
        .is("deleted_at", null)
        .order("code")
    )
  ]);

  // Aggregate shipments
  const rawShipments = [
    ...(shippingLineRowsRes.data || []).map((r: any) => ({
      id: r.id,
      blNumber: r.shipping_reference_no || `SHP-${r.id.slice(0, 6)}`,
      vesselName: r.vessel_name || "Container Vessel",
      voyageNumber: r.voyage_number || undefined,
      portOfDischarge: r.port_of_discharge || "Karachi Port",
      status: r.shipment_status || "in_transit",
      eta: r.eta || undefined,
      createdAt: r.created_at
    })),
    ...(blRecordsRes.data || []).map((r: any) => ({
      id: r.id,
      blNumber: r.bl_number || `BL-${r.id.slice(0, 6)}`,
      vesselName: r.vessel_name || "Cargo Vessel",
      voyageNumber: r.voyage_number || undefined,
      portOfDischarge: r.discharge_port || "Gwadar Port",
      status: r.shipment_status || "in_transit",
      eta: r.eta || undefined,
      createdAt: r.created_at
    })),
    ...(clearingOrdersRes.data || []).map((r: any) => ({
      id: r.id,
      blNumber: r.order_no || `CLR-${r.id.slice(0, 6)}`,
      vesselName: "Clearing / Cargo",
      portOfDischarge: r.destination_port_name || "Chaman Border Terminal",
      status: r.status || "in_transit",
      customerName: r.customer_name || undefined,
      createdAt: r.created_at
    }))
  ];

  const totalShipments = rawShipments.length;

  let inTransitCount = 0;
  let arrivedCount = 0;
  let pendingCount = 0;
  let delayedCount = 0;

  const portCounts = new Map<string, number>();

  for (const s of rawShipments) {
    const st = (s.status || "").toLowerCase();
    if (st.includes("transit") || st.includes("sail") || st.includes("water") || st.includes("route")) {
      inTransitCount++;
    } else if (st.includes("arrive") || st.includes("deliver") || st.includes("complete") || st.includes("clear")) {
      arrivedCount++;
    } else if (st.includes("delay") || st.includes("hold") || st.includes("except")) {
      delayedCount++;
    } else {
      pendingCount++;
    }

    const port = s.portOfDischarge || "Other";
    portCounts.set(port, (portCounts.get(port) || 0) + 1);
  }

  const portWiseShipments = Array.from(portCounts.entries()).map(([port, count]) => ({
    port,
    shipments: count,
    volume: count * 25
  }));

  if (portWiseShipments.length === 0) {
    portWiseShipments.push(
      { port: "Karachi", shipments: 0, volume: 0 },
      { port: "Gwadar", shipments: 0, volume: 0 },
      { port: "Jebel Ali", shipments: 0, volume: 0 },
      { port: "Bandar Abbas", shipments: 0, volume: 0 }
    );
  }

  const rawLedgers = ledgersRes.data || [];
  const cashBalance = rawLedgers
    .filter((l: any) => `${l.name || ""} ${l.code || ""}`.toLowerCase().includes("cash"))
    .reduce((sum: number, l: any) => sum + Number(l.current_balance || 0), 0);
  const bankBalance = rawLedgers
    .filter((l: any) => `${l.name || ""} ${l.code || ""}`.toLowerCase().includes("bank"))
    .reduce((sum: number, l: any) => sum + Number(l.current_balance || 0), 0);

  const ledgers = rawLedgers.map((l: any) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    current_balance: Number(l.current_balance || 0),
    currency: l.currency || currency
  }));

  const recentShipments = rawShipments
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);

  return {
    branchId: queryValue,
    branchName,
    branchCode,
    countryName,
    currency,
    todayRoznamchaCount: todayPostingsRes.count || 0,
    totalShipments,
    inTransitCount,
    arrivedCount,
    pendingCount,
    delayedCount,
    cashBalance,
    bankBalance,
    statusBreakdown: [
      { name: "In Transit", value: inTransitCount, color: "#2563eb" },
      { name: "Arrived", value: arrivedCount, color: "#10b981" },
      { name: "Pending", value: pendingCount, color: "#f59e0b" },
      { name: "Delayed", value: delayedCount, color: "#ef4444" }
    ],
    portWiseShipments,
    recentShipments,
    ledgers
  };
}

export default async function BranchShippingLineDashboardPage(props: {
  searchParams?: Promise<{ branchId?: string; type?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const lang = await getRequestLanguage();
  const session = await getCurrentErpSession();

  if (!session) {
    redirect("/auth/login" as Route);
  }

  const isSuperAdmin = Boolean(session.isSuperAdmin || session.roles.includes("super_admin"));
  const isBranchAdmin = Boolean(
    isSuperAdmin ||
    session.roles.includes("city_branch_admin") ||
    session.roles.includes("main_branch_admin") ||
    session.roles.includes("shipping_line_admin")
  );

  let cityBranchId = session.cityBranchIds?.[0] || null;
  let countryBranchId = session.countryBranchIds?.[0] || null;

  if (isSuperAdmin && searchParams.branchId) {
    if (searchParams.type === "country") {
      countryBranchId = searchParams.branchId;
      cityBranchId = null;
    } else {
      cityBranchId = searchParams.branchId;
      countryBranchId = null;
    }
  }

  if (!cityBranchId && !countryBranchId) {
    return (
      <div className="p-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold">
              {t(lang, "cpage.branch_access_required", "Branch Access Required")}
            </h2>
            <p className="mt-1 text-sm">
              {t(
                lang,
                "cpage.branch_access_desc",
                "Your user role does not have an assigned City Branch or Country Branch. Please contact administration to assign your branch location."
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dashboardData = await loadBranchShippingData(countryBranchId, cityBranchId);
  dashboardData.isBranchAdmin = isBranchAdmin;
  dashboardData.canSwitchToBusiness =
    isSuperAdmin ||
    session.operationalDomains?.includes("business") ||
    session.operationalDomains?.includes("both") ||
    session.roles.includes("city_branch_admin") ||
    session.roles.includes("country_admin");

  return <BranchShippingDashboardView data={dashboardData} />;
}
