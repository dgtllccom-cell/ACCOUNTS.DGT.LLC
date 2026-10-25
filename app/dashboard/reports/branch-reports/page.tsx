import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  BranchShippingReportsView,
  type BranchReportData,
  type BranchReportBranch
} from "@/features/reports/components/branch-shipping-reports-view";

export const metadata = { title: "Branch Reports Suite | DGT LLC ERP SYSTEM", description: "Official shipping line branch reports covering operations, tracking, payments, expenses, and ledgers." };

export const dynamic = "force-dynamic";

export default async function BranchReportsPage(props: {
  searchParams?: Promise<{ branchId?: string }>;
}) {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");

  const searchParams = (await props.searchParams) || {};
  const supabase = createSupabaseAdminClient() as any;

  // Resolve Branch Scope
  let targetBranchId: string | null = null;
  const userCityBranches = session.cityBranchIds || [];

  if (session.isSuperAdmin || session.roles.includes("country_admin")) {
    targetBranchId = searchParams.branchId || userCityBranches[0] || null;
  } else {
    // Branch scoped users are strictly scoped to their own branch
    targetBranchId =
      userCityBranches[0] ||
      session.assignments?.[0]?.cityBranchId ||
      null;
  }

  // Fallback to first available city branch if none assigned
  if (!targetBranchId) {
    const { data: firstBranch } = await supabase
      .from("city_branches")
      .select("id")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    targetBranchId = firstBranch?.id || null;
  }

  if (!targetBranchId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm font-semibold">No accessible branch found for reports.</p>
      </div>
    );
  }

  // 1. Fetch branch information
  const { data: branchData } = await supabase
    .from("city_branches")
    .select("id, name, code, city_name, country_id, local_currency")
    .eq("id", targetBranchId)
    .maybeSingle();

  let countryName = "Pakistan";
  if (branchData?.country_id) {
    const { data: countryData } = await supabase
      .from("countries")
      .select("name")
      .eq("id", branchData.country_id)
      .maybeSingle();
    if (countryData?.name) {
      countryName = countryData.name;
    }
  }

  const branch: BranchReportBranch = {
    id: branchData?.id || targetBranchId,
    name: branchData?.name || branchData?.city_name || "City Branch",
    code: branchData?.code || "BR",
    cityName: branchData?.city_name || undefined,
    countryName,
    currency: branchData?.local_currency || "PKR"
  };

  // 2. Fetch parallel data for reports
  const [
    shippingLinesRes,
    shippingBlsRes,
    roznamchaRes,
    ledgersRes
  ] = await Promise.all([
    // Shipping Line Records
    supabase
      .from("shipping_line_records")
      .select("id, bl_number, container_number, vessel_name, port_of_discharge, shipment_status, eta, customer_name, created_at")
      .eq("city_branch_id", targetBranchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(150),

    // Shipping BL Records
    supabase
      .from("shipping_bl_records")
      .select("id, bl_number, container_no, vessel_name, destination_port_name, status, eta, consignee_name, created_at")
      .eq("city_branch_id", targetBranchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(150),

    // Roznamcha Entries
    supabase
      .from("roznamcha_entries")
      .select("id, entry_date, voucher_no, debit_amount, credit_amount, transaction_type, remarks, status")
      .eq("city_branch_id", targetBranchId)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .limit(200),

    // Ledgers
    supabase
      .from("ledgers")
      .select("id, account_title, account_code, current_balance, currency, account_type")
      .eq("city_branch_id", targetBranchId)
      .is("deleted_at", null)
      .order("account_code", { ascending: true })
      .limit(150)
  ]);

  // Map Shipments
  const shipments: BranchReportData["shipments"] = [];
  const seenBls = new Set<string>();

  (shippingLinesRes.data || []).forEach((r: any) => {
    const bl = r.bl_number || "BL-UNKNOWN";
    seenBls.add(bl);
    shipments.push({
      id: r.id,
      blNumber: bl,
      containerNo: r.container_number || "-",
      vesselName: r.vessel_name || "-",
      destinationPort: r.port_of_discharge || "Karachi Port",
      status: r.shipment_status || "In Transit",
      consignee: r.customer_name || "Customer",
      eta: r.eta ? new Date(r.eta).toLocaleDateString() : undefined,
      date: r.created_at ? new Date(r.created_at).toLocaleDateString() : undefined
    });
  });

  (shippingBlsRes.data || []).forEach((b: any) => {
    const bl = b.bl_number || "BL-UNKNOWN";
    if (!seenBls.has(bl)) {
      seenBls.add(bl);
      shipments.push({
        id: b.id,
        blNumber: bl,
        containerNo: b.container_no || "-",
        vesselName: b.vessel_name || "-",
        destinationPort: b.destination_port_name || "Karachi Port",
        status: b.status || "In Transit",
        consignee: b.consignee_name || "Consignee",
        eta: b.eta ? new Date(b.eta).toLocaleDateString() : undefined,
        date: b.created_at ? new Date(b.created_at).toLocaleDateString() : undefined
      });
    }
  });

  // Map Tracking
  const tracking: BranchReportData["tracking"] = shipments.map((s) => ({
    id: s.id,
    containerNo: s.containerNo,
    blNumber: s.blNumber,
    vesselName: s.vesselName,
    status: s.status,
    port: s.destinationPort,
    eta: s.eta
  }));

  // Map Roznamcha
  const roznamcha: BranchReportData["roznamcha"] = (roznamchaRes.data || []).map((r: any) => ({
    id: r.id,
    voucherNo: r.voucher_no || `VR-${r.id.substring(0, 6).toUpperCase()}`,
    date: r.entry_date || "Today",
    type: r.transaction_type || "Cash",
    debit: Number(r.debit_amount) || 0,
    credit: Number(r.credit_amount) || 0,
    remarks: r.remarks || "",
    status: r.status || "Posted"
  }));

  // Map Expenses from Roznamcha where debit > 0 and transaction_type is EXPENSE or PAYMENT
  const expenses: BranchReportData["expenses"] = (roznamchaRes.data || [])
    .filter((r: any) => {
      const type = (r.transaction_type || "").toUpperCase();
      return type.includes("EXPENSE") || type.includes("PAYMENT") || Number(r.debit_amount) > 0;
    })
    .map((r: any) => ({
      id: r.id,
      voucherNo: r.voucher_no || `EXP-${r.id.substring(0, 6).toUpperCase()}`,
      date: r.entry_date || "Today",
      category: r.transaction_type || "Operating Expense",
      amount: Number(r.debit_amount) || Number(r.credit_amount) || 0,
      currency: branch.currency,
      remarks: r.remarks || "Branch Expense"
    }));

  // Map Ledgers
  const ledgers: BranchReportData["ledgers"] = (ledgersRes.data || []).map((l: any) => {
    const rawType = (l.account_type || "").toLowerCase();
    const title = (l.account_title || "").toLowerCase();
    let type: BranchReportData["ledgers"][0]["type"] = "other";

    if (rawType.includes("cash") || rawType.includes("bank") || title.includes("cash") || title.includes("bank")) {
      type = "cash_bank";
    } else if (rawType.includes("customer") || title.includes("customer")) {
      type = "customer";
    } else if (rawType.includes("supplier") || rawType.includes("vendor") || title.includes("supplier")) {
      type = "supplier";
    } else if (rawType.includes("expense") || title.includes("expense")) {
      type = "expense";
    }

    return {
      id: l.id,
      accountTitle: l.account_title || "Account",
      accountCode: l.account_code || "ACC",
      currency: l.currency || branch.currency,
      currentBalance: Number(l.current_balance) || 0,
      type
    };
  });

  const reportData: BranchReportData = {
    branch,
    shipments,
    tracking,
    roznamcha,
    expenses,
    ledgers
  };

  return <BranchShippingReportsView data={reportData} />;
}
