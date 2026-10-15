-- Migration: 20261015_journal_stock_transfers.sql
-- Unified Journal Stock & Stock Transfer Management System
-- Provides physical stock tracking from Purchase Booking / Local Purchase -> Loading -> Warehouse / Export / Local Sales

CREATE TABLE IF NOT EXISTS public.journal_stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_no text NOT NULL UNIQUE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  local_purchase_id uuid REFERENCES public.local_purchases(id) ON DELETE SET NULL,
  loading_record_id uuid REFERENCES public.purchase_loading_records(id) ON DELETE SET NULL,
  source_stage text NOT NULL DEFAULT 'loading' CHECK (source_stage IN ('journal', 'loading')),
  destination_type text NOT NULL CHECK (destination_type IN ('warehouse', 'export', 'local_sales')),
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  goods_name text NOT NULL,
  goods_id uuid REFERENCES public.goods(id) ON DELETE SET NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'KG',
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_no text,
  remarks text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_jst_purchase_order ON public.journal_stock_transfers(purchase_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_local_purchase ON public.journal_stock_transfers(local_purchase_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_loading_record ON public.journal_stock_transfers(loading_record_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_warehouse ON public.journal_stock_transfers(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_destination ON public.journal_stock_transfers(destination_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_scope ON public.journal_stock_transfers(country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;
