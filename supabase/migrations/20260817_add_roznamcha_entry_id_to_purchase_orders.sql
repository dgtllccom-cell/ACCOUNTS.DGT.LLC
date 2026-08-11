-- Add missing roznamcha_entry_id column to purchase_orders and reload PostgREST schema cache
ALTER TABLE IF EXISTS public.purchase_orders 
ADD COLUMN IF NOT EXISTS roznamcha_entry_id uuid REFERENCES public.roznamcha_entries(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.sales_orders 
ADD COLUMN IF NOT EXISTS roznamcha_entry_id uuid REFERENCES public.roznamcha_entries(id) ON DELETE SET NULL;

-- Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
