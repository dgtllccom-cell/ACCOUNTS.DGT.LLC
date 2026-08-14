-- Migration: 20260814_stock_movements.sql
-- Create stock_movements table for tracking Stock In, Stock Out, Adjustments, and Transfers.

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'TRANSFER')),
    goods_id UUID NOT NULL REFERENCES public.goods(id) ON DELETE RESTRICT,
    goods_variation_id UUID REFERENCES public.goods_variations(id) ON DELETE SET NULL,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE,
    country_branch_id UUID REFERENCES public.country_branches(id) ON DELETE CASCADE,
    city_branch_id UUID REFERENCES public.city_branches(id) ON DELETE CASCADE,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15, 4) DEFAULT 0,
    total_amount NUMERIC(15, 4) DEFAULT 0,
    reference_no VARCHAR(100),
    notes TEXT,
    movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    super_admin_serial TEXT,
    country_serial TEXT,
    branch_serial TEXT,
    entry_serial TEXT
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_goods ON public.stock_movements(goods_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON public.stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_country ON public.stock_movements(country_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(movement_date DESC);

-- Ensure unique constraint on product_inventory_balances (product_id, warehouse_id) for UPSERT operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_pib_product_warehouse ON public.product_inventory_balances (product_id, warehouse_id);
