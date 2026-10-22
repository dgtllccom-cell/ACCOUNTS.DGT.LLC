import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

function parseNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  const num = parseFloat(String(val).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const supabase = createSupabaseAdminClient() as any;
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.toLowerCase();
    const serial = searchParams.get("serial");

    let query = supabase
      .from("transit_entries")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (serial) query = query.eq("entry_serial", serial);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let results = data ?? [];
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
    return NextResponse.json({ success: true, data: results, total: results.length, source: "database" });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const supabase = createSupabaseAdminClient() as any;
    const body = await req.json();

    let entry_serial = body.entry_serial;
    if (!entry_serial) {
      const { data: serialData, error: serialErr } = await supabase.rpc("next_entity_serial", { p_scope_type: "global", p_scope_key: "GLOBAL", p_entity_type: "transit_entries", p_prefix: "TE" });
      if (serialErr || !serialData) throw new Error("Failed to allocate transit serial: " + (serialErr?.message || "empty"));
      entry_serial = String(serialData);
    }

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

    const { data: savedRecord, error: saveErr } = await supabase
      .from("transit_entries")
      .upsert(payload, { onConflict: "entry_serial" })
      .select("*")
      .single();
    if (saveErr || !savedRecord) {
      return NextResponse.json({ success: false, error: saveErr?.message || "Transit entry was not saved." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: savedRecord,
      message: "Transit Entry saved successfully"
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Updates an EXISTING transit entry by its real primary key `id`. POST above
 * upserts on the `entry_serial` UNIQUE constraint, which only behaves like an
 * update when the client resends the same serial — but `entry_serial` is a
 * directly editable text field in the form (transit-entry-management.tsx),
 * so a user changing it while editing silently orphaned the old row and
 * inserted a new one instead of updating. Updating by `id` is immune to that.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    const supabase = createSupabaseAdminClient() as any;
    const body = await req.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    const patch: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    for (const key of [
      "super_agent", "super_agent_name", "country", "country_name", "branch", "branch_name",
      "entry_serial", "invoice_no", "invoice_date", "supplier_no", "supplier_date", "python_no",
      "python_date", "transit_no", "transit_date", "goods_name", "unit", "created_by", "delivered_to",
      "export_company", "import_company", "notify_party", "notes"
    ]) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    for (const key of ["quantity", "gross_weight", "net_weight", "price_per_unit", "total_amount"]) {
      if (body[key] !== undefined) patch[key] = parseNumeric(body[key]);
    }
    if (body.documents !== undefined) patch.documents = Array.isArray(body.documents) ? body.documents : [];

    const { data, error } = await supabase
      .from("transit_entries")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || "Transit entry not found." }, { status: error ? 500 : 404 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: "Transit Entry updated successfully"
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "delete" });
    const supabase = createSupabaseAdminClient() as any;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const serial = searchParams.get("serial");

    if (!id && !serial) {
      return NextResponse.json({ success: false, error: "Missing id or serial" }, { status: 400 });
    }

    let query = supabase.from("transit_entries").update({ deleted_at: new Date().toISOString() });
    if (id) query = query.eq("id", id);
    else query = query.eq("entry_serial", serial);
    const { error: delErr } = await query;
    if (delErr) return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });

    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
