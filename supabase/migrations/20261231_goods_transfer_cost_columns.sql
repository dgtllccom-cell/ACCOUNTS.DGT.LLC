-- Goods Transfer Journal: cost-of-sales posting reference on a transfer (posted by an explicit human action,
-- exactly once per transfer). Additive only.
ALTER TABLE public.goods_transfers
  ADD COLUMN IF NOT EXISTS cost_roznamcha_entry_id uuid,
  ADD COLUMN IF NOT EXISTS cost_amount numeric(18,4),
  ADD COLUMN IF NOT EXISTS cost_currency text,
  ADD COLUMN IF NOT EXISTS cost_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS cost_posted_by uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_goods_transfers_cost_entry ON public.goods_transfers(cost_roznamcha_entry_id) WHERE cost_roznamcha_entry_id IS NOT NULL;
