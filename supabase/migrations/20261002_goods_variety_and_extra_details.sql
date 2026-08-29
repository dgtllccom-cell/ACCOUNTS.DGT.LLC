-- Migration: 20261002_goods_variety_and_extra_details.sql
-- Description: Extend Goods Master (public.goods and public.goods_variations) with `variety` and `extra_details` columns.

ALTER TABLE public.goods ADD COLUMN IF NOT EXISTS variety VARCHAR(150);
ALTER TABLE public.goods ADD COLUMN IF NOT EXISTS extra_details TEXT;

ALTER TABLE public.goods_variations ADD COLUMN IF NOT EXISTS variety VARCHAR(150);
ALTER TABLE public.goods_variations ADD COLUMN IF NOT EXISTS extra_details TEXT;

-- Update description comments
COMMENT ON COLUMN public.goods.variety IS 'Specific variety/type of the goods (e.g. Nonpareil, Carmel, Independence for Almond Kernel).';
COMMENT ON COLUMN public.goods.extra_details IS 'Extra product details, specifications, classification, nut/shell characteristics, and quality notes.';

COMMENT ON COLUMN public.goods_variations.variety IS 'Specific variety of the variation.';
COMMENT ON COLUMN public.goods_variations.extra_details IS 'Extra details and technical specification for the variation.';

-- Insert or update Almond Kernel seed item
DO $$
DECLARE
  v_goods_id UUID;
  v_country_id UUID;
BEGIN
  -- Get USA or UAE country id if available
  SELECT id INTO v_country_id FROM public.countries WHERE lower(name) LIKE '%united states%' OR lower(name) LIKE '%usa%' OR lower(name) LIKE '%united arab%' LIMIT 1;

  -- Upsert Almond Kernel into public.goods
  SELECT id INTO v_goods_id FROM public.goods WHERE chs_code = '0802.12.0000' AND deleted_at IS NULL LIMIT 1;

  IF v_goods_id IS NULL THEN
    INSERT INTO public.goods (
      chs_code,
      goods_name,
      origin_country_id,
      category,
      variety,
      extra_details,
      is_active,
      original_language_code
    ) VALUES (
      '0802.12.0000',
      'Almond Kernel',
      v_country_id,
      'Agriculture & Food',
      'Nonpareil',
      'Grade A Sweet Almond Kernels, Medium Flattish Shape, Smooth Light Brown Skin, Shell-Free, Max 5% Moisture, Vacuum Packed 25kg Cartons',
      true,
      'en'
    ) RETURNING id INTO v_goods_id;
  ELSE
    UPDATE public.goods
    SET goods_name = 'Almond Kernel',
        category = 'Agriculture & Food',
        variety = COALESCE(variety, 'Nonpareil'),
        extra_details = COALESCE(extra_details, 'Grade A Sweet Almond Kernels, Medium Flattish Shape, Smooth Light Brown Skin, Shell-Free, Max 5% Moisture, Vacuum Packed 25kg Cartons'),
        updated_at = NOW()
    WHERE id = v_goods_id;
  END IF;

  -- Insert standard Almond Kernel variations (Varieties: Nonpareil, Carmel, Monterey, Butte, Fritz, Independence, Marcona, Price, Sonora, Wood Colony)
  INSERT INTO public.goods_variations (goods_id, size, brand, variety, extra_details, is_active)
  VALUES
    (v_goods_id, '20/22', 'CALIFORNIA GOLD', 'Nonpareil', 'Supreme Grade Kernel, Smooth Skin, High Uniformity', true),
    (v_goods_id, '23/25', 'BLUE DIAMOND', 'Carmel', 'Soft Shell Variety, Wrinkled Surface, Excellent Flavour', true),
    (v_goods_id, '27/30', 'MARIANI', 'Monterey', 'Medium-Large Elongated Kernel, Darker Brown Skin', true),
    (v_goods_id, '30/32', 'SUPREME HARVEST', 'Independence', 'Self-Fertile Variety, High Yield Kernel, Smooth Surface', true),
    (v_goods_id, '18/20', 'SELECT QUALITY', 'Marcona', 'Gourmet Round Spanish Kernel, Sweet Delicate Taste', true),
    (v_goods_id, '32/34', 'PARAMOUNT', 'Fritz', 'Small-Medium Plump Kernel, Excellent Processing Quality', true),
    (v_goods_id, '36/40', 'DAMAAN PREMIUM', 'Butte', 'Semi-Hard Shell Variety, Small Short Plump Shape', true),
    (v_goods_id, 'Whole/Halves', 'CALIFORNIA GOLD', 'Padre', 'Plump Short Kernel, High Density', true),
    (v_goods_id, 'Pieces', 'SUPREME HARVEST', 'Price', 'Medium Flattish Kernel, Great for Bakery & Confectionery', true),
    (v_goods_id, 'Meal/Flour', 'MARIANI', 'Sonora', 'Long Thin Kernel, Ideal for Almond Flour Processing', true)
  ON CONFLICT DO NOTHING;

END $$;
