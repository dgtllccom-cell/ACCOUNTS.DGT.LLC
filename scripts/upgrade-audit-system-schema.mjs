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
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 5, prepare: false });

async function upgradeAuditSchema() {
  console.log("=== UPGRADING ENTERPRISE AUDIT SCHEMA FOR FULL SUPER ADMIN CONTROL ===\n");

  await sql.unsafe(`
    -- Create enterprise_audit_events if not exists
    CREATE TABLE IF NOT EXISTS enterprise_audit_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(100) NOT NULL,
      entity_id VARCHAR(255) NOT NULL,
      reference_no VARCHAR(255),
      action_type VARCHAR(50) NOT NULL,
      version_number INT DEFAULT 1,
      diff_changes JSONB,
      previous_snapshot JSONB,
      current_snapshot JSONB,
      user_id VARCHAR(255),
      user_name VARCHAR(255),
      user_role VARCHAR(100),
      country_id VARCHAR(255),
      country_name VARCHAR(255),
      city_branch_id VARCHAR(255),
      branch_name VARCHAR(255),
      ip_address VARCHAR(100),
      device_session VARCHAR(255),
      reason TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMPTZ,
      deleted_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Add additional fields safely
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS module VARCHAR(100);
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS page_url TEXT;
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS approval_reference VARCHAR(255);
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS edit_access_window VARCHAR(100);
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'Approved';
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50) DEFAULT 'Low';
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) DEFAULT 'Reviewed';
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS reviewer_comments TEXT;
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS party_name VARCHAR(255);
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS amount NUMERIC(18, 4);
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS currency VARCHAR(10);
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS is_restored BOOLEAN DEFAULT FALSE;
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS restored_by VARCHAR(255);
    ALTER TABLE enterprise_audit_events ADD COLUMN IF NOT EXISTS locked_status BOOLEAN DEFAULT FALSE;

    -- Add indexes for fast queries at scale (100+ countries, millions of records)
    CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON enterprise_audit_events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_ref ON enterprise_audit_events(reference_no);
    CREATE INDEX IF NOT EXISTS idx_audit_events_action ON enterprise_audit_events(action_type);
    CREATE INDEX IF NOT EXISTS idx_audit_events_created ON enterprise_audit_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_events_country ON enterprise_audit_events(country_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_branch ON enterprise_audit_events(city_branch_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_user ON enterprise_audit_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_deleted ON enterprise_audit_events(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_audit_events_deleted_at ON enterprise_audit_events(deleted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_events_risk ON enterprise_audit_events(risk_level);
    CREATE INDEX IF NOT EXISTS idx_audit_events_review ON enterprise_audit_events(review_status);
    CREATE INDEX IF NOT EXISTS idx_audit_events_module ON enterprise_audit_events(module);
  `);

  console.log("✅ Audit schema upgraded successfully with all required control fields and indexes!");
  await sql.end();
}

upgradeAuditSchema().catch(e => {
  console.error("Migration error:", e);
  process.exit(1);
});
