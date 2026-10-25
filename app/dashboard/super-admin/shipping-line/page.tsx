import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  SuperAdminShippingDashboardView,
  type SuperAdminShippingData,
  type CountryShippingSummary
} from "@/features/dashboard/components/super-admin-shipping-dashboard-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Super Management Shipping Line Dashboard" };
export const dynamic = "force-dynamic";

async function loadSuperAdminShippingData(): Promise<SuperAdminShippingData> {
  const supabase = createSupabaseAdminClient() as any;

  // 1. Countries
  const { data: countriesRes } = await supabase
    .from("countries")
    .select("id, name, code, currency_code")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const countriesList: CountryShippingSummary[] = (countriesRes ?? []).map((c: any) => ({
    countryId: c.id,
    countryName: c.name || "Country",
    countryCode: c.code || "GL",
    currency: c.currency_code || "USD",
    branchCount: 0,
    totalShipments: 0,
    inTransit: 0,
    arrived: 0
  }));

  const countryMap = new Map<string, CountryShippingSummary>();
  countriesList.forEach((c) => countryMap.set(c.countryId, c));

  // 2. City branches
  const { data: cityBranches } = await supabase
    .from("city_branches")
    .select("id, country_id")
    .is("deleted_at", null);

  (cityBranches ?? []).forEach((cb: any) => {
    if (cb.country_id && countryMap.has(cb.country_id)) {
      countryMap.get(cb.country_id)!.branchCount++;
    }
  });

  // 3. Shipping records across all countries
  const [shippingLineRes, blRes, clearingOrdersRes] = await Promise.all([
    supabase
      .from("shipping_line_records")
      .select("id, country_id, shipment_status, port_of_discharge, bl_number, vessel_name, created_at")
      .is("deleted_at", null)
      .limit(1000),
    supabase
      .from("shipping_bl_records")
      .select("id, country_id, shipment_status, port_of_discharge, bl_number, vessel_name, created_at")
      .is("deleted_at", null)
      .limit(1000),
    supabase
      .from("clearing_customer_orders")
      .select("id, country_id, shipment_status, destination_port_name, bl_number, vessel_name, created_at")
      .is("deleted_at", null)
      .limit(1000)
  ]);

  const allRecords = [
    ...(shippingLineRes.data ?? []).map((r: any) => ({
      id: r.id,
      countryId: r.country_id,
      status: (r.shipment_status || "pending").toLowerCase(),
      port: r.port_of_discharge || "Port",
      blNumber: r.bl_number || "BL",
      vesselName: r.vessel_name || "Vessel"
    })),
    ...(blRes.data ?? []).map((r: any) => ({
      id: r.id,
      countryId: r.country_id,
      status: (r.shipment_status || "pending").toLowerCase(),
      port: r.port_of_discharge || "Port",
      blNumber: r.bl_number || "BL",
      vesselName: r.vessel_name || "Vessel"
    })),
    ...(clearingOrdersRes.data ?? []).map((r: any) => ({
      id: r.id,
      countryId: r.country_id,
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

    if (rec.countryId && countryMap.has(rec.countryId)) {
      const c = countryMap.get(rec.countryId)!;
      c.totalShipments++;
      if (rec.status.includes("transit") || rec.status.includes("sailing")) {
        c.inTransit++;
      } else if (rec.status.includes("arrived") || rec.status.includes("completed")) {
        c.arrived++;
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

  const countryWiseShipments = countriesList.map((c) => ({
    countryName: c.countryName,
    shipments: c.totalShipments
  }));

  const recentShipments = allRecords.slice(0, 10).map((r) => ({
    id: r.id,
    blNumber: r.blNumber,
    countryName: countryMap.get(r.countryId)?.countryName || "Global",
    vesselName: r.vesselName,
    portOfDischarge: r.port,
    status: r.status
  }));

  return {
    totalBranches: (cityBranches ?? []).length,
    totalCountries: countriesList.length,
    totalShipments,
    inTransitCount,
    arrivedCount,
    pendingCount,
    delayedCount,
    statusBreakdown,
    countryWiseShipments,
    countries: countriesList,
    recentShipments
  };
}

export default async function SuperAdminShippingLinePage() {
  const session = await getCurrentErpSession();

  if (!session) {
    redirect("/auth/login" as Route);
  }

  const isSuperAdmin = session.isSuperAdmin;
  const isShippingSuperAdmin = session.roles.includes("shipping_super_admin") || session.roles.includes("global_operations_admin");

  if (!isSuperAdmin && !isShippingSuperAdmin) {
    redirect("/dashboard" as Route);
  }

  const data = await loadSuperAdminShippingData();

  return <SuperAdminShippingDashboardView data={data} />;
}
