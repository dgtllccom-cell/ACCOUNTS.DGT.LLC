import fs from "node:fs";
import { GOODS_DESCRIPTIONS } from "./populate-goods-descriptions.mjs";

function escapeSql(str) {
  if (!str) return "NULL";
  return `'${str.replace(/'/g, "''")}'`;
}

function escapeJson(str) {
  return str.replace(/"/g, '\\"');
}

let sql = `-- Migration: 20261009_populate_goods_commercial_descriptions.sql
-- Description: Populate full product descriptions / commercial specifications for all 99 master goods
--              in public.goods.extra_details and register 5-language translations (en, ur, ar, fa, ps)
--              in public.record_translations.

DO $$
DECLARE
  v_good RECORD;
BEGIN
`;

for (const item of GOODS_DESCRIPTIONS) {
  const en = escapeSql(item.en);
  const ur = escapeSql(item.ur);
  const ar = escapeSql(item.ar);
  const fa = escapeSql(item.fa);
  const ps = escapeSql(item.ps);
  const goodsName = escapeSql(item.name);
  const jsonMap = escapeSql(JSON.stringify({
    en: item.en,
    ur: item.ur,
    ar: item.ar,
    fa: item.fa,
    ps: item.ps
  }));

  sql += `
  -- ${item.name}
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower(${goodsName}) AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = ${en},
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      ${en},
      'en'::text,
      ${en},
      ${ur},
      ${ar},
      ${fa},
      ${ps},
      ${jsonMap}::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;
`;
}

sql += `
END $$;
`;

fs.writeFileSync("supabase/migrations/20261009_populate_goods_commercial_descriptions.sql", sql, "utf8");
console.log("Migration generated successfully: supabase/migrations/20261009_populate_goods_commercial_descriptions.sql");
