-- Redesign CHS Products and Goods tables for variations

-- 1. Drop dependent policies and indices first
DROP POLICY IF EXISTS goods_scope_read ON goods;
DROP INDEX IF EXISTS goods_unique_per_country;
DROP INDEX IF EXISTS goods_country_idx;
DROP INDEX IF EXISTS goods_name_search_idx;
DROP INDEX IF EXISTS goods_code_search_idx;
DROP INDEX IF EXISTS goods_hs_search_idx;
DROP INDEX IF EXISTS goods_brand_search_idx;

-- 2. CHS Products Redesign
ALTER TABLE chs_products DROP COLUMN IF EXISTS origin;
ALTER TABLE chs_products DROP COLUMN IF EXISTS branch;

CREATE TABLE IF NOT EXISTS chs_product_variations (
  id SERIAL PRIMARY KEY,
  chs_product_id INTEGER NOT NULL REFERENCES chs_products(id) ON DELETE CASCADE,
  origin_country TEXT NOT NULL,
  size TEXT NOT NULL,
  brand TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_by UUID REFERENCES profiles(id),
  modified_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS chs_product_variations_unique_idx 
  ON chs_product_variations (chs_product_id, origin_country, size, brand) 
  WHERE deleted_at IS NULL;

-- 3. Goods Redesign
ALTER TABLE goods DROP COLUMN IF EXISTS country_id;
ALTER TABLE goods DROP COLUMN IF EXISTS product_code;
ALTER TABLE goods DROP COLUMN IF EXISTS hs_code;
ALTER TABLE goods DROP COLUMN IF EXISTS size;
ALTER TABLE goods DROP COLUMN IF EXISTS brand;
ALTER TABLE goods DROP COLUMN IF EXISTS origin_country_id;
ALTER TABLE goods DROP COLUMN IF EXISTS image_url;

-- Add chs_code to goods master
ALTER TABLE goods ADD COLUMN IF NOT EXISTS chs_code TEXT;
UPDATE goods SET chs_code = '0000.00.00' WHERE chs_code IS NULL;
ALTER TABLE goods ALTER COLUMN chs_code SET NOT NULL;

-- Add unique index for chs_code on goods
CREATE UNIQUE INDEX IF NOT EXISTS goods_chs_code_idx ON goods (chs_code) WHERE deleted_at IS NULL;

-- Recreate policy for goods table to be global (unscoped read)
CREATE POLICY goods_scope_read ON goods
  FOR SELECT
  USING (true);

-- Create goods_variations table
CREATE TABLE IF NOT EXISTS goods_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_id UUID NOT NULL REFERENCES goods(id) ON DELETE CASCADE,
  origin_country_id UUID REFERENCES countries(id),
  size TEXT NOT NULL,
  brand TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS goods_variations_unique_idx 
  ON goods_variations (goods_id, COALESCE(origin_country_id, '00000000-0000-0000-0000-000000000000'::uuid), size, brand) 
  WHERE deleted_at IS NULL;

ALTER TABLE goods_variations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goods_variations_read ON goods_variations;
CREATE POLICY goods_variations_read ON goods_variations
  FOR SELECT
  USING (true);
