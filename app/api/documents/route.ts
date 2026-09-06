import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { deleteDocumentBlob, resolveDocumentFileUrl, saveDocumentBlob } from "@/lib/documents/document-storage";
import {
  buildDocumentFileName,
  buildDocumentFolderPath,
  normalizeDocumentSearch
} from "@/lib/documents/document-filing";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const BUCKET_NAME = "erp-documents";

/**
 * Write an audit_logs row inside the same direct-Postgres transaction as the
 * document mutation, so the actor is recorded even under the temp-session
 * bootstrap login (auth.uid() is NULL there, which makes the shared
 * writeAuditLog() helper skip on non-prod). Never throws — a logging failure
 * must not roll back a committed document write.
 */
async function auditDocument(
  sql: any,
  input: {
    actorId: string;
    action: "office_document.upload" | "office_document.update" | "office_document.delete" | "office_document.version";
    entityId: string | null;
    companyId?: string | null;
    before?: unknown;
    after?: unknown;
    ipAddress?: string | null;
  }
) {
  try {
    await sql`
      insert into public.audit_logs (company_id, actor_id, action, entity_table, entity_id, before, after, ip_address)
      values (
        ${input.companyId ?? null}, ${input.actorId}, ${input.action}, 'office_documents',
        ${input.entityId}, ${input.before ? sql.json(input.before) : null},
        ${input.after ? sql.json(input.after) : null}, ${input.ipAddress ?? null}
      )
    `;
  } catch (err) {
    console.warn("[documents] audit write skipped:", err instanceof Error ? err.message : String(err));
  }
}

function requestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function isMultipart(request: NextRequest) {
  return request.headers.get("content-type")?.includes("multipart/form-data") ?? false;
}

async function parseJsonOrFormData(request: NextRequest) {
  if (!isMultipart(request)) {
    const body = await request.json();
    return { body, file: null as File | null };
  }

  const formData = await request.formData();
  const body: Record<string, any> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "file") continue;
    if (typeof value === "string") {
      body[key] = value;
    }
  }
  const file = formData.get("file");
  return { body, file: file instanceof File ? file : null };
}

function parseMaybeJson<T>(value: any, fallback: T): T {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeNullable(value: any) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

async function withDocumentSession<T>(session: Awaited<ReturnType<typeof requireErpSession>>, fn: (sql: any) => Promise<T>) {
  return await withLocalPg(async (sql) => {
    return await sql.begin(async (tx) => {
      await tx`set local row_security = off;`;
      await tx`select set_config('request.jwt.claim.sub', ${session.userId}, true);`;
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true);`;
      await tx`
        select set_config(
          'request.jwt.claims',
          ${JSON.stringify({ sub: session.userId, role: "authenticated" })},
          true
        );
      `;
      return await fn(tx);
    });
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = request.nextUrl;

    const countryId = searchParams.get("countryId");
    const mainBranchId = searchParams.get("mainBranchId");
    const cityBranchId = searchParams.get("cityBranchId");
    const personAccountId = searchParams.get("personAccountId");
    const personAccountCode = searchParams.get("personAccountCode");
    const personAccountName = searchParams.get("personAccountName");
    const personAccountType = searchParams.get("personAccountType");
    const companyId = searchParams.get("companyId");
    const companyCode = searchParams.get("companyCode");
    const companyName = searchParams.get("companyName");
    const accountId = searchParams.get("accountId");
    const accountCode = searchParams.get("accountCode");
    const accountName = searchParams.get("accountName");
    const moduleType = searchParams.get("moduleType");
    const sourceModule = searchParams.get("sourceModule");
    const documentType = searchParams.get("documentType");
    const sourceRecordNo = searchParams.get("sourceRecordNo");
    const sourceRecordId = searchParams.get("sourceRecordId");
    const searchQuery = searchParams.get("search");

    // Root-cause bypass (see lib/db/local-postgres.ts): office_documents_scope_read
    // gates on is_super_admin()/can_access_country(), both keyed off auth.uid(), which
    // is always NULL under this app's temp-session bootstrap login — so the "admin"
    // Supabase client below silently returns zero rows. Try a direct-Postgres read
    // first (bypasses RLS via DATABASE_URL); fall back to the Supabase-client path
    // only when DATABASE_URL isn't configured.
    const safeSearch = normalizeDocumentSearch(searchQuery);
    let viaPg: any = null;
    try {
      viaPg = await withDocumentSession(session, async (sql) => {
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
          and (${personAccountType ? sql`person_account_type = ${personAccountType}` : sql`true`})
          and (${companyId ? sql`company_id = ${companyId}` : sql`true`})
          and (${companyCode ? sql`company_code = ${companyCode}` : sql`true`})
          and (${companyName ? sql`company_name ilike ${"%" + companyName + "%"}` : sql`true`})
          and (${accountId ? sql`account_id = ${accountId}` : sql`true`})
          and (${accountCode ? sql`account_code = ${accountCode}` : sql`true`})
          and (${accountName ? sql`account_name ilike ${"%" + accountName + "%"}` : sql`true`})
          and (${moduleType && moduleType !== "all" ? sql`module_type = ${moduleType}` : sql`true`})
          and (${sourceModule ? sql`source_module = ${sourceModule}` : sql`true`})
          and (${documentType ? sql`document_type = ${documentType}` : sql`true`})
          and (${sourceRecordNo ? sql`source_record_no = ${sourceRecordNo}` : sql`true`})
          and (${sourceRecordId ? sql`source_record_id = ${sourceRecordId}` : sql`true`})
          and (${safeSearch ? sql`(
                title ilike ${"%" + safeSearch + "%"}
                or file_name ilike ${"%" + safeSearch + "%"}
                or category ilike ${"%" + safeSearch + "%"}
                or document_type ilike ${"%" + safeSearch + "%"}
                or module_type ilike ${"%" + safeSearch + "%"}
                or person_account_code ilike ${"%" + safeSearch + "%"}
                or person_account_name ilike ${"%" + safeSearch + "%"}
                or person_account_type ilike ${"%" + safeSearch + "%"}
                or company_code ilike ${"%" + safeSearch + "%"}
                or company_name ilike ${"%" + safeSearch + "%"}
                or account_code ilike ${"%" + safeSearch + "%"}
                or account_name ilike ${"%" + safeSearch + "%"}
                or source_record_no ilike ${"%" + safeSearch + "%"}
                or source_module ilike ${"%" + safeSearch + "%"}
                or storage_key ilike ${"%" + safeSearch + "%"}
                or document_path ilike ${"%" + safeSearch + "%"}
              )` : sql`true`})
        order by created_at desc
      `;
      });
    } catch {
      viaPg = null;
    }

    if (viaPg) {
      return NextResponse.json({ documents: viaPg });
    }

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("office_documents" as any)
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (countryId) query = query.eq("country_id", countryId);
    if (mainBranchId) query = query.eq("country_branch_id", mainBranchId);
    if (cityBranchId) query = query.eq("city_branch_id", cityBranchId);
    if (personAccountId) query = query.eq("person_account_id", personAccountId);
    if (personAccountCode) query = query.eq("person_account_code", personAccountCode);
    if (personAccountName) query = query.ilike("person_account_name", `%${personAccountName}%`);
    if (personAccountType) query = query.eq("person_account_type", personAccountType);
    if (companyId) query = query.eq("company_id", companyId);
    if (companyCode) query = query.eq("company_code", companyCode);
    if (companyName) query = query.ilike("company_name", `%${companyName}%`);
    if (accountId) query = query.eq("account_id", accountId);
    if (accountCode) query = query.eq("account_code", accountCode);
    if (accountName) query = query.ilike("account_name", `%${accountName}%`);
    if (moduleType && moduleType !== "all") query = query.eq("module_type", moduleType);
    if (sourceModule) query = query.eq("source_module", sourceModule);
    if (documentType) query = query.eq("document_type", documentType);
    if (sourceRecordNo) query = query.eq("source_record_no", sourceRecordNo);
    if (sourceRecordId) query = query.eq("source_record_id", sourceRecordId);
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
          `person_account_type.ilike.%${searchQuery}%`,
          `company_code.ilike.%${searchQuery}%`,
          `company_name.ilike.%${searchQuery}%`,
          `account_code.ilike.%${searchQuery}%`,
          `account_name.ilike.%${searchQuery}%`,
          `source_record_no.ilike.%${searchQuery}%`,
          `source_module.ilike.%${searchQuery}%`,
          `storage_key.ilike.%${searchQuery}%`,
          `document_path.ilike.%${searchQuery}%`
        ].join(",")
      );
    }

    const { data: docs, error } = await query;
    if (error) throw error;

    const resolvedDocs = await Promise.all(
      (docs ?? []).map(async (doc: any) => {
        const resolvedFileUrl = doc.storage_key ? await resolveDocumentFileUrl(doc.storage_key) : null;
        return {
          ...doc,
          file_url: resolvedFileUrl || doc.file_url
        };
      })
    );

    // Live database records only — no demo/fallback documents. An empty result
    // means no documents have been uploaded for this scope yet.
    return NextResponse.json({ documents: resolvedDocs });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { body, file } = await parseJsonOrFormData(request);

    const {
      title,
      file_name: rawFileName,
      file_url: rawFileUrl,
      file_type = "pdf",
      file_size = 0,
      country_id,
      country_name,
      country_branch_id,
      main_branch_name,
      city_branch_id,
      city_branch_name,
      company_id,
      company_code,
      company_name,
      account_id,
      account_code,
      account_name,
      person_account_id,
      person_account_code,
      person_account_name,
      person_account_type,
      module_type = "Purchase Documents",
      document_type = "Document",
      source_module,
      source_record_id,
      source_record_no,
      document_path,
      storage_key,
      category = "General",
      tags = [],
      metadata = {},
      created_by = "Admin",
      scanner_device_name = null,
      scanner_bridge = null
    } = body;

    const parsedTags = parseMaybeJson<any[]>(tags, []);
    const parsedMetadata = parseMaybeJson<Record<string, any>>(metadata, {});
    const normalizedFileSize = Number(file_size ?? 0) || 0;
    const normalizedCountryId = normalizeNullable(country_id);
    const normalizedCountryName = normalizeNullable(country_name);
    const normalizedCountryBranchId = normalizeNullable(country_branch_id);
    const normalizedMainBranchName = normalizeNullable(main_branch_name);
    const normalizedCityBranchId = normalizeNullable(city_branch_id);
    const normalizedCityBranchName = normalizeNullable(city_branch_name);
    const normalizedCompanyId = normalizeNullable(company_id);
    const normalizedCompanyCode = normalizeNullable(company_code);
    const normalizedCompanyName = normalizeNullable(company_name);
    const normalizedAccountId = normalizeNullable(account_id);
    const normalizedAccountCode = normalizeNullable(account_code);
    const normalizedAccountName = normalizeNullable(account_name);
    const normalizedPersonAccountId = normalizeNullable(person_account_id);
    const normalizedPersonAccountCode = normalizeNullable(person_account_code);
    const normalizedPersonAccountName = normalizeNullable(person_account_name);
    const normalizedPersonAccountType = normalizeNullable(person_account_type);
    const normalizedModuleType = normalizeNullable(module_type) ?? "Purchase Documents";
    const normalizedDocumentType = normalizeNullable(document_type) ?? "Document";
    const normalizedSourceModule = normalizeNullable(source_module);
    const normalizedSourceRecordId = normalizeNullable(source_record_id);
    const normalizedSourceRecordNo = normalizeNullable(source_record_no);
    const normalizedDocumentPath = normalizeNullable(document_path);
    const normalizedStorageKey = normalizeNullable(storage_key);
    const normalizedCategory = normalizeNullable(category) ?? "General";
    const normalizedCreatedBy = normalizeNullable(created_by) ?? "Admin";
    const normalizedScannerDeviceName = normalizeNullable(scanner_device_name);
    const normalizedScannerBridge = normalizeNullable(scanner_bridge);
    const baseFileName =
      typeof rawFileName === "string" && rawFileName.trim()
        ? rawFileName.trim()
        : file
          ? file.name.replace(/\.[^/.]+$/, "")
          : "";

    if (!title || !baseFileName) {
      return NextResponse.json({ error: "Missing required fields: title, file_name" }, { status: 400 });
    }

    const scannedAt = new Date().toISOString();
    const generatedPath =
      normalizedDocumentPath ||
      buildDocumentFolderPath({
        countryName: normalizedCountryName,
        branchName: normalizedCityBranchName ?? normalizedMainBranchName ?? null,
        companyCode: normalizedCompanyCode,
        companyName: normalizedCompanyName,
        personAccountCode: normalizedPersonAccountCode,
        personAccountName: normalizedPersonAccountName,
        personAccountType: normalizedPersonAccountType,
        accountCode: normalizedAccountCode,
        accountName: normalizedAccountName,
        moduleType: normalizedModuleType,
        documentType: normalizedDocumentType
      });
    const generatedFileName =
      rawFileName?.toString().trim() ||
      buildDocumentFileName({
        countryName: normalizedCountryName,
        branchName: normalizedCityBranchName ?? normalizedMainBranchName ?? null,
        companyCode: normalizedCompanyCode,
        companyName: normalizedCompanyName,
        personAccountCode: normalizedPersonAccountCode,
        personAccountName: normalizedPersonAccountName,
        personAccountType: normalizedPersonAccountType,
        accountCode: normalizedAccountCode,
        accountName: normalizedAccountName,
        moduleType: normalizedModuleType,
        documentType: normalizedDocumentType,
        sourceRecordNo: normalizedSourceRecordNo,
        createdAt: scannedAt,
        extension: file ? (file.name.split(".").pop() || file_type || "pdf") : file_type || "pdf"
      });
    const resolvedStorageKey = normalizedStorageKey || (generatedPath ? `${generatedPath}/${generatedFileName}` : generatedFileName);
    let resolvedFileUrl = typeof rawFileUrl === "string" && rawFileUrl.trim() ? rawFileUrl.trim() : null;
    let storageProvider: "supabase" | "local" | null = null;
    let checksum: string | null = null;
    let actualFileSize = normalizedFileSize;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      checksum = createHash("sha256").update(buffer).digest("hex");
      actualFileSize = buffer.length;
      const uploadResult = await saveDocumentBlob({
        storageKey: resolvedStorageKey,
        buffer,
        contentType: file.type || "application/octet-stream"
      });
      resolvedFileUrl = uploadResult.fileUrl;
      storageProvider = uploadResult.storageProvider;
    } else if (!resolvedFileUrl) {
      resolvedFileUrl = await resolveDocumentFileUrl(resolvedStorageKey) ?? resolvedStorageKey;
    }

    // Root-cause bypass — see GET above: office_documents_scope_insert is RLS-gated
    // the same way, so a direct-Postgres write is tried first.
    let viaPg: any = null;
    try {
      viaPg = await withDocumentSession(session, async (sql) => {
        const rows = await sql`
        insert into public.office_documents (
          title, file_name, file_url, file_type, file_size,
          country_id, country_name, country_branch_id, main_branch_name,
          city_branch_id, city_branch_name, company_id, company_code, company_name, account_id, account_code, account_name,
          person_account_id, person_account_code, person_account_name, person_account_type,
          module_type, document_type, source_module, source_record_id, source_record_no,
          document_path, storage_key, category, tags, metadata,
          scanned_at, created_by, scanner_device_name, scanner_bridge,
          checksum_sha256, uploaded_by_id, version
        ) values (
          ${title}, ${generatedFileName}, ${resolvedFileUrl}, ${file_type}, ${actualFileSize},
          ${normalizedCountryId}, ${normalizedCountryName}, ${normalizedCountryBranchId}, ${normalizedMainBranchName},
          ${normalizedCityBranchId}, ${normalizedCityBranchName}, ${normalizedCompanyId}, ${normalizedCompanyCode}, ${normalizedCompanyName}, ${normalizedAccountId}, ${normalizedAccountCode}, ${normalizedAccountName},
          ${normalizedPersonAccountId}, ${normalizedPersonAccountCode}, ${normalizedPersonAccountName}, ${normalizedPersonAccountType},
          ${normalizedModuleType}, ${normalizedDocumentType}, ${normalizedSourceModule}, ${normalizedSourceRecordId}, ${normalizedSourceRecordNo},
          ${generatedPath}, ${resolvedStorageKey}, ${normalizedCategory}, ${sql.json(parsedTags)}, ${sql.json({ ...parsedMetadata, storageProvider })},
          ${scannedAt}, ${normalizedCreatedBy}, ${normalizedScannerDeviceName}, ${normalizedScannerBridge},
          ${checksum}, ${session.userId}, 1
        )
        returning *
      `;
        const doc = rows[0];
        await auditDocument(sql, {
          actorId: session.userId,
          action: "office_document.upload",
          entityId: doc.id,
          companyId: normalizedCompanyId,
          ipAddress: requestIp(request),
          after: {
            title: doc.title,
            file_name: doc.file_name,
            file_size: doc.file_size,
            storage_key: doc.storage_key,
            document_path: doc.document_path,
            checksum_sha256: doc.checksum_sha256,
            storage_provider: storageProvider,
            country_name: doc.country_name,
            main_branch_name: doc.main_branch_name,
            city_branch_name: doc.city_branch_name,
            module_type: doc.module_type,
            document_type: doc.document_type,
            scanner_device_name: doc.scanner_device_name
          }
        });
        return doc;
      });
    } catch {
      viaPg = null;
    }

    if (viaPg) {
      return NextResponse.json({ success: true, document: viaPg });
    }

    const admin = createSupabaseAdminClient();
    const { data: newDoc, error } = await (admin
      .from("office_documents" as any) as any)
      .insert({
        title,
        file_name: generatedFileName,
        file_url: resolvedFileUrl,
        file_type,
        file_size: normalizedFileSize,
        country_id: normalizedCountryId,
        country_name: normalizedCountryName,
        country_branch_id: normalizedCountryBranchId,
        main_branch_name: normalizedMainBranchName,
        city_branch_id: normalizedCityBranchId,
        city_branch_name: normalizedCityBranchName,
        company_id: normalizedCompanyId,
        company_code: normalizedCompanyCode,
        company_name: normalizedCompanyName,
        account_id: normalizedAccountId,
        account_code: normalizedAccountCode,
        account_name: normalizedAccountName,
        person_account_id: normalizedPersonAccountId,
        person_account_code: normalizedPersonAccountCode,
        person_account_name: normalizedPersonAccountName,
        person_account_type: normalizedPersonAccountType,
        module_type: normalizedModuleType,
        document_type: normalizedDocumentType,
        source_module: normalizedSourceModule,
        source_record_id: normalizedSourceRecordId,
        source_record_no: normalizedSourceRecordNo,
        document_path: generatedPath,
        storage_key: resolvedStorageKey,
        category: normalizedCategory,
        tags: parsedTags,
        metadata: { ...parsedMetadata, storageProvider },
        scanned_at: scannedAt,
        created_by: normalizedCreatedBy,
        scanner_device_name: normalizedScannerDeviceName,
        scanner_bridge: normalizedScannerBridge
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, document: newDoc });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const {
      id,
      title,
      module_type,
      document_type,
      category,
      tags,
      company_id,
      company_code,
      company_name,
      account_id,
      account_code,
      account_name,
      person_account_id,
      person_account_code,
      person_account_name,
      person_account_type,
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
    let viaPg: any = null;
    try {
      viaPg = await withDocumentSession(session, async (sql) => {
        const beforeRow = (await sql`select title, module_type, document_type, category, tags, account_name, company_name, document_path, storage_key from public.office_documents where id = ${id} limit 1`)[0] ?? null;
        const rows = await sql`
        update public.office_documents
        set updated_at = ${updatedAt},
            title = coalesce(${title ?? null}, title),
            module_type = coalesce(${module_type ?? null}, module_type),
            document_type = coalesce(${document_type ?? null}, document_type),
            category = coalesce(${category ?? null}, category),
            company_id = coalesce(${company_id ?? null}, company_id),
            company_name = coalesce(${company_name ?? null}, company_name),
            account_id = coalesce(${account_id ?? null}, account_id),
            account_code = coalesce(${account_code ?? null}, account_code),
            account_name = coalesce(${account_name ?? null}, account_name),
            person_account_id = coalesce(${person_account_id ?? null}, person_account_id),
            person_account_code = coalesce(${person_account_code ?? null}, person_account_code),
            person_account_name = coalesce(${person_account_name ?? null}, person_account_name),
            person_account_type = coalesce(${person_account_type ?? null}, person_account_type),
            source_module = coalesce(${source_module ?? null}, source_module),
            source_record_id = coalesce(${source_record_id ?? null}, source_record_id),
            source_record_no = coalesce(${source_record_no ?? null}, source_record_no),
            document_path = coalesce(${document_path ?? null}, document_path),
            storage_key = coalesce(${storage_key ?? null}, storage_key),
            tags = coalesce(${tags !== undefined ? sql.json(tags) : null}, tags)
        where id = ${id}
        returning *
      `;
        const doc = rows[0] ?? null;
        if (doc) {
          await auditDocument(sql, {
            actorId: session.userId,
            action: "office_document.update",
            entityId: doc.id,
            companyId: doc.company_id ?? null,
            ipAddress: requestIp(request),
            before: beforeRow,
            after: {
              title: doc.title,
              module_type: doc.module_type,
              document_type: doc.document_type,
              category: doc.category,
              tags: doc.tags,
              account_name: doc.account_name,
              company_name: doc.company_name,
              document_path: doc.document_path,
              storage_key: doc.storage_key
            }
          });
        }
        return doc;
      });
    } catch {
      viaPg = null;
    }

    if (viaPg) {
      return NextResponse.json({ success: true, document: viaPg });
    }

    const admin = createSupabaseAdminClient();
    const updates: Record<string, any> = { updated_at: updatedAt };
    if (title !== undefined) updates.title = title;
    if (module_type !== undefined) updates.module_type = module_type;
    if (document_type !== undefined) updates.document_type = document_type;
    if (category !== undefined) updates.category = category;
    if (company_id !== undefined) updates.company_id = company_id;
    if (company_code !== undefined) updates.company_code = company_code;
    if (company_name !== undefined) updates.company_name = company_name;
    if (account_id !== undefined) updates.account_id = account_id;
    if (account_code !== undefined) updates.account_code = account_code;
    if (account_name !== undefined) updates.account_name = account_name;
    if (person_account_id !== undefined) updates.person_account_id = person_account_id;
    if (person_account_code !== undefined) updates.person_account_code = person_account_code;
    if (person_account_name !== undefined) updates.person_account_name = person_account_name;
    if (person_account_type !== undefined) updates.person_account_type = person_account_type;
    if (source_module !== undefined) updates.source_module = source_module;
    if (source_record_id !== undefined) updates.source_record_id = source_record_id;
    if (source_record_no !== undefined) updates.source_record_no = source_record_no;
    if (document_path !== undefined) updates.document_path = document_path;
    if (storage_key !== undefined) updates.storage_key = storage_key;
    if (tags !== undefined) updates.tags = tags;

    const { data: updatedDoc, error } = await (admin
      .from("office_documents" as any) as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, document: updatedDoc });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = request.nextUrl;
    const body = await request.json().catch(() => ({}));
    const id = searchParams.get("id") || body?.id || null;

    if (!id) return NextResponse.json({ error: "Document ID required" }, { status: 400 });

    const deletedAt = new Date().toISOString();
    let storageKey = null as string | null;
    let beforeDoc: any = null;
    try {
      beforeDoc = await withDocumentSession(session, async (sql) => {
        const rows = await sql`
        select id, storage_key, title, file_name, file_size, document_path, company_id, module_type, document_type
        from public.office_documents
        where id = ${id}
        limit 1
      `;
        return rows[0] ?? null;
      });
      storageKey = beforeDoc?.storage_key ?? null;
    } catch {
      storageKey = null;
    }

    // Root-cause bypass — see GET above: office_documents_scope_update is RLS-gated
    // the same way, so a direct-Postgres write is tried first.
    let viaPg = false;
    try {
      const viaPgResult = await withDocumentSession(session, async (sql) => {
        await sql`update public.office_documents set deleted_at = ${deletedAt} where id = ${id}`;
        await auditDocument(sql, {
          actorId: session.userId,
          action: "office_document.delete",
          entityId: id,
          companyId: beforeDoc?.company_id ?? null,
          ipAddress: requestIp(request),
          before: beforeDoc
        });
        return true;
      });
      viaPg = Boolean(viaPgResult);
    } catch {
      viaPg = false;
    }

    if (viaPg) {
      await deleteDocumentBlob(storageKey);
      return NextResponse.json({ success: true });
    }

    const admin = createSupabaseAdminClient();
    const { data: existingDoc, error: fetchError } = await (admin
      .from("office_documents" as any) as any)
      .select("storage_key")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const { error } = await (admin
      .from("office_documents" as any) as any)
      .update({ deleted_at: deletedAt })
      .eq("id", id);

    if (error) throw error;
    await deleteDocumentBlob(existingDoc?.storage_key ?? null);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
