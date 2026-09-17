-- ============================================================================
-- Migration: 20261129_public_email_platform.sql
-- Description: Independent public email service tables for DGT.LLC (username@dgt.llc)
-- Includes:
--   - public_mail_plans (free, pro, business tiers)
--   - public_mail_users (storage quota, status, auth)
--   - public_mail_verification_codes (registration, OTPs)
--   - public_mail_messages (webmail message store & index)
--   - public_mail_audit_logs (admin actions, quota adjustments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.public_mail_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    storage_bytes BIGINT NOT NULL,
    monthly_price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    max_attachment_bytes BIGINT NOT NULL DEFAULT 26214400, -- 25 MB
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plans
INSERT INTO public.public_mail_plans (id, name, storage_bytes, monthly_price_usd, max_attachment_bytes, features)
VALUES
    ('free_1gb', 'Free Starter', 1073741824, 0.00, 26214400, '["1 GB Cloud Storage", "25 MB Attachment Limit", "Instant Verification Codes", "Webmail & IMAP Access"]'::jsonb),
    ('pro_10gb', 'Pro Personal', 10737418240, 2.99, 52428800, '["10 GB Cloud Storage", "50 MB Attachment Limit", "High Priority Inbound Processing", "Advanced Spam Shield", "24/7 Dedicated Support"]'::jsonb),
    ('business_50gb', 'Business Ultra', 53687091200, 7.99, 104857600, '["50 GB Cloud Storage", "100 MB Attachment Limit", "Custom Mail Aliases", "Zero Rate-Limit Delays", "Automated Daily Archival"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    storage_bytes = EXCLUDED.storage_bytes,
    monthly_price_usd = EXCLUDED.monthly_price_usd,
    max_attachment_bytes = EXCLUDED.max_attachment_bytes,
    features = EXCLUDED.features;

CREATE TABLE IF NOT EXISTS public.public_mail_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT 'dgt.llc',
    email_address TEXT GENERATED ALWAYS AS (LOWER(username) || '@' || LOWER(domain)) STORED UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    recovery_email TEXT,
    phone_number TEXT,
    plan_id TEXT NOT NULL REFERENCES public.public_mail_plans(id) DEFAULT 'free_1gb',
    quota_bytes BIGINT NOT NULL DEFAULT 1073741824,
    used_bytes BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_verification')),
    storage_warning_level INTEGER NOT NULL DEFAULT 0 CHECK (storage_warning_level BETWEEN 0 AND 3),
    last_warning_sent_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_public_mail_users_username UNIQUE (username)
);

CREATE INDEX IF NOT EXISTS idx_public_mail_users_username ON public.public_mail_users (username);
CREATE INDEX IF NOT EXISTS idx_public_mail_users_status ON public.public_mail_users (status);
CREATE INDEX IF NOT EXISTS idx_public_mail_users_used_bytes ON public.public_mail_users (used_bytes);

CREATE TABLE IF NOT EXISTS public.public_mail_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_email TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'password_reset', 'external_verification')),
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_mail_codes_lookup ON public.public_mail_verification_codes (target_email, code, purpose);

CREATE TABLE IF NOT EXISTS public.public_mail_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.public_mail_users(id) ON DELETE CASCADE,
    stalwart_id TEXT,
    folder TEXT NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox', 'sent', 'drafts', 'spam', 'trash', 'starred', 'archive')),
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    body_text TEXT DEFAULT '',
    body_html TEXT DEFAULT '',
    snippet TEXT DEFAULT '',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_starred BOOLEAN NOT NULL DEFAULT FALSE,
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
    attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    is_verification_code BOOLEAN NOT NULL DEFAULT FALSE,
    extracted_code TEXT,
    sender_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_mail_msgs_user_folder ON public.public_mail_messages (user_id, folder, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_mail_msgs_user_read ON public.public_mail_messages (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_public_mail_msgs_verification ON public.public_mail_messages (user_id, is_verification_code) WHERE is_verification_code = TRUE;

CREATE TABLE IF NOT EXISTS public.public_mail_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.public_mail_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    performed_by TEXT NOT NULL DEFAULT 'system',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_mail_audit_user ON public.public_mail_audit_logs (user_id, created_at DESC);
