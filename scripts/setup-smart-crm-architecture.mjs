import fs from 'fs';
import postgres from 'postgres';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

const dbUrl = getDbUrl();
if (!dbUrl) {
  console.error("DATABASE_URL not found in environment");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 5, prepare: false });

async function setupSmartCrmSchema() {
  console.log("=== CREATING ENTERPRISE SMART CRM / DUE & FOLLOW-UP CONTROL SCHEMA ===\n");

  await sql.unsafe(`
    -- 1. Create crm_action_items table
    CREATE TABLE IF NOT EXISTS crm_action_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_type VARCHAR(50) NOT NULL,
      source_id VARCHAR(255) NOT NULL,
      reference_no VARCHAR(255) NOT NULL,
      party_name VARCHAR(255) NOT NULL,
      due_date DATE NOT NULL,
      item_type VARCHAR(50) NOT NULL,
      module VARCHAR(50) NOT NULL,
      amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
      paid_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
      remaining_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'PKR',
      country_id VARCHAR(255),
      country_name VARCHAR(255),
      country_branch_id VARCHAR(255),
      city_branch_id VARCHAR(255),
      branch_name VARCHAR(255),
      responsible_user_id VARCHAR(255),
      responsible_user_name VARCHAR(255),
      urgency_class VARCHAR(50) NOT NULL DEFAULT 'due_today',
      status VARCHAR(50) NOT NULL DEFAULT 'Due Today',
      last_follow_up TIMESTAMPTZ,
      next_follow_up DATE,
      notes TEXT,
      is_completed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMPTZ,
      completed_by VARCHAR(255),
      global_serial VARCHAR(100),
      country_serial VARCHAR(100),
      branch_serial VARCHAR(100),
      entry_serial VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Unique constraint for Idempotency: Prevents duplicate CRM reminders
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_action_items_unique_source 
      ON crm_action_items (source_type, source_id);

    -- High-Performance Composite Indexes for 50,000+ daily entries
    CREATE INDEX IF NOT EXISTS idx_crm_items_scope_urgency 
      ON crm_action_items (country_id, city_branch_id, urgency_class, due_date DESC);
    CREATE INDEX IF NOT EXISTS idx_crm_items_due_date 
      ON crm_action_items (due_date ASC);
    CREATE INDEX IF NOT EXISTS idx_crm_items_urgency 
      ON crm_action_items (urgency_class);
    CREATE INDEX IF NOT EXISTS idx_crm_items_type 
      ON crm_action_items (item_type);
    CREATE INDEX IF NOT EXISTS idx_crm_items_completed 
      ON crm_action_items (is_completed);
    CREATE INDEX IF NOT EXISTS idx_crm_items_party 
      ON crm_action_items (party_name);
    CREATE INDEX IF NOT EXISTS idx_crm_items_ref 
      ON crm_action_items (reference_no);

    -- 2. Create crm_followup_notes table for audit trails and notes
    CREATE TABLE IF NOT EXISTS crm_followup_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      crm_item_id UUID REFERENCES crm_action_items(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      user_role VARCHAR(100),
      note_type VARCHAR(50) DEFAULT 'Call Follow-Up',
      note_text TEXT NOT NULL,
      promise_date DATE,
      promise_amount NUMERIC(18, 4),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_crm_notes_item ON crm_followup_notes(crm_item_id);
    CREATE INDEX IF NOT EXISTS idx_crm_notes_created ON crm_followup_notes(created_at DESC);
  `);

  console.log("✅ Smart CRM tables and composite indexes created successfully!");
  await sql.end();
}

setupSmartCrmSchema().catch(e => {
  console.error("Setup error:", e);
  process.exit(1);
});
