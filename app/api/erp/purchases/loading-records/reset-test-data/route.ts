export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  return handleReset();
}

export async function POST(request: NextRequest) {
  return handleReset();
}

async function handleReset() {
  try {
    const supabase = createSupabaseAdminClient() as any;

    // 1. Delete all old test loading records
    const { error: delErr } = await supabase
      .from("purchase_loading_records")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (delErr) {
      console.error("Delete error:", delErr);
    }

    // 2. Fetch existing PO or create a test PO
    let poId: string | null = null;
    let poNo = "PO-202607-0001";
    let countryId: string | null = null;
    let countryBranchId: string | null = null;

    const { data: existingPo } = await supabase
      .from("purchase_orders")
      .select("id, purchase_order_no, country_id, country_branch_id")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (existingPo) {
      poId = existingPo.id;
      poNo = existingPo.purchase_order_no || poNo;
      countryId = existingPo.country_id || null;
      countryBranchId = existingPo.country_branch_id || null;
    } else {
      const { data: newPo, error: poErr } = await supabase
        .from("purchase_orders")
        .insert({
          purchase_order_no: poNo,
          order_total: 500000,
          advance_paid: 100000,
          remaining_due: 400000,
          currency_code: "USD",
          exchange_rate: 3.67,
          payment_status: "partially_paid",
          form_data: {
            form: {
              purchaseOrderNo: poNo,
              supplierName: "HAZELNUT TRADING LLC",
              companyName: "DGT TRADING GROUP",
              branchName: "United Arab Emirates Main Branch",
              purchaseAccountNo: "UAE-DR-0001",
              purchaseAccountName: "Purchase Account (Hazelnuts)",
              salesAccountNo: "UAE-CR-0003",
              salesAccountName: "HAZELNUT SUPPLIER CR",
              goodsName: "HAZELNUTS - ORGANIC - Medium",
              brand: "DGT PREMIUM",
              quantity: 1000,
              totalAmount: 500000,
              advanceAmount: 100000,
              currencyType: "USD",
              exchangeRate: 3.67,
              coursePrice: 500,
              priceType: "P/Unit"
            },
            goodsEntries: [
              {
                goodsName: "HAZELNUTS - ORGANIC - Medium",
                brand: "DGT PREMIUM",
                qtyNo: 1000,
                coursePrice: 500,
                priceType: "P/Unit",
                totalAmount: 500000
              }
            ],
            totals: {
              totalQuantity: 1000,
              grandFinal: 500000
            },
            workflow: {
              totalQuantity: 1000,
              loadedQuantity: 395,
              remainingQuantity: 605,
              totalContainers: 10,
              loadedContainers: 3,
              remainingContainers: 7,
              containerStatus: "Partially Loaded"
            }
          }
        })
        .select()
        .single();

      if (!poErr && newPo) {
        poId = newPo.id;
      }
    }

    // 3. Create 3 fresh test loading entries with exact pro-rated values
    const testLoadings = [
      {
        loading_record_no: "PLR-202607-001",
        purchase_order_id: poId,
        purchase_order_no: poNo,
        container_number: "MSCU-4829102",
        container_type: "40 FT",
        loading_status: "loaded",
        loaded_at: new Date("2026-07-15T09:00:00Z").toISOString(),
        loading_location: "Chaman Border",
        receiving_location: "Jebel Ali Port, Dubai",
        shipment_status: "partial_loaded",
        carrier_name: "MSC ADRIATIC",
        remarks: "First container shipment loaded successfully.",
        loaded_quantity: 75,
        total_quantity: 1000,
        loading_percentage: 7.5,
        loaded_purchase_amount: 37500,
        loaded_advance_amount: 7500,
        purchase_currency: "USD",
        exchange_rate: 3.67,
        loaded_purchase_local: 137625,
        loaded_advance_local: 27525,
        remaining_loading_balance: 110100,
        local_currency: "AED",
        country_id: countryId,
        country_branch_id: countryBranchId,
        report_payload: {
          blNumber: "BL-DXB-9011",
          containerCount: 1,
          loadedQuantity: 75,
          loadingQuantity: 75,
          runningLoadedQuantity: 75,
          balanceQuantity: 925,
          grossWeight: 3825,
          netWeight: 3750,
          priceRateC1: 500,
          priceType: "P/Unit",
          pricingCurrency: "USD",
          exchangeRatePKR: 3.67,
          goodsName: "HAZELNUTS - ORGANIC - Medium",
          brand: "DGT PREMIUM",
          vesselName: "MSC ADRIATIC",
          loadingPort: "Chaman Border",
          loadingDate: "2026-07-15",
          receivingPort: "Jebel Ali Port, Dubai",
          receivingDate: "2026-07-28"
        }
      },
      {
        loading_record_no: "PLR-202607-002",
        purchase_order_id: poId,
        purchase_order_no: poNo,
        container_number: "CMAU-7729104",
        container_type: "40 FT",
        loading_status: "loaded",
        loaded_at: new Date("2026-07-18T11:30:00Z").toISOString(),
        loading_location: "Bandar Abbas Port",
        receiving_location: "Jebel Ali Port, Dubai",
        shipment_status: "partial_loaded",
        carrier_name: "CMA CGM MARSEILLE",
        remarks: "Second container shipment loaded.",
        loaded_quantity: 120,
        total_quantity: 1000,
        loading_percentage: 12.0,
        loaded_purchase_amount: 60000,
        loaded_advance_amount: 12000,
        purchase_currency: "USD",
        exchange_rate: 3.67,
        loaded_purchase_local: 220200,
        loaded_advance_local: 44040,
        remaining_loading_balance: 176160,
        local_currency: "AED",
        country_id: countryId,
        country_branch_id: countryBranchId,
        report_payload: {
          blNumber: "BL-DXB-9012",
          containerCount: 1,
          loadedQuantity: 120,
          loadingQuantity: 120,
          runningLoadedQuantity: 195,
          balanceQuantity: 805,
          grossWeight: 6120,
          netWeight: 6000,
          priceRateC1: 500,
          priceType: "P/Unit",
          pricingCurrency: "USD",
          exchangeRatePKR: 3.67,
          goodsName: "HAZELNUTS - ORGANIC - Medium",
          brand: "DGT PREMIUM",
          vesselName: "CMA CGM MARSEILLE",
          loadingPort: "Bandar Abbas Port",
          loadingDate: "2026-07-18",
          receivingPort: "Jebel Ali Port, Dubai",
          receivingDate: "2026-07-30"
        }
      },
      {
        loading_record_no: "PLR-202607-003",
        purchase_order_id: poId,
        purchase_order_no: poNo,
        container_number: "MAEU-8819205",
        container_type: "40 FT",
        loading_status: "loaded",
        loaded_at: new Date("2026-07-21T14:00:00Z").toISOString(),
        loading_location: "Karachi Port",
        receiving_location: "Jebel Ali Port, Dubai",
        shipment_status: "partial_loaded",
        carrier_name: "MAERSK SEALAND",
        remarks: "Third shipment loaded with 200 bags.",
        loaded_quantity: 200,
        total_quantity: 1000,
        loading_percentage: 20.0,
        loaded_purchase_amount: 100000,
        loaded_advance_amount: 20000,
        purchase_currency: "USD",
        exchange_rate: 3.67,
        loaded_purchase_local: 367000,
        loaded_advance_local: 73400,
        remaining_loading_balance: 293600,
        local_currency: "AED",
        country_id: countryId,
        country_branch_id: countryBranchId,
        report_payload: {
          blNumber: "BL-DXB-9013",
          containerCount: 1,
          loadedQuantity: 200,
          loadingQuantity: 200,
          runningLoadedQuantity: 395,
          balanceQuantity: 605,
          grossWeight: 10200,
          netWeight: 10000,
          priceRateC1: 500,
          priceType: "P/Unit",
          pricingCurrency: "USD",
          exchangeRatePKR: 3.67,
          goodsName: "HAZELNUTS - ORGANIC - Medium",
          brand: "DGT PREMIUM",
          vesselName: "MAERSK SEALAND",
          loadingPort: "Karachi Port",
          loadingDate: "2026-07-21",
          receivingPort: "Jebel Ali Port, Dubai",
          receivingDate: "2026-08-02"
        }
      }
    ];

    const { data: inserted, error: insertErr } = await supabase
      .from("purchase_loading_records")
      .insert(testLoadings)
      .select();

    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message || "Insert failed" });
    }

    return NextResponse.json({
      ok: true,
      message: "Test loading records reset successfully.",
      count: inserted?.length || 0,
      records: inserted
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 200 });
  }
}
