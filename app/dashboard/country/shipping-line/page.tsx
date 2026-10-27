import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCountry } from "@/lib/permissions/middleware";
import { COUNTRY_SHIPPING_DASHBOARD_ROLES } from "@/lib/permissions/branch-page-scope";
import {
  CountryShippingDashboardView,
  type CountryShippingData,
  type CountryShippingBranchSummary
} from "@/features/dashboard/components/country-shipping-dashboard-view";
import { Card, CardContent } from "@/components/ui/card";
import { getRequestLanguage } from "@/lib/i18n/server";
import { translateHeader } from "@/lib/i18n/table-headers";

export const metadata = { title: "Country Shipping Line Dashboard" };
export const dynamic = "force-dynamic";

type CountryOption = {
  id: string;
  name: string;
  code: string;
  currency: string;
};

async function loadCountryShippingData(countryId: string | null): Promise<CountryShippingData> {
  const supabase = createSupabaseAdminClient() as any;

  let countryName = "";
  let countryCode = "";
  let currency = "";

  if (countryId) {
    const { data: country } = await supabase
      .from("countries")
      .select("id, name, code, currency_code")
      .eq("id", countryId)
      .maybeSingle();

    if (country) {
      countryName = country.name || countryName;
      countryCode = country.code || countryCode;
      currency = country.currency_code || currency;
    }
  }

  // Load city branches for this country
  let branchQuery = supabase
    .from("city_branches")
    .select("id, name, code, city_name, local_currency, operational_domain")
    .is("deleted_at", null);

  if (countryId) {
    branchQuery = branchQuery.eq("country_id", countryId);
  }

  const { data: cityBranches } = await branchQuery;
  const branchesList = (cityBranches ?? []).map((b: any) => ({
    id: b.id,
    name: b.name || "Branch",
    code: b.code || "BR",
    cityName: b.city_name || "City",
    currency: b.local_currency || currency,
    activeShipments: 0,
    totalShipments: 0,
    inTransit: 0,
    arrived: 0
  }));

  const branchMap = new Map<string, CountryShippingBranchSummary>();
  branchesList.forEach((b: CountryShippingBranchSummary) => branchMap.set(b.id, b));

  // Query real shipping records for this country
  const [shippingLineRes, blRes, clearingOrdersRes] = await Promise.all([
    supabase
      .from("shipping_line_records")
      .select("id, city_branch_id, shipment_status, port_of_discharge, bl_number, vessel_name, created_at")
      .eq(countryId ? "country_id" : "is_active", countryId ? countryId : true)
      .is("deleted_at", null)
      .limit(500),
    supabase
      .from("shipping_bl_records")
      .select("id, city_branch_id, shipment_status, port_of_discharge, bl_number, vessel_name, created_at")
      .eq(countryId ? "country_id" : "is_active", countryId ? countryId : true)
      .is("deleted_at", null)
      .limit(500),
    supabase
      .from("clearing_customer_orders")
      .select("id, city_branch_id, shipment_status, destination_port_name, bl_number, vessel_name, created_at")
      .eq(countryId ? "country_id" : "is_active", countryId ? countryId : true)
      .is("deleted_at", null)
      .limit(500)
  ]);

  const allRecords = [
    ...(shippingLineRes.data ?? []).map((r: any) => ({
      id: r.id,
      branchId: r.city_branch_id,
      status: (r.shipment_status || "pending").toLowerCase(),
      port: r.port_of_discharge || "Port",
      blNumber: r.bl_number || "BL",
      vesselName: r.vessel_name || "Vessel"
    })),
    ...(blRes.data ?? []).map((r: any) => ({
      id: r.id,
      branchId: r.city_branch_id,
      status: (r.shipment_status || "pending").toLowerCase(),
      port: r.port_of_discharge || "Port",
      blNumber: r.bl_number || "BL",
      vesselName: r.vessel_name || "Vessel"
    })),
    ...(clearingOrdersRes.data ?? []).map((r: any) => ({
      id: r.id,
      branchId: r.city_branch_id,
      status: (r.shipment_status || "pending").toLowerCase(),
      port: r.destination_port_name || "Port",
      blNumber: r.bl_number || "BL",
      vesselName: r.vessel_name || "Vessel"
    }))
  ];

  let inTransitCount = 0;
  let arrivedCount = 0;
  let pendingCount = 0;
  let delayedCount = 0;

  for (const rec of allRecords) {
    if (rec.status.includes("transit") || rec.status.includes("sailing")) {
      inTransitCount++;
    } else if (rec.status.includes("arrived") || rec.status.includes("completed") || rec.status.includes("cleared")) {
      arrivedCount++;
    } else if (rec.status.includes("delayed") || rec.status.includes("hold") || rec.status.includes("danger")) {
      delayedCount++;
    } else {
      pendingCount++;
    }

    if (rec.branchId && branchMap.has(rec.branchId)) {
      const b = branchMap.get(rec.branchId)!;
      b.totalShipments++;
      if (rec.status.includes("transit") || rec.status.includes("sailing")) {
        b.inTransit++;
        b.activeShipments++;
      } else if (rec.status.includes("arrived") || rec.status.includes("completed")) {
        b.arrived++;
      } else {
        b.activeShipments++;
      }
    }
  }

  const totalShipments = allRecords.length;

  const statusBreakdown = [
    { name: "In Transit", value: inTransitCount, color: "#2563eb" },
    { name: "Arrived", value: arrivedCount, color: "#10b981" },
    { name: "Pending", value: pendingCount, color: "#f59e0b" },
    { name: "Delayed", value: delayedCount, color: "#ef4444" }
  ];

  const branchWiseShipments = branchesList.map((b: any) => ({
    branchName: b.cityName || b.name,
    shipments: b.totalShipments
  }));

  const recentShipments = allRecords.slice(0, 10).map((r) => ({
    id: r.id,
    blNumber: r.blNumber,
    branchName: branchMap.get(r.branchId)?.name || "Branch",
    vesselName: r.vesselName,
    portOfDischarge: r.port,
    status: r.status
  }));

  return {
    countryId: countryId || "",
    countryName,
    countryCode,
    currency,
    totalBranches: branchesList.length,
    totalShipments,
    inTransitCount,
    arrivedCount,
    pendingCount,
    delayedCount,
    statusBreakdown,
    branchWiseShipments,
    branches: branchesList,
    recentShipments,
    canSwitchToBusiness: true
  };
}

export default async function CountryShippingLinePage({
  searchParams
}: {
  searchParams?: Promise<{ countryId?: string }>;
}) {
  const session = await getCurrentErpSession();
  const lang = await getRequestLanguage();

  if (!session) {
    redirect("/auth/login" as Route);
  }

  const params = searchParams ? await searchParams : undefined;
  const isSuperAdmin = session.isSuperAdmin;

  // Country level only: a branch login, or any login holding just dashboard:read, never opens the whole country's shipments
  if (!isSuperAdmin && !session.roles.some((r) => (COUNTRY_SHIPPING_DASHBOARD_ROLES as readonly string[]).includes(r))) {
    redirect("/dashboard" as Route);
  }
  // …and only a country of its own scope (?countryId= can no longer reach another country)
  if (params?.countryId && !canAccessCountry(session, params.countryId)) {
    redirect("/dashboard" as Route);
  }

  let countryId: string | null = params?.countryId || null;

  if (!countryId) {
    if (session.countryIds && session.countryIds.length > 0) {
      countryId = session.countryIds[0];
    }
  }

  // Super Admin / Country Admin fallback
  if (!countryId && isSuperAdmin) {
    const supabase = createSupabaseAdminClient() as any;
    const { data: firstCountry } = await supabase
      .from("countries")
      .select("id")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstCountry) {
      countryId = firstCountry.id;
    }
  }

  if (!countryId) {
    return (
      <div className="p-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold">{translateHeader(lang, "COUNTRY")}</h2>
            <p className="mt-1 text-sm">{translateHeader(lang, "COUNTRY")} - {translateHeader(lang, "ROLE")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = await loadCountryShippingData(countryId);

  return <CountryShippingDashboardView data={data} />;
}
