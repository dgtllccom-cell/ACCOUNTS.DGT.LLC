import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  const envFiles = [".env.local", ".env"];
  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) continue;
    const content = fs.readFileSync(envFile, "utf8");
    const match = content.match(/^DATABASE_URL=(.*)$/m);
    if (match?.[1]) {
      return match[1].trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    }
  }
  throw new Error("DATABASE_URL not found in environment or local env files");
}

const sql = postgres(loadDatabaseUrl(), { max: 1, ssl: "require" });

try {
  await sql.begin(async (tx) => {
    await tx`
      insert into storage.buckets (id, name, public)
      values ('erp-documents', 'erp-documents', false)
      on conflict (id) do update
      set name = excluded.name,
          public = excluded.public
    `;

    await tx`drop policy if exists office_documents_bucket_select on storage.objects`;
    await tx`
      create policy office_documents_bucket_select
        on storage.objects
        for select
        to authenticated
        using (bucket_id = 'erp-documents')
    `;

    await tx`drop policy if exists office_documents_bucket_insert on storage.objects`;
    await tx`
      create policy office_documents_bucket_insert
        on storage.objects
        for insert
        to authenticated
        with check (bucket_id = 'erp-documents')
    `;

    await tx`drop policy if exists office_documents_bucket_update on storage.objects`;
    await tx`
      create policy office_documents_bucket_update
        on storage.objects
        for update
        to authenticated
        using (bucket_id = 'erp-documents')
        with check (bucket_id = 'erp-documents')
    `;

    await tx`drop policy if exists office_documents_bucket_delete on storage.objects`;
    await tx`
      create policy office_documents_bucket_delete
        on storage.objects
        for delete
        to authenticated
        using (bucket_id = 'erp-documents')
    `;

    const bucket = await tx`
      select id, name, public
      from storage.buckets
      where id = 'erp-documents'
      limit 1
    `;

    console.log(JSON.stringify({ ok: true, bucket: bucket[0] ?? null }, null, 2));
  });
} finally {
  await sql.end({ timeout: 5 });
}
