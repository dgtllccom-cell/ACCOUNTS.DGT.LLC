-- Migration: 20260814_master_forms_completion.sql
-- Create missing master data tables and seed initial records for all master modules.

-- 1. Company Registration Types Table
CREATE TABLE IF NOT EXISTS public.company_registration_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    name_en VARCHAR(255),
    name_ur VARCHAR(255),
    name_ar VARCHAR(255),
    name_fa VARCHAR(255),
    name_ps VARCHAR(255),
    original_language_code VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Document Types Table
CREATE TABLE IF NOT EXISTS public.document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    name_en VARCHAR(255),
    name_ur VARCHAR(255),
    name_ar VARCHAR(255),
    name_fa VARCHAR(255),
    name_ps VARCHAR(255),
    original_language_code VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_comp_reg_types_code ON public.company_registration_types(code);
CREATE INDEX IF NOT EXISTS idx_doc_types_code ON public.document_types(code);

-- Seed Company Registration Types if empty
INSERT INTO public.company_registration_types (code, name, name_en, name_ur, name_ar, name_fa, name_ps, is_active)
VALUES
  ('LLC', 'Limited Liability Company', 'Limited Liability Company', 'محدود ذمہ داری کمپنی', 'شركة ذات مسؤولية محدودة', 'شرکت با مسئولیت محدود', 'محدود مسؤلیت لرونکی شرکت', true),
  ('INC', 'Incorporated Corporation', 'Incorporated Corporation', 'کارپوریشن', 'مؤسسة مسجلة', 'شرکت ثبت شده', 'ثبت شوی شرکت', true),
  ('PARTNERSHIP', 'General Partnership', 'General Partnership', 'شراکت داری', 'شراكة عامة', 'مشارکت عمومی', 'عام شراکت', true),
  ('SOLE_PROP', 'Sole Proprietorship', 'Sole Proprietorship', 'انفرادی مالکیت', 'ملكية فردية', 'مالکیت انفرادی', 'انفرادي ملکیت', true)
ON CONFLICT (code) DO NOTHING;

-- Seed Document Types if empty
INSERT INTO public.document_types (code, name, name_en, name_ur, name_ar, name_fa, name_ps, is_active)
VALUES
  ('COMMERCIAL_INV', 'Commercial Invoice', 'Commercial Invoice', 'تجارتی انوائس', 'فاتورة تجارية', 'فاکتور تجاری', 'تجارتی انوائس', true),
  ('PACKING_LIST', 'Packing List', 'Packing List', 'پیکنگ لسٹ', 'قائمة التعبئة', 'لیست بسته بندی', 'د بستې لست', true),
  ('BILL_OF_LADING', 'Bill of Lading', 'Bill of Lading', 'بل آف لیڈنگ', 'بوليسة الشحن', 'بارنامه', 'د بارولو سند', true),
  ('CERT_OF_ORIGIN', 'Certificate of Origin', 'Certificate of Origin', 'سرٹیفکیٹ آف اوریجن', 'شهادة المنشأ', 'گواهی مبدا', 'د اصل تصدیق پاڼه', true)
ON CONFLICT (code) DO NOTHING;

-- Seed Contact Types if empty
INSERT INTO public.contact_types (key, name, is_active)
VALUES
  ('mobile', 'Mobile Phone', true),
  ('phone', 'Office Phone', true),
  ('whatsapp', 'WhatsApp Business', true)
ON CONFLICT DO NOTHING;

-- Seed Account Types if empty
INSERT INTO public.account_types (code, name, account_kind)
VALUES
  ('ASSET', 'Asset Account', 'asset'),
  ('LIABILITY', 'Liability Account', 'liability'),
  ('EQUITY', 'Equity Account', 'equity'),
  ('REVENUE', 'Revenue Account', 'income'),
  ('EXPENSE', 'Expense Account', 'expense')
ON CONFLICT DO NOTHING;

-- Seed Product Units if empty
INSERT INTO public.product_units (unit_code, unit_name, is_active)
VALUES
  ('KG', 'Kilogram', true),
  ('TON', 'Metric Ton', true),
  ('MTR', 'Meter', true),
  ('PCS', 'Pieces', true),
  ('BOX', 'Box / Carton', true)
ON CONFLICT DO NOTHING;

-- Seed Ports if empty
INSERT INTO public.ports (port_code, port_name, is_active)
VALUES
  ('PORT-KHI', 'Karachi Port', true),
  ('PORT-QASIM', 'Port Qasim', true),
  ('PORT-GWADAR', 'Gwadar Port', true),
  ('PORT-CHAMAN', 'Chaman Border Terminal', true),
  ('PORT-TORKHAM', 'Torkham Border Terminal', true)
ON CONFLICT DO NOTHING;
