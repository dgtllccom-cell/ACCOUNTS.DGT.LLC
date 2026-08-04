/**
 * apply-return-sms-reply-migration.mjs
 * Runs all pending WhatsApp / Communication Centre migrations safely.
 *
 * FIX: replaces sql.unsafe(entireFile) with statement-by-statement execution
 * to avoid UNSAFE_TRANSACTION and "cannot run inside a transaction block" errors
 * that occur when DDL statements like CREATE TYPE / DROP TABLE are batched.
 */

import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const root = process.cwd();
const env = {
  ...readEnv(path.join(root, '.env')),
  ...readEnv(path.join(root, '.env.local')),
  ...process.env,
};

const PROD_REF = "inmayhrxucimxqhgseqi";
const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(`DATABASE_URL environment variable is missing.`);
}

const isProdTarget = databaseUrl.includes(PROD_REF);
if (env.APP_ENV === "production" && !isProdTarget) {
  throw new Error(`Production DATABASE_URL must target project (${PROD_REF}). Found: ${databaseUrl}`);
}

/**
 * Split SQL file content into individual statements, handling:
 * - Dollar-quoted function bodies ($$ ... $$)
 * - Standard semicolon-delimited statements
 * - Empty / comment-only segments
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inDollarQuote = false;
  let dollarTag = '';
  let i = 0;

  while (i < sql.length) {
    // Line comment
    if (inLineComment) {
      current += sql[i];
      if (sql[i] === '\n') {
        inLineComment = false;
      }
      i++;
      continue;
    }

    // Block comment
    if (inBlockComment) {
      current += sql[i];
      if (sql[i] === '*' && sql[i + 1] === '/') {
        current += '/';
        i += 2;
        inBlockComment = false;
        continue;
      }
      i++;
      continue;
    }

    // Dollar quote block ($$ or $BODY$)
    if (inDollarQuote) {
      if (sql.slice(i).startsWith(dollarTag)) {
        current += dollarTag;
        i += dollarTag.length;
        inDollarQuote = false;
        dollarTag = '';
        continue;
      }
      current += sql[i];
      i++;
      continue;
    }

    // Single quoted string ('...')
    if (inSingleQuote) {
      current += sql[i];
      if (sql[i] === "'") {
        if (sql[i + 1] === "'") {
          current += "'";
          i += 2;
          continue;
        } else {
          inSingleQuote = false;
        }
      }
      i++;
      continue;
    }

    // Double quoted identifier ("...")
    if (inDoubleQuote) {
      current += sql[i];
      if (sql[i] === '"') {
        if (sql[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
          inDoubleQuote = false;
        }
      }
      i++;
      continue;
    }

    // Start of line comment (-- ...)
    if (sql[i] === '-' && sql[i + 1] === '-') {
      inLineComment = true;
      current += '--';
      i += 2;
      continue;
    }

    // Start of block comment (/* ...)
    if (sql[i] === '/' && sql[i + 1] === '*') {
      inBlockComment = true;
      current += '/*';
      i += 2;
      continue;
    }

    // Start of single quote
    if (sql[i] === "'") {
      inSingleQuote = true;
      current += "'";
      i++;
      continue;
    }

    // Start of double quote
    if (sql[i] === '"') {
      inDoubleQuote = true;
      current += '"';
      i++;
      continue;
    }

    // Start of dollar quote ($$ or $tag$)
    const dollarMatch = sql.slice(i).match(/^\$([A-Za-z_]*)\$/);
    if (dollarMatch) {
      dollarTag = dollarMatch[0];
      inDollarQuote = true;
      current += dollarTag;
      i += dollarTag.length;
      continue;
    }

    // Semicolon outside quotes/comments => statement boundary
    if (sql[i] === ';') {
      current += ';';
      const trimmed = current.trim();
      if (trimmed && trimmed !== ';') {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  const trailing = current.trim();
  if (trailing && trailing !== ';') {
    statements.push(trailing);
  }

  return statements;
}

async function applyMigrations() {
  console.log('\n🔌 Connecting to production Supabase database...');

  const sql = postgres(databaseUrl, {
    ssl: 'require',
    prepare: false,
    max: 1,
    connect_timeout: 10,
    connection: { application_name: 'erp-production-migration-runner' }
  });
  await sql`SELECT 1`;
  console.log(`Connected successfully to production Supabase (${PROD_REF}).`);

  const filesToRun = [
    'supabase/migrations/0066_whatsapp_team_inbox.sql',
    'supabase/migrations/0068_communication_center.sql',
    'supabase/migrations/20260729_return_sms_reply.sql',
    'supabase/migrations/20260730_warehouses_master.sql',
    'supabase/migrations/20260731_clearing_agent_truck_forms.sql',
    'supabase/migrations/20260801_truck_registration.sql',
    'supabase/migrations/20260802_open_entity_serials_and_form_serials.sql',
    'supabase/migrations/20260803_accounting_credit_debit_rates.sql',
    'supabase/migrations/20260804_trucks_base_location.sql',
    'supabase/migrations/20260805_transit_dest_location.sql',
    'supabase/migrations/20260806_loading_dest_location.sql',
    'supabase/migrations/20260807_universal_serial_columns.sql',
    'supabase/migrations/20260808_warehouses_serials.sql',
    'supabase/migrations/20260809_branding_extra_fields.sql',
    'supabase/migrations/20260810_ledger_outstanding_view.sql',
    'supabase/migrations/20260811_branch_branding_override.sql',
  ];

  try {
    for (const file of filesToRun) {
      if (!fs.existsSync(file)) {
        console.warn(`⚠️  File not found, skipping: ${file}`);
        continue;
      }

      console.log(`\n📄 Executing: ${file}`);
      const content = fs.readFileSync(file, 'utf8');
      const statements = splitSqlStatements(content);

      console.log(`   Found ${statements.length} statements to execute...`);

      let succeeded = 0;
      let skipped = 0;

      for (let idx = 0; idx < statements.length; idx++) {
        const stmt = statements[idx];
        // Skip pure comment blocks
        const withoutComments = stmt.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (!withoutComments) { skipped++; continue; }

        // Skip transaction control statements — pgBouncer pooler rejects them
        const normalized = withoutComments.toLowerCase().replace(/\s+/g, ' ').trim();
        if (normalized === 'begin' || normalized === 'commit' || normalized === 'rollback') {
          skipped++;
          continue;
        }

        try {
          await sql.unsafe(stmt);
          succeeded++;
          // Print a dot every 10 statements so user can see progress
          if (succeeded % 10 === 0) process.stdout.write('.');
        } catch (stmtErr) {
          // Tolerate "already exists" / "does not exist" errors — idempotent re-runs are expected
          const msg = stmtErr.message || '';
          const isIdempotentError =
            msg.includes('already exists') ||
            msg.includes('does not exist') ||
            msg.includes('duplicate') ||
            msg.includes('IF NOT EXISTS');

          if (isIdempotentError) {
            skipped++;
          } else {
            // Real error — log the statement and re-throw
            console.error(`\n❌ Error in ${file} statement #${idx + 1}:\n${stmt.slice(0, 200)}`);
            throw stmtErr;
          }
        }
      }

      console.log(`\n   ✅ ${file} — ${succeeded} executed, ${skipped} skipped (already applied).`);
    }

    // Reload PostgREST schema cache so new tables are immediately visible via REST API
    console.log('\n🔄 Reloading Supabase PostgREST Schema Cache...');
    try {
      await sql.unsafe("SELECT pg_notify('pgrst', 'reload schema');");
      console.log('   ✅ Schema cache reload signal sent.');
    } catch (e) {
      console.warn('   ⚠️  pg_notify not available via pooler — you may need to reload manually in Supabase Dashboard.');
    }

    // Verify tables exist
    console.log('\n🔍 Verifying production tables...');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'communication_conversations',
          'communication_messages',
          'communication_attachments',
          'communication_templates',
          'communication_reminder_rules',
          'communication_contact_preferences',
          'communication_audit_logs',
          'whatsapp_accounts',
          'whatsapp_contacts',
          'whatsapp_conversations',
          'whatsapp_messages',
          'whatsapp_message_media',
          'whatsapp_activity_log'
        )
      ORDER BY table_name;
    `;

    console.log(`\n🎉 VERIFIED — ${tables.length} production tables confirmed in database:\n`);
    tables.forEach(t => console.log(`   ✓ public.${t.table_name}`));

    if (tables.length < 7) {
      console.warn('\n⚠️  WARNING: Some expected tables are missing. Check migration output above for errors.');
    } else {
      console.log('\n✅ All required tables are present. Database migration complete.\n');
    }

  } catch (err) {
    console.error('\\nProduction migration failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    try { await sql.end(); } catch (e) {}
  }
}

applyMigrations();
