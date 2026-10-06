-- Allow multiple goods to share standard Harmonized System (HS) codes (e.g., varieties of peas, chickpeas, lentils sharing 6-digit tariff codes)
DROP INDEX IF EXISTS public.goods_chs_code_idx;
CREATE INDEX IF NOT EXISTS goods_chs_code_idx ON public.goods USING btree (chs_code) WHERE (deleted_at IS NULL);
