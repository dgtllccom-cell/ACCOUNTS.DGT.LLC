-- Migration: Create local_purchases table for local market purchases with weight tare metrics and multi-currency calculations
CREATE TABLE IF NOT EXISTS local_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  country_id uuid REFERENCES countries(id),
  country_branch_id uuid REFERENCES country_branches(id),
  city_branch_id uuid REFERENCES city_branches(id),
  goods_id uuid REFERENCES goods(id),
  purchase_account_no text,
  sales_account_no text,
  brand text,
  size text,
  chassis_code text,
  goods_name text NOT NULL,
  supplier_name text,
  quantity_name text NOT NULL DEFAULT 'Bags',
  quantity_kgs numeric(18, 4) NOT NULL DEFAULT 0,
  total_gross_weight numeric(18, 4) NOT NULL DEFAULT 0,
  empty_kgs numeric(18, 4) NOT NULL DEFAULT 0,
  net_weight numeric(18, 4) NOT NULL DEFAULT 0,
  divide_kgs numeric(18, 4) NOT NULL DEFAULT 0,
  numbers numeric(18, 4) NOT NULL DEFAULT 0,
  rate_type text NOT NULL DEFAULT 'per_kg', -- 'per_kg' or 'per_number'
  purchase_rate numeric(18, 4) NOT NULL DEFAULT 0,
  purchase_currency text NOT NULL DEFAULT 'USD',
  exchange_rate numeric(18, 8) NOT NULL DEFAULT 1,
  local_currency text NOT NULL DEFAULT 'PKR',
  purchase_cost numeric(18, 4) NOT NULL DEFAULT 0,
  final_cost numeric(18, 4) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Enable RLS
ALTER TABLE local_purchases ENABLE ROW LEVEL SECURITY;

-- Create basic permissive policy for ERP operations
CREATE POLICY local_purchases_all ON local_purchases FOR ALL USING (true) WITH CHECK (true);
