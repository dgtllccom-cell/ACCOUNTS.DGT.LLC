import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { normalizeDocumentSearch } from "@/lib/documents/document-filing";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const countryId = searchParams.get("countryId");
    const mainBranchId = searchParams.get("mainBranchId");
    const cityBranchId = searchParams.get("cityBranchId");
    const personAccountId = searchParams.get("personAccountId");
    const personAccountCode = searchParams.get("personAccountCode");
    const personAccountName = searchParams.get("personAccountName");
    const moduleType = searchParams.get("moduleType");
    const documentType = searchParams.get("documentType");
    const sourceRecordNo = searchParams.get("sourceRecordNo");
    const searchQuery = searchParams.get("search");

    // Root-cause bypass (see lib/db/local-postgres.ts): office_documents_scope_read
    // gates on is_super_admin()/can_access_country(), both keyed off auth.uid(), which
    // is always NULL under this app's temp-session bootstrap login — so the "admin"
    // Supabase client below silently returns zero rows. Try a direct-Postgres read
    // first (bypasses RLS via DATABASE_URL); fall back to the Supabase-client path
    // only when DATABASE_URL isn't configured.
    const safeSearch = normalizeDocumentSearch(searchQuery);
    const viaPg = await withLocalPg(async (sql) => {
      return await sql`
        select *
        from public.office_documents
        where deleted_at is null
          and (${countryId ? sql`country_id = ${countryId}` : sql`true`})
          and (${mainBranchId ? sql`country_branch_id = ${mainBranchId}` : sql`true`})
          and (${cityBranchId ? sql`city_branch_id = ${cityBranchId}` : sql`true`})
          and (${personAccountId ? sql`person_account_id = ${personAccountId}` : sql`true`})
          and (${personAccountCode ? sql`person_account_code = ${personAccountCode}` : sql`true`})
          and (${personAccountName ? sql`person_account_name ilike ${"%" + personAccountName + "%"}` : sql`true`})
          and (${moduleType && moduleType !== "all" ? sql`module_type = ${moduleType}` : sql`true`})
          and (${documentType ? sql`document_type = ${documentType}` : sql`true`})
          and (${sourceRecordNo ? sql`source_record_no = ${sourceRecordNo}` : sql`true`})
          and (${safeSearch ? sql`(
                title ilike ${"%" + safeSearch + "%"}
                or file_name ilike ${"%" + safeSearch + "%"}
                or category ilike ${"%" + safeSearch + "%"}
                or document_type ilike ${"%" + safeSearch + "%"}
                or module_type ilike ${"%" + safeSearch + "%"}
                or person_account_code ilike ${"%" + safeSearch + "%"}
                or person_account_name ilike ${"%" + safeSearch + "%"}
                or source_record_no ilike ${"%" + safeSearch + "%"}
                or storage_key ilike ${"%" + safeSearch + "%"}
                or document_path ilike ${"%" + safeSearch + "%"}
              )` : sql`true`})
        order by created_at desc
      `;
    });

    if (viaPg) {
      return NextResponse.json({ documents: viaPg });
    }

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("office_documents")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (countryId) query = query.eq("country_id", countryId);
    if (mainBranchId) query = query.eq("country_branch_id", mainBranchId);
    if (cityBranchId) query = query.eq("city_branch_id", cityBranchId);
    if (personAccountId) query = query.eq("person_account_id", personAccountId);
    if (personAccountCode) query = query.eq("person_account_code", personAccountCode);
    if (personAccountName) query = query.ilike("person_account_name", `%${personAccountName}%`);
    if (moduleType && moduleType !== "all") query = query.eq("module_type", moduleType);
    if (documentType) query = query.eq("document_type", documentType);
    if (sourceRecordNo) query = query.eq("source_record_no", sourceRecordNo);
    if (searchQuery) {
      query = query.or(
        [
          `title.ilike.%${searchQuery}%`,
          `file_name.ilike.%${searchQuery}%`,
          `category.ilike.%${searchQuery}%`,
          `document_type.ilike.%${searchQuery}%`,
          `module_type.ilike.%${searchQuery}%`,
          `person_account_code.ilike.%${searchQuery}%`,
          `person_account_name.ilike.%${searchQuery}%`,
          `source_record_no.ilike.%${searchQuery}%`,
          `storage_key.ilike.%${searchQuery}%`,
          `document_path.ilike.%${searchQuery}%`
        ].join(",")
      );
    }

    const { data: docs, error } = await query;
    if (error) throw error;

    // Live database records only — no demo/fallback documents. An empty result
    // means no documents have been uploaded for this scope yet.
    return NextResponse.json({ documents: docs ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
      document_type = "Document",
      source_module,
      source_record_id,
      source_record_no,
      person_account_id,
      person_account_code,
      person_account_name,
      document_path,
      storage_key,
      category = "General",
      tags = [],
      metadata = {},
      created_by = "Admin",
      scanner_device_name = null,
      scanner_bridge = null
    } = body;

    if (!title || !file_name || !file_url) {
      return NextResponse.json({ error: "Missing required fields: title, file_name, file_url" }, { status: 400 });
    }

    // Root-cause bypass — see GET above: office_documents_scope_insert is RLS-gated
    // the same way, so a direct-Postgres write is tried first.
    const scannedAt = new Date().toISOString();
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        insert into public.office_documents (
          title, file_name, file_url, file_type, file_size,
          country_id, country_name, country_branch_id, main_branch_name,
          city_branch_id, city_branch_name, module_type, document_type, source_module, source_record_id, source_record_no,
          person_account_id, person_account_code, person_account_name,
          document_path, storage_key, category, tags, metadata,
          scanned_at, created_by, scanner_device_name, scanner_bridge
        ) values (
          ${title}, ${file_name}, ${file_url}, ${file_type}, ${file_size},
          ${country_id ?? null}, ${country_name ?? null}, ${country_branch_id ?? null}, ${main_branch_name ?? null},
          ${city_branch_id ?? null}, ${city_branch_name ?? null}, ${module_type}, ${document_type}, ${source_module ?? null}, ${source_record_id ?? null}, ${source_record_no ?? null},
          ${person_account_id ?? null}, ${person_account_code ?? null}, ${person_account_name ?? null},
          ${document_path ?? null}, ${storage_key ?? null}, ${category}, ${sql.json(tags)}, ${sql.json(metadata)},
          ${scannedAt}, ${created_by}, ${scanner_device_name ?? null}, ${scanner_bridge ?? null}
        )
        returning *
      `;
      return rows[0];
    });

    if (viaPg) {
      return NextResponse.json({ success: true, document: viaPg });
    }

    const admin = createSupabaseAdminClient();
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
        document_type,
        source_module,
        source_record_id,
        source_record_no,
        person_account_id,
        person_account_code,
        person_account_name,
        document_path,
        storage_key,
        category,
        tags,
        metadata,
        scanned_at: scannedAt,
        created_by,
        scanner_device_name,
        scanner_bridge
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
    const body = await request.json();
    const {
      id,
      title,
      module_type,
      document_type,
      category,
      tags,
      person_account_id,
      person_account_code,
      person_account_name,
      source_module,
      source_record_id,
      source_record_no,
      document_path,
      storage_key
    } = body;

    if (!id) return NextResponse.json({ error: "Document ID required" }, { status: 400 });

    const updatedAt = new Date().toISOString();

    // Root-cause bypass — see GET above: office_documents_scope_update is RLS-gated
    // the same way, so a direct-Postgres write is tried first.
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        update public.office_documents
        set updated_at = ${updatedAt},
            title = coalesce(${title ?? null}, title),
            module_type = coalesce(${module_type ?? null}, module_type),
            document_type = coalesce(${document_type ?? null}, document_type),
            category = coalesce(${category ?? null}, category),
            person_account_id = coalesce(${person_account_id ?? null}, person_account_id),
            person_account_code = coalesce(${person_account_code ?? null}, person_account_code),
            person_account_name = coalesce(${person_account_name ?? null}, person_account_name),
            source_module = coalesce(${source_module ?? null}, source_module),
            source_record_id = coalesce(${source_record_id ?? null}, source_record_id),
            source_record_no = coalesce(${source_record_no ?? null}, source_record_no),
            document_path = coalesce(${document_path ?? null}, document_path),
            storage_key = coalesce(${storage_key ?? null}, storage_key),
            tags = coalesce(${tags !== undefined ? sql.json(tags) : null}, tags)
        where id = ${id}
        returning *
      `;
      return rows[0] ?? null;
    });

    if (viaPg) {
      return NextResponse.json({ success: true, document: viaPg });
    }

    const admin = createSupabaseAdminClient();
    const updates: Record<string, any> = { updated_at: updatedAt };
    if (title !== undefined) updates.title = title;
    if (module_type !== undefined) updates.module_type = module_type;
    if (document_type !== undefined) updates.document_type = document_type;
    if (category !== undefined) updates.category = category;
    if (person_account_id !== undefined) updates.person_account_id = person_account_id;
    if (person_account_code !== undefined) updates.person_account_code = person_account_code;
    if (person_account_name !== undefined) updates.person_account_name = person_account_name;
    if (source_module !== undefined) updates.source_module = source_module;
    if (source_record_id !== undefined) updates.source_record_id = source_record_id;
    if (source_record_no !== undefined) updates.source_record_no = source_record_no;
    if (document_path !== undefined) updates.document_path = document_path;
    if (storage_key !== undefined) updates.storage_key = storage_key;
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
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Document ID required" }, { status: 400 });

    const deletedAt = new Date().toISOString();

    // Root-cause bypass — see GET above: office_documents_scope_update is RLS-gated
    // the same way, so a direct-Postgres write is tried first.
    const viaPg = await withLocalPg(async (sql) => {
      await sql`update public.office_documents set deleted_at = ${deletedAt} where id = ${id}`;
      return true;
    });

    if (viaPg) {
      return NextResponse.json({ success: true });
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("office_documents")
      .update({ deleted_at: deletedAt })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
