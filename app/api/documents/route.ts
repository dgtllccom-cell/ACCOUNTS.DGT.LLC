import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import postgres from "postgres";

export const dynamic = "force-dynamic";

function getSql() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  return postgres(dbUrl, { max: 1, prepare: false });
}

// Auto-initialize DB table
async function ensureDocumentsTable() {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.office_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        file_type VARCHAR(100) NOT NULL DEFAULT 'pdf',
        file_size BIGINT DEFAULT 0,
        country_id UUID,
        country_name VARCHAR(255) DEFAULT 'Pakistan',
        country_branch_id UUID,
        main_branch_name VARCHAR(255),
        city_branch_id UUID,
        city_branch_name VARCHAR(255),
        module_type VARCHAR(100) NOT NULL DEFAULT 'Purchase Documents',
        category VARCHAR(100) DEFAULT 'General',
        tags JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        scanned_at TIMESTAMPTZ,
        created_by VARCHAR(255) DEFAULT 'System',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_office_docs_hierarchy ON public.office_documents(country_id, country_branch_id, city_branch_id, module_type);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_office_docs_deleted ON public.office_documents(deleted_at);`;
    await sql.end();
  } catch (e) {
    console.error("Document table auto-init error:", e);
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDocumentsTable();
    const admin = createSupabaseAdminClient();
    const { searchParams } = request.nextUrl;
    
    const countryId = searchParams.get("countryId");
    const mainBranchId = searchParams.get("mainBranchId");
    const cityBranchId = searchParams.get("cityBranchId");
    const moduleType = searchParams.get("moduleType");
    const searchQuery = searchParams.get("search");

    let query = admin
      .from("office_documents")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (countryId) query = query.eq("country_id", countryId);
    if (mainBranchId) query = query.eq("country_branch_id", mainBranchId);
    if (cityBranchId) query = query.eq("city_branch_id", cityBranchId);
    if (moduleType && moduleType !== "all") query = query.eq("module_type", moduleType);
    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,file_name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`);
    }

    const { data: docs, error } = await query;
    if (error) throw error;

    // Default mock documents if table is empty
    let documentList = docs ?? [];
    if (documentList.length === 0 && !searchQuery) {
      documentList = [
        {
          id: "doc-demo-1",
          title: "Purchase Container Bill of Lading #BL-9921",
          file_name: "BL-9921-PackingList.pdf",
          file_url: "/exports/DGT_Standard_Branch_Users.pdf",
          file_type: "pdf",
          file_size: 245000,
          country_id: countryId || "c1",
          country_name: "Pakistan",
          country_branch_id: mainBranchId || "b1",
          main_branch_name: "Lahore Main Branch",
          city_branch_id: cityBranchId || "cb1",
          city_branch_name: "Lahore City Branch",
          module_type: "Bills of Lading",
          category: "Shipping",
          tags: ["BL", "Shipping", "Container"],
          scanned_at: new Date().toISOString(),
          created_by: "Super Admin",
          created_at: new Date().toISOString()
        },
        {
          id: "doc-demo-2",
          title: "Commercial Sales Invoice #INV-8810",
          file_name: "INV-8810-Commercial.pdf",
          file_url: "/exports/DGT_Standard_Branch_Users.pdf",
          file_type: "pdf",
          file_size: 180000,
          country_id: countryId || "c1",
          country_name: "Pakistan",
          country_branch_id: mainBranchId || "b1",
          main_branch_name: "Lahore Main Branch",
          city_branch_id: cityBranchId || "cb1",
          city_branch_name: "Lahore City Branch",
          module_type: "Invoices",
          category: "Sales",
          tags: ["Invoice", "Sales", "Tax"],
          scanned_at: new Date().toISOString(),
          created_by: "Branch Accountant",
          created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: "doc-demo-3",
          title: "Supplier Procurement Contract #CON-2026",
          file_name: "Procurement-Contract-2026.docx",
          file_url: "/exports/DGT_Standard_Branch_Users.pdf",
          file_type: "word",
          file_size: 512000,
          country_id: countryId || "c1",
          country_name: "Pakistan",
          country_branch_id: mainBranchId || "b1",
          main_branch_name: "Lahore Main Branch",
          city_branch_id: cityBranchId || "cb1",
          city_branch_name: "Lahore City Branch",
          module_type: "Contracts",
          category: "Legal",
          tags: ["Contract", "Supplier", "Legal"],
          scanned_at: new Date().toISOString(),
          created_by: "Country Admin",
          created_at: new Date(Date.now() - 172800000).toISOString()
        }
      ];
    }

    return NextResponse.json({ documents: documentList });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDocumentsTable();
    const admin = createSupabaseAdminClient();
    const body = await request.json();

    const {
      title,
      file_name,
      file_url,
      file_type = "pdf",
      file_size = 0,
      country_id,
      country_name,
      country_branch_id,
      main_branch_name,
      city_branch_id,
      city_branch_name,
      module_type = "Purchase Documents",
      category = "General",
      tags = [],
      metadata = {},
      created_by = "Admin"
    } = body;

    if (!title || !file_name || !file_url) {
      return NextResponse.json({ error: "Missing required fields: title, file_name, file_url" }, { status: 400 });
    }

    const { data: newDoc, error } = await admin
      .from("office_documents")
      .insert({
        title,
        file_name,
        file_url,
        file_type,
        file_size,
        country_id,
        country_name,
        country_branch_id,
        main_branch_name,
        city_branch_id,
        city_branch_name,
        module_type,
        category,
        tags,
        metadata,
        scanned_at: new Date().toISOString(),
        created_by
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, document: newDoc });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = createSupabaseAdminClient();
    const body = await request.json();
    const { id, title, module_type, category, tags } = body;

    if (!id) return NextResponse.json({ error: "Document ID required" }, { status: 400 });

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (module_type !== undefined) updates.module_type = module_type;
    if (category !== undefined) updates.category = category;
    if (tags !== undefined) updates.tags = tags;

    const { data: updatedDoc, error } = await admin
      .from("office_documents")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, document: updatedDoc });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = createSupabaseAdminClient();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Document ID required" }, { status: 400 });

    const { error } = await admin
      .from("office_documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
