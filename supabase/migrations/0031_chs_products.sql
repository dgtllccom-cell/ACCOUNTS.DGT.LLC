-- Create chs_products table
CREATE TABLE IF NOT EXISTS chs_products (
  id SERIAL PRIMARY KEY,
  chs_code TEXT NOT NULL,
  goods_name TEXT NOT NULL,
  origin TEXT,
  branch TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_by UUID REFERENCES profiles(id),
  modified_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique index for active chs_code records
CREATE UNIQUE INDEX IF NOT EXISTS chs_products_chs_code_idx ON chs_products (chs_code) WHERE deleted_at IS NULL;
