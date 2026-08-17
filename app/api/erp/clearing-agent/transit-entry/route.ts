import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Fallback in-memory store in case of offline / local development without DB connection
const defaultRecords = [
  {
    id: "te-001",
    super_agent: "SA-0001",
    super_agent_name: "Global Cargo Logistics",
    country: "PK - Pakistan",
    country_name: "Pakistan",
    branch: "CHM - Chaman",
    branch_name: "Chaman",
    entry_serial: "TE-0001234",
    invoice_no: "INV-2024-000567",
    invoice_date: "2025-08-18",
    supplier_no: "SUP-000789",
    supplier_date: "2025-08-15",
    python_no: "PYT-001234",
    python_date: "2025-08-12",
    transit_no: "TRN-009876",
    transit_date: "2025-08-19",
    goods_name: "LED TV 42 Inch",
    quantity: 100,
    unit: "PCS",
    gross_weight: 1200,
    net_weight: 1050,
    price_per_unit: 25000,
    total_amount: 2500000,
    created_by: "Ali Khan",
    delivered_to: "Ahmed Shah",
    export_company: "ABC Exporters Ltd.",
    import_company: "XYZ Importers Pvt. Ltd.",
    notify_party: "M/S Bright Traders, Karachi",
    documents: [
      { id: "doc-1", name: "Invoice_INV-2024-000567.pdf", size: "245 KB" },
      { id: "doc-2", name: "PackingList_PYT-001234.pdf", size: "128 KB" }
    ],
    notes: "Transit shipment cleared at Chaman border customs point.",
    status: "active",
    created_at: "2025-08-19T10:30:00.000Z"
  }
];

let memoryStore = [...defaultRecords];

function parseNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  const num = parseFloat(String(val).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.toLowerCase();
    const serial = searchParams.get("serial");

    // 1. Try querying Supabase transit_entries table
    try {
      let query = supabase
        .from("transit_entries")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (serial) {
        query = query.eq("entry_serial", serial);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        let results = data;
        if (q) {
          results = results.filter(
            (r: any) =>
              (r.entry_serial && r.entry_serial.toLowerCase().includes(q)) ||
              (r.invoice_no && r.invoice_no.toLowerCase().includes(q)) ||
              (r.goods_name && r.goods_name.toLowerCase().includes(q)) ||
              (r.export_company && r.export_company.toLowerCase().includes(q)) ||
              (r.import_company && r.import_company.toLowerCase().includes(q)) ||
              (r.transit_no && r.transit_no.toLowerCase().includes(q))
          );
        }
        return NextResponse.json({
          success: true,
          data: results,
          total: results.length,
          source: "database"
        });
      }
    } catch (dbErr) {
      console.warn("Transit entries DB query fallback to memory store:", dbErr);
    }

    // 2. Fallback to memory store
    let records = memoryStore;
    if (serial) {
      records = records.filter((r) => r.entry_serial === serial);
    }
    if (q) {
      records = records.filter(
        (r) =>
          r.entry_serial.toLowerCase().includes(q) ||
          r.invoice_no.toLowerCase().includes(q) ||
          r.goods_name.toLowerCase().includes(q) ||
          r.export_company.toLowerCase().includes(q) ||
          r.import_company.toLowerCase().includes(q) ||
          r.transit_no.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      success: true,
      data: records,
      total: records.length,
      source: "memory"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json();

    const entry_serial = body.entry_serial || "TE-" + String(Math.floor(1000000 + Math.random() * 9000000)).substring(0, 7);

    const payload = {
      super_agent: body.super_agent || "SA-0001",
      super_agent_name: body.super_agent_name || null,
      country: body.country || "PK - Pakistan",
      country_name: body.country_name || (body.country ? body.country.split("-")[1]?.trim() : "Pakistan"),
      branch: body.branch || "CHM - Chaman",
      branch_name: body.branch_name || (body.branch ? body.branch.split("-")[1]?.trim() : "Chaman"),
      entry_serial,
      invoice_no: body.invoice_no || "",
      invoice_date: body.invoice_date || new Date().toISOString().split("T")[0],
      supplier_no: body.supplier_no || "",
      supplier_date: body.supplier_date || new Date().toISOString().split("T")[0],
      python_no: body.python_no || null,
      python_date: body.python_date || null,
      transit_no: body.transit_no || null,
      transit_date: body.transit_date || null,
      goods_name: body.goods_name || "",
      quantity: parseNumeric(body.quantity),
      unit: body.unit || "PCS",
      gross_weight: parseNumeric(body.gross_weight),
      net_weight: parseNumeric(body.net_weight),
      price_per_unit: parseNumeric(body.price_per_unit),
      total_amount: parseNumeric(body.total_amount),
      created_by: body.created_by || "",
      delivered_to: body.delivered_to || "",
      export_company: body.export_company || "",
      import_company: body.import_company || "",
      notify_party: body.notify_party || "",
      documents: Array.isArray(body.documents) ? body.documents : [],
      notes: body.notes || "",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Try saving to Supabase database
    let savedRecord = null;
    try {
      const { data, error } = await supabase
        .from("transit_entries")
        .upsert(payload, { onConflict: "entry_serial" })
        .select("*")
        .single();

      if (!error && data) {
        savedRecord = data;
      }
    } catch (dbErr) {
      console.warn("Failed saving to Supabase DB:", dbErr);
    }

    if (!savedRecord) {
      savedRecord = { id: "te-" + Date.now(), ...payload };
    }

    // Sync to memory store
    memoryStore = [savedRecord, ...memoryStore.filter((m) => m.entry_serial !== entry_serial)];

    return NextResponse.json({
      success: true,
      data: savedRecord,
      message: "Transit Entry saved successfully"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const serial = searchParams.get("serial");

    if (!id && !serial) {
      return NextResponse.json({ success: false, error: "Missing id or serial" }, { status: 400 });
    }

    // Try soft deleting in database
    try {
      let query = supabase.from("transit_entries").update({ deleted_at: new Date().toISOString() });
      if (id) query = query.eq("id", id);
      else if (serial) query = query.eq("entry_serial", serial);
      await query;
    } catch (dbErr) {
      console.warn("DB delete error:", dbErr);
    }

    // Remove from memory store
    memoryStore = memoryStore.filter((r) => (id ? r.id !== id : r.entry_serial !== serial));

    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
