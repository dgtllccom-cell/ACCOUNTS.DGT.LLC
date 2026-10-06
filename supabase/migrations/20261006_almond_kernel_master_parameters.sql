-- Migration: 20261006_almond_kernel_master_parameters.sql
-- Description: Create goods_master_parameters table for dynamic, database-driven master parameters (Brands, Sizes, Varieties, Extra Details) linked to Goods.

CREATE TABLE IF NOT EXISTS public.goods_master_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_id UUID REFERENCES public.goods(id) ON DELETE CASCADE,
  param_type VARCHAR(50) NOT NULL, -- 'brand', 'size', 'variety', 'extra_details'
  param_code VARCHAR(100),
  param_value TEXT NOT NULL,
  parent_param_id UUID REFERENCES public.goods_master_parameters(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  original_language_code VARCHAR(10) DEFAULT 'en',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_goods_master_params_goods_id ON public.goods_master_parameters(goods_id);
CREATE INDEX IF NOT EXISTS idx_goods_master_params_type ON public.goods_master_parameters(param_type);
CREATE INDEX IF NOT EXISTS idx_goods_master_params_active ON public.goods_master_parameters(is_active) WHERE deleted_at IS NULL;

-- Per-language translation sidecars
CREATE TABLE IF NOT EXISTS public.goods_master_parameters_en (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  translated_text TEXT,
  original_text TEXT,
  original_language_code TEXT,
  source TEXT,
  translation_status TEXT,
  translated_by_engine TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.goods_master_parameters_ur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  translated_text TEXT,
  original_text TEXT,
  original_language_code TEXT,
  source TEXT,
  translation_status TEXT,
  translated_by_engine TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.goods_master_parameters_ar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  translated_text TEXT,
  original_text TEXT,
  original_language_code TEXT,
  source TEXT,
  translation_status TEXT,
  translated_by_engine TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.goods_master_parameters_fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  translated_text TEXT,
  original_text TEXT,
  original_language_code TEXT,
  source TEXT,
  translation_status TEXT,
  translated_by_engine TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.goods_master_parameters_ps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  translated_text TEXT,
  original_text TEXT,
  original_language_code TEXT,
  source TEXT,
  translation_status TEXT,
  translated_by_engine TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Seed Almond Kernel Goods Master and Master Parameters
DO $$
DECLARE
  v_goods_id UUID;
  v_country_id UUID;
BEGIN
  -- Resolve USA Country ID
  SELECT id INTO v_country_id 
  FROM public.countries 
  WHERE lower(name) LIKE '%united states%' OR lower(name) LIKE '%usa%' 
  LIMIT 1;

  -- Ensure Almond Kernel exists in public.goods
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
      'Nonpareil Type / Soft Shell / Light Color / Smooth Surface',
      true,
      'en'
    ) RETURNING id INTO v_goods_id;
  ELSE
    UPDATE public.goods
    SET goods_name = 'Almond Kernel',
        chs_code = '0802.12.0000',
        origin_country_id = COALESCE(origin_country_id, v_country_id),
        category = 'Agriculture & Food',
        updated_at = NOW()
    WHERE id = v_goods_id;
  END IF;

  -- 1. SEED 10 BRANDS FOR ALMOND KERNEL
  INSERT INTO public.goods_master_parameters (goods_id, param_type, param_code, param_value, sort_order, is_active)
  VALUES
    (v_goods_id, 'brand', 'BRD-DIGITAL', 'Digital LLC', 1, true),
    (v_goods_id, 'brand', 'BRD-BG', 'BG', 2, true),
    (v_goods_id, 'brand', 'BRD-BLUE-DIAMOND', 'Blue Diamond', 3, true),
    (v_goods_id, 'brand', 'BRD-WONDERFUL', 'Wonderful Almonds', 4, true),
    (v_goods_id, 'brand', 'BRD-SELECT-HARVESTS', 'Select Harvests', 5, true),
    (v_goods_id, 'brand', 'BRD-BARI', 'Bari Almonds', 6, true),
    (v_goods_id, 'brand', 'BRD-CALIFORNIA-GOLD', 'California Gold', 7, true),
    (v_goods_id, 'brand', 'BRD-ALMOND-BOARD', 'Almond Board USA', 8, true),
    (v_goods_id, 'brand', 'BRD-SUN-VALLEY', 'Sun Valley Almonds', 9, true),
    (v_goods_id, 'brand', 'BRD-GOLDEN-STATE', 'Golden State Almonds', 10, true)
  ON CONFLICT DO NOTHING;

  -- 2. SEED SIZES FOR ALMOND KERNEL
  INSERT INTO public.goods_master_parameters (goods_id, param_type, param_code, param_value, sort_order, is_active)
  VALUES
    (v_goods_id, 'size', 'SZ-18-20', '18/20', 1, true),
    (v_goods_id, 'size', 'SZ-20-22', '20/22', 2, true),
    (v_goods_id, 'size', 'SZ-23-25', '23/25', 3, true),
    (v_goods_id, 'size', 'SZ-25-27', '25/27', 4, true),
    (v_goods_id, 'size', 'SZ-27-30', '27/30', 5, true),
    (v_goods_id, 'size', 'SZ-30-32', '30/32', 6, true),
    (v_goods_id, 'size', 'SZ-32-34', '32/34', 7, true)
  ON CONFLICT DO NOTHING;

  -- 3. SEED 12 VARIETIES FOR ALMOND KERNEL
  INSERT INTO public.goods_master_parameters (goods_id, param_type, param_code, param_value, sort_order, is_active)
  VALUES
    (v_goods_id, 'variety', 'VAR-ALDRICH', 'Aldrich', 1, true),
    (v_goods_id, 'variety', 'VAR-BUTTE', 'Butte', 2, true),
    (v_goods_id, 'variety', 'VAR-CARMEL', 'Carmel', 3, true),
    (v_goods_id, 'variety', 'VAR-FRITZ', 'Fritz', 4, true),
    (v_goods_id, 'variety', 'VAR-INDEPENDENCE', 'Independence', 5, true),
    (v_goods_id, 'variety', 'VAR-MARCONA', 'Marcona', 6, true),
    (v_goods_id, 'variety', 'VAR-MONTEREY', 'Monterey', 7, true),
    (v_goods_id, 'variety', 'VAR-NONPAREIL', 'Nonpareil', 8, true),
    (v_goods_id, 'variety', 'VAR-PADRE', 'Padre', 9, true),
    (v_goods_id, 'variety', 'VAR-PRICE', 'Price', 10, true),
    (v_goods_id, 'variety', 'VAR-SONORA', 'Sonora', 11, true),
    (v_goods_id, 'variety', 'VAR-WOOD-COLONY', 'Wood Colony', 12, true)
  ON CONFLICT DO NOTHING;

  -- 4. SEED EXTRA DETAILS FOR ALMOND KERNEL
  INSERT INTO public.goods_master_parameters (goods_id, param_type, param_code, param_value, sort_order, is_active)
  VALUES
    (v_goods_id, 'extra_details', 'EXT-NONPAREIL', 'Nonpareil Type / Soft Shell / Light Color / Smooth Surface', 1, true),
    (v_goods_id, 'extra_details', 'EXT-CARMEL', 'Carmel Type / Soft Shell / Medium Color / Wrinkled Surface', 2, true),
    (v_goods_id, 'extra_details', 'EXT-CALIFORNIA', 'California Type / Medium Shell / Light-Medium Color / Wrinkled Surface', 3, true),
    (v_goods_id, 'extra_details', 'EXT-MISSION', 'Mission Type / Hard Shell / Dark Color / Wrinkled Surface', 4, true),
    (v_goods_id, 'extra_details', 'EXT-ALDRICH', 'Aldrich Variety Specs / Medium Shell / Light Color / Smooth Surface', 5, true),
    (v_goods_id, 'extra_details', 'EXT-BUTTE', 'Butte Variety Specs / Semi-Hard Shell / Medium Color / Short Plump Shape', 6, true),
    (v_goods_id, 'extra_details', 'EXT-FRITZ', 'Fritz Variety Specs / Small-Medium Plump Kernel / Soft Shell', 7, true),
    (v_goods_id, 'extra_details', 'EXT-INDEPENDENCE', 'Independence Variety Specs / Self-Fertile Variety / High Yield Kernel', 8, true),
    (v_goods_id, 'extra_details', 'EXT-MARCONA', 'Marcona Variety Specs / Gourmet Round Spanish Kernel / Sweet Delicate Taste', 9, true),
    (v_goods_id, 'extra_details', 'EXT-PADRE', 'Padre Variety Specs / Plump Short Kernel / High Density', 10, true),
    (v_goods_id, 'extra_details', 'EXT-PRICE', 'Price Variety Specs / Medium Flattish Kernel / Bakery & Confectionery Grade', 11, true),
    (v_goods_id, 'extra_details', 'EXT-SONORA', 'Sonora Variety Specs / Long Thin Kernel / Almond Flour Processing Grade', 12, true),
    (v_goods_id, 'extra_details', 'EXT-WOOD-COLONY', 'Wood Colony Variety Specs / Soft Shell / Light Color / High Shelling Percentage', 13, true)
  ON CONFLICT DO NOTHING;

END $$;
