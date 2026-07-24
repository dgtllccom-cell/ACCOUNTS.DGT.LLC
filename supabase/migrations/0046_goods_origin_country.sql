-- Migrate Origin Country from goods_variations to goods

-- 1. Add origin_country_id to goods table
ALTER TABLE goods ADD COLUMN IF NOT EXISTS origin_country_id UUID REFERENCES countries(id);

-- 2. Migrate existing data: take the first non-null origin_country_id from variations for each goods master
UPDATE goods g
SET origin_country_id = (
  SELECT origin_country_id 
  FROM goods_variations v 
  WHERE v.goods_id = g.id AND v.origin_country_id IS NOT NULL 
  LIMIT 1
)
WHERE origin_country_id IS NULL;

-- 3. Drop the old unique index on goods_variations
DROP INDEX IF EXISTS goods_variations_unique_idx;

-- 4. Create new unique index without origin_country_id
CREATE UNIQUE INDEX goods_variations_unique_idx 
  ON goods_variations (goods_id, size, brand) 
  WHERE deleted_at IS NULL;

-- 5. Drop the origin_country_id column from goods_variations
ALTER TABLE goods_variations DROP COLUMN IF EXISTS origin_country_id;
