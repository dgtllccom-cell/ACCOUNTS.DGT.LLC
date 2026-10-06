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
const sql = postgres(dbUrl, { max: 5, prepare: false });

async function setupAuditTables() {
  console.log('=== SETTING UP ENTERPRISE AUDIT & VERSION TIMELINE TABLES ===\n');

  // 1. Create enterprise_audit_events table
  await sql.unsafe(`
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

    CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON enterprise_audit_events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_action ON enterprise_audit_events(action_type);
    CREATE INDEX IF NOT EXISTS idx_audit_events_created ON enterprise_audit_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_events_country ON enterprise_audit_events(country_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_branch ON enterprise_audit_events(city_branch_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_user ON enterprise_audit_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_deleted ON enterprise_audit_events(is_deleted);
  `);
  console.log('✓ enterprise_audit_events table & indexes verified/created.');

  // 2. Create user_activity_events table for Productivity & Active Time tracking
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS user_activity_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      user_name VARCHAR(255),
      user_role VARCHAR(100),
      country_id VARCHAR(255),
      city_branch_id VARCHAR(255),
      event_type VARCHAR(100) NOT NULL,
      module_name VARCHAR(100),
      page_url TEXT,
      duration_seconds INT DEFAULT 0,
      ip_address VARCHAR(100),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_activity_module ON user_activity_events(module_name);
  `);
  console.log('✓ user_activity_events table & indexes verified/created.');

  // 3. Create daily_branch_summaries table for pre-aggregated daily monitoring
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS daily_branch_summaries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      summary_date DATE NOT NULL,
      country_id VARCHAR(255),
      country_name VARCHAR(255),
      city_branch_id VARCHAR(255),
      branch_name VARCHAR(255),
      total_credit NUMERIC(18, 4) DEFAULT 0,
      total_debit NUMERIC(18, 4) DEFAULT 0,
      total_purchases_count INT DEFAULT 0,
      total_purchases_amount NUMERIC(18, 4) DEFAULT 0,
      total_sales_count INT DEFAULT 0,
      total_sales_amount NUMERIC(18, 4) DEFAULT 0,
      total_payments_count INT DEFAULT 0,
      total_payments_amount NUMERIC(18, 4) DEFAULT 0,
      total_roznamcha_entries INT DEFAULT 0,
      total_cash_in NUMERIC(18, 4) DEFAULT 0,
      total_cash_out NUMERIC(18, 4) DEFAULT 0,
      total_loading_count INT DEFAULT 0,
      total_shipping_count INT DEFAULT 0,
      total_customers_count INT DEFAULT 0,
      total_suppliers_count INT DEFAULT 0,
      total_edited_count INT DEFAULT 0,
      total_deleted_count INT DEFAULT 0,
      active_users_count INT DEFAULT 0,
      failed_violations_count INT DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(summary_date, country_id, city_branch_id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_branch_summaries(summary_date DESC);
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_country ON daily_branch_summaries(country_id);
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_branch ON daily_branch_summaries(city_branch_id);
  `);
  console.log('✓ daily_branch_summaries table & indexes verified/created.');

  await sql.end();
  console.log('\n=== ENTERPRISE AUDIT DATABASE STRUCTURE READY ===');
}

setupAuditTables().catch(console.error);
