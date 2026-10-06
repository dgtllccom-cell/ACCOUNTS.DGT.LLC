-- Migration: 20260729_return_sms_reply.sql
-- Description: Database architecture for Return SMS Reply AI Communication Module

-- 1. Communication Conversations (Threads)
CREATE TABLE IF NOT EXISTS communication_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'email', 'both')),
    contact_identifier VARCHAR(255) NOT NULL, -- Phone number (E.164) or Email address
    sender_name VARCHAR(255),
    sender_type VARCHAR(50) DEFAULT 'customer' CHECK (sender_type IN ('customer', 'supplier', 'employee', 'transporter', 'agent', 'unknown')),
    sender_entity_id UUID, -- References customers(id), suppliers(id), employees(id), etc.
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    city_branch_id UUID REFERENCES city_branches(id) ON DELETE SET NULL,
    related_entity_type VARCHAR(50), -- purchase_order, sales_order, roznamcha, ledger, invoice, loading_record
    related_entity_id UUID,
    status VARCHAR(30) DEFAULT 'unread' CHECK (status IN ('unread', 'pending_reply', 'ai_ready', 'approval_required', 'replied', 'scheduled', 'failed', 'archived', 'blocked')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    message_language VARCHAR(10) DEFAULT 'en' CHECK (message_language IN ('en', 'ur', 'ps', 'fa')),
    assigned_user_id UUID,
    reply_mode VARCHAR(20) DEFAULT 'manual' CHECK (reply_mode IN ('manual', 'approval', 'automatic')),
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for high-performance inbox queries
CREATE INDEX IF NOT EXISTS idx_comm_conv_channel ON communication_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_comm_conv_contact ON communication_conversations(contact_identifier);
CREATE INDEX IF NOT EXISTS idx_comm_conv_status ON communication_conversations(status);
CREATE INDEX IF NOT EXISTS idx_comm_conv_country ON communication_conversations(country_id);
CREATE INDEX IF NOT EXISTS idx_comm_conv_branch ON communication_conversations(city_branch_id);
CREATE INDEX IF NOT EXISTS idx_comm_conv_last_msg ON communication_conversations(last_message_at DESC);

-- 2. Communication Messages (Incoming & Outgoing Messages)
CREATE TABLE IF NOT EXISTS communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES communication_conversations(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'email')),
    sender_identifier VARCHAR(255) NOT NULL,
    recipient_identifier VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    body TEXT NOT NULL,
    raw_payload JSONB,
    message_category VARCHAR(50) DEFAULT 'general' CHECK (message_category IN (
        'payment_request', 'payment_due', 'payment_confirmation', 'balance_inquiry',
        'purchase_order', 'sales_order', 'invoice', 'shipment_update', 'delivery_status',
        'customer_inquiry', 'supplier_inquiry', 'account_statement', 'ledger_balance',
        'document_request', 'complaint', 'appointment', 'general'
    )),
    detected_language VARCHAR(10) DEFAULT 'en',
    status VARCHAR(30) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'pending', 'replied', 'awaiting_approval')),
    error_reason TEXT,
    ai_generated_reply TEXT,
    edited_reply TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    sent_by UUID,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_msg_conv ON communication_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_comm_msg_created ON communication_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_msg_category ON communication_messages(message_category);

-- 3. Communication Attachments
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

-- 4. Reply Templates (4 Languages: EN, UR, PS, FA)
CREATE TABLE IF NOT EXISTS communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    body_en TEXT NOT NULL,
    body_ur TEXT NOT NULL,
    body_ps TEXT NOT NULL,
    body_fa TEXT NOT NULL,
    applies_to_country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    applies_to_branch_id UUID REFERENCES city_branches(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Automated Reminder Rules
CREATE TABLE IF NOT EXISTS communication_reminder_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(150) NOT NULL,
    trigger_event VARCHAR(50) NOT NULL CHECK (trigger_event IN (
        'before_due_date', 'on_due_date', 'overdue', 'payment_approved', 'payment_completed', 'payment_rejected', 'invoice_created', 'balance_changed'
    )),
    days_offset INT DEFAULT 0, -- e.g. -3 for 3 days before due date, +2 for 2 days overdue
    trigger_time TIME DEFAULT '09:00:00',
    channel VARCHAR(20) DEFAULT 'both' CHECK (channel IN ('whatsapp', 'email', 'both')),
    recipient_type VARCHAR(30) DEFAULT 'customer' CHECK (recipient_type IN ('customer', 'supplier', 'both')),
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    city_branch_id UUID REFERENCES city_branches(id) ON DELETE SET NULL,
    template_id UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
    preferred_language VARCHAR(10) DEFAULT 'en',
    max_reminders INT DEFAULT 3,
    reminder_interval_days INT DEFAULT 3,
    require_approval BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Contact Preferences & Opt-Out Management
CREATE TABLE IF NOT EXISTS communication_contact_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_identifier VARCHAR(255) NOT NULL UNIQUE,
    contact_name VARCHAR(255),
    entity_type VARCHAR(50), -- customer, supplier, employee
    entity_id UUID,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    opt_out_whatsapp BOOLEAN DEFAULT FALSE,
    opt_out_email BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    block_reason TEXT,
    consent_verified BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Communication Audit Logs
CREATE TABLE IF NOT EXISTS communication_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES communication_conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES communication_messages(id) ON DELETE SET NULL,
    user_id UUID,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    city_branch_id UUID REFERENCES city_branches(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- created, edited, approved, sent, failed, reminder_scheduled, reminder_halted
    reply_mode VARCHAR(20),
    original_text TEXT,
    ai_text TEXT,
    edited_text TEXT,
    delivery_result VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
