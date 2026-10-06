-- 20261008_add_grade_to_goods_variations.sql
-- Add grade column to goods_variations to support full hierarchy:
-- Goods -> Variety -> Size -> Grade -> Brand -> Extra Details -> Detail Lines

ALTER TABLE public.goods_variations
ADD COLUMN IF NOT EXISTS grade text;

COMMENT ON COLUMN public.goods_variations.grade IS 'Commercial or quality grade under size (e.g. Premium Grade, Supreme, Standard)';
