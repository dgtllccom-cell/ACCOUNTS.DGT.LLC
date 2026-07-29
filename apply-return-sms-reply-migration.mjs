import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";

async function applyMigrations() {
  console.log("Connecting to production Supabase database...");
  const sql = postgres(dbUrl, { ssl: 'require' });

  try {
    const filesToRun = [
      'supabase/migrations/0066_whatsapp_team_inbox.sql',
      'supabase/migrations/0068_communication_center.sql',
      'supabase/migrations/20260729_return_sms_reply.sql'
    ];
    
    for (const file of filesToRun) {
      console.log(`Executing migration: ${file}...`);
      const content = fs.readFileSync(file, 'utf8');
      await sql.unsafe(content);
      console.log(`✅ ${file} applied successfully.`);
    }
    
    console.log("Reloading Supabase PostgREST Schema Cache...");
    await sql.unsafe("NOTIFY pgrst, 'reload schema';");
    console.log("✅ Schema cache reloaded successfully.");

    // Verify created tables
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
      );
    `;

    console.log("🎉 VERIFIED PRODUCTION TABLES IN DATABASE:");
    console.table(tables);
    
  } catch (err) {
    console.error("❌ Failed to apply migration:", err);
  } finally {
    await sql.end();
  }
}

applyMigrations();
