import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

// Always dynamic — runs live DB migrations, must never be cached
export const dynamic = "force-dynamic";

/**
 * GET /api/erp/admin/run-migrations?secret=digitaldock_migrate_2026
 *
 * Runs critical missing table migrations directly on Supabase using the
 * postgres connection string (not through the REST API).
 * Run ONCE after deployment, then the URL can be disabled.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== "digitaldock_migrate_2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const DB_URL = process.env.DATABASE_URL ||
    process.env.DIRECT_URL ||
    "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";

  const sql = postgres(DB_URL, { ssl: "require", max: 1 });
  const results: { table: string; status: string; detail?: string }[] = [];

  const migrations = [
    {
      table: "communication_conversations",
      sql: `
        CREATE TABLE IF NOT EXISTS communication_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
          contact_identifier VARCHAR(255) NOT NULL,
          sender_name VARCHAR(255),
          sender_type VARCHAR(50) DEFAULT 'customer',
          country_id UUID,
          city_branch_id UUID,
          status VARCHAR(30) DEFAULT 'unread',
          priority VARCHAR(20) DEFAULT 'normal',
          message_language VARCHAR(10) DEFAULT 'en',
          reply_mode VARCHAR(20) DEFAULT 'manual',
          last_message_text TEXT,
          last_message_at TIMESTAMPTZ DEFAULT NOW(),
          unread_count INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_comm_conv_channel ON communication_conversations(channel);
        CREATE INDEX IF NOT EXISTS idx_comm_conv_contact ON communication_conversations(contact_identifier);
        CREATE INDEX IF NOT EXISTS idx_comm_conv_status ON communication_conversations(status);
        CREATE INDEX IF NOT EXISTS idx_comm_conv_last_msg ON communication_conversations(last_message_at DESC);
      `
    },
    {
      table: "communication_messages",
      sql: `
        CREATE TABLE IF NOT EXISTS communication_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES communication_conversations(id) ON DELETE CASCADE,
          direction VARCHAR(10) NOT NULL DEFAULT 'incoming',
          channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
          sender_identifier VARCHAR(255) NOT NULL,
          recipient_identifier VARCHAR(255) NOT NULL,
          subject VARCHAR(255),
          body TEXT NOT NULL DEFAULT '',
          raw_payload JSONB,
          message_category VARCHAR(50) DEFAULT 'general',
          detected_language VARCHAR(10) DEFAULT 'en',
          status VARCHAR(30) DEFAULT 'sent',
          error_reason TEXT,
          ai_generated_reply TEXT,
          is_sensitive BOOLEAN DEFAULT FALSE,
          sent_by UUID,
          sent_at TIMESTAMPTZ DEFAULT NOW(),
          delivered_at TIMESTAMPTZ,
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_comm_msg_conv ON communication_messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_comm_msg_created ON communication_messages(created_at DESC);
      `
    },
    {
      table: "whatsapp_accounts",
      sql: `
        CREATE TABLE IF NOT EXISTS whatsapp_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          scope VARCHAR(30) NOT NULL DEFAULT 'super_admin',
          country_id UUID,
          country_branch_id UUID,
          city_branch_id UUID,
          display_name VARCHAR(100) NOT NULL,
          phone_number VARCHAR(20) NOT NULL,
          phone_number_id VARCHAR(100) NOT NULL,
          waba_id VARCHAR(100),
          access_token TEXT NOT NULL,
          verify_token TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          is_default BOOLEAN DEFAULT FALSE,
          webhook_registered BOOLEAN DEFAULT FALSE,
          created_by UUID,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );
      `
    },
    {
      table: "communication_attachments",
      sql: `
        CREATE TABLE IF NOT EXISTS communication_attachments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID REFERENCES communication_messages(id) ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_type VARCHAR(100),
          file_size BIGINT,
          storage_url TEXT NOT NULL,
          mime_type VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      table: "communication_templates",
      sql: `
        CREATE TABLE IF NOT EXISTS communication_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(50) NOT NULL UNIQUE,
          title VARCHAR(150) NOT NULL,
          category VARCHAR(50) NOT NULL,
          body_en TEXT NOT NULL DEFAULT '',
          body_ur TEXT NOT NULL DEFAULT '',
          body_ps TEXT NOT NULL DEFAULT '',
          body_fa TEXT NOT NULL DEFAULT '',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    }
  ];

  for (const migration of migrations) {
    try {
      // Split and run each statement individually
      const statements = migration.sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      for (const stmt of statements) {
        await sql.unsafe(stmt + ";");
      }
      results.push({ table: migration.table, status: "✅ created_or_exists" });
    } catch (e: any) {
      results.push({ table: migration.table, status: "❌ error", detail: e.message });
    }
  }

  // Verify tables exist
  const tableCheck = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'communication_conversations', 'communication_messages',
      'whatsapp_accounts', 'communication_attachments', 'communication_templates'
    )
    ORDER BY table_name;
  `;

  await sql.end();

  const allOk = results.every((r) => r.status.includes("✅"));

  return NextResponse.json({
    success: allOk,
    results,
    tablesVerified: tableCheck.map((r) => r.table_name),
    message: allOk
      ? "✅ All tables created successfully. WhatsApp module is ready."
      : "⚠️ Some migrations failed. Check the results array for details."
  });
}
