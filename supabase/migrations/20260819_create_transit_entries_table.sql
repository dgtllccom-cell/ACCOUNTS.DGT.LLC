-- Migration: Create transit_entries table for full ERP transit management & public check reports
CREATE TABLE IF NOT EXISTS public.transit_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    super_agent TEXT NOT NULL DEFAULT 'SA-0001',
    super_agent_name TEXT,
    country TEXT NOT NULL DEFAULT 'PK - Pakistan',
    country_name TEXT,
    branch TEXT NOT NULL DEFAULT 'CHM - Chaman',
    branch_name TEXT,
    entry_serial TEXT NOT NULL UNIQUE,
    
    -- Basic Information
    invoice_no TEXT NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_no TEXT NOT NULL,
    supplier_date DATE NOT NULL DEFAULT CURRENT_DATE,
    python_no TEXT,
    python_date DATE,
    transit_no TEXT,
    transit_date DATE,
    
    -- Goods Information
    goods_name TEXT NOT NULL,
    quantity NUMERIC(15, 3) NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'PCS',
    gross_weight NUMERIC(15, 3) DEFAULT 0,
    net_weight NUMERIC(15, 3) DEFAULT 0,
    price_per_unit NUMERIC(18, 2) DEFAULT 0,
    total_amount NUMERIC(18, 2) DEFAULT 0,
    
    -- Parties / People
    created_by TEXT NOT NULL,
    delivered_to TEXT NOT NULL,
    
    -- Companies & Notify Party
    export_company TEXT NOT NULL,
    import_company TEXT NOT NULL,
    notify_party TEXT NOT NULL,
    
    -- Documents (JSON array of { id, name, size, type, url })
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Notes & System Meta
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_transit_entries_serial ON public.transit_entries(entry_serial);
CREATE INDEX IF NOT EXISTS idx_transit_entries_invoice_no ON public.transit_entries(invoice_no);
CREATE INDEX IF NOT EXISTS idx_transit_entries_transit_no ON public.transit_entries(transit_no);
CREATE INDEX IF NOT EXISTS idx_transit_entries_goods_name ON public.transit_entries(goods_name);
CREATE INDEX IF NOT EXISTS idx_transit_entries_created_at ON public.transit_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_entries_status ON public.transit_entries(status) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.transit_entries ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and service role access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'transit_entries' AND policyname = 'Allow select for authenticated users'
    ) THEN
        CREATE POLICY "Allow select for authenticated users" ON public.transit_entries
            FOR SELECT TO authenticated USING (deleted_at IS NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'transit_entries' AND policyname = 'Allow insert for authenticated users'
    ) THEN
        CREATE POLICY "Allow insert for authenticated users" ON public.transit_entries
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'transit_entries' AND policyname = 'Allow update for authenticated users'
    ) THEN
        CREATE POLICY "Allow update for authenticated users" ON public.transit_entries
            FOR UPDATE TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'transit_entries' AND policyname = 'Allow delete for authenticated users'
    ) THEN
        CREATE POLICY "Allow delete for authenticated users" ON public.transit_entries
            FOR DELETE TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'transit_entries' AND policyname = 'Allow public read for verification'
    ) THEN
        CREATE POLICY "Allow public read for verification" ON public.transit_entries
            FOR SELECT TO anon USING (deleted_at IS NULL);
    END IF;
END
$$;

-- Insert initial sample record
INSERT INTO public.transit_entries (
    super_agent, super_agent_name, country, country_name, branch, branch_name, entry_serial,
    invoice_no, invoice_date, supplier_no, supplier_date, python_no, python_date, transit_no, transit_date,
    goods_name, quantity, unit, gross_weight, net_weight, price_per_unit, total_amount,
    created_by, delivered_to, export_company, import_company, notify_party, documents, notes
) VALUES (
    'SA-0001', 'Global Cargo Logistics', 'PK - Pakistan', 'Pakistan', 'CHM - Chaman', 'Chaman', 'TE-0001234',
    'INV-2024-000567', '2025-08-18', 'SUP-000789', '2025-08-15', 'PYT-001234', '2025-08-12', 'TRN-009876', '2025-08-19',
    'LED TV 42 Inch', 100, 'PCS', 1200, 1050, 25000, 2500000,
    'Ali Khan', 'Ahmed Shah', 'ABC Exporters Ltd.', 'XYZ Importers Pvt. Ltd.', 'M/S Bright Traders, Karachi',
    '[{"id":"doc-1","name":"Invoice_INV-2024-000567.pdf","size":"245 KB"},{"id":"doc-2","name":"PackingList_PYT-001234.pdf","size":"128 KB"}]'::jsonb,
    'Transit shipment cleared at Chaman border customs point.'
) ON CONFLICT (entry_serial) DO NOTHING;
