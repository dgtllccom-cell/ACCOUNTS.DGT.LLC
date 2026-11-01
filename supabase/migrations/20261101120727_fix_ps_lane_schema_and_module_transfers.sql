-- Applied and verified on DEV csesvyxxjivnkkozgopt; version from Supabase migration history.
-- Keep the data and existing responsibility/stock/accounting workflow intact.
DO $lane_schema$
      BEGIN
        IF (SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'purchase_lane_loads'
              AND column_name IN ('sales_order_id', 'remaining_quantity', 'transfer_destination')) < 3
          OR NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.purchase_lane_loads'::regclass
              AND conname = 'purchase_lane_loads_source_type_check'
              AND pg_get_constraintdef(oid) LIKE '%sales_booking%'
              AND pg_get_constraintdef(oid) LIKE '%local_sales%'
        ) OR NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.purchase_lane_loads'::regclass
              AND conname = 'purchase_lane_loads_owner_type_check'
              AND pg_get_constraintdef(oid) LIKE '%module%'
        ) THEN
          ALTER TABLE public.purchase_lane_loads
            ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS remaining_quantity numeric NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS transfer_destination text,
            DROP CONSTRAINT IF EXISTS purchase_lane_loads_source_type_check,
            ADD CONSTRAINT purchase_lane_loads_source_type_check
              CHECK (source_type IN ('purchase_booking', 'local_purchase', 'sales_booking', 'local_sales')),
            DROP CONSTRAINT IF EXISTS purchase_lane_loads_owner_type_check,
            ADD CONSTRAINT purchase_lane_loads_owner_type_check
              CHECK (owner_type IN ('branch', 'internal_agent', 'external_agent', 'user', 'self', 'module'));
        END IF;
      END $lane_schema$;

