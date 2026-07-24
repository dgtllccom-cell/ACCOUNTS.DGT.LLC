import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!dbUrl) throw new Error("No db URL");

    const sql = postgres(dbUrl, { ssl: "require" });
    
    // 1. Add origin_country_id to goods table
    await sql`ALTER TABLE goods ADD COLUMN IF NOT EXISTS origin_country_id UUID REFERENCES countries(id);`;
    
    // 2. Migrate existing data
    await sql`
      UPDATE goods g
      SET origin_country_id = (
        SELECT origin_country_id 
        FROM goods_variations v 
        WHERE v.goods_id = g.id AND v.origin_country_id IS NOT NULL 
        LIMIT 1
      )
      WHERE origin_country_id IS NULL;
    `;
    
    // 3. Drop the old unique index
    await sql`DROP INDEX IF EXISTS goods_variations_unique_idx;`;
    
    // 4. Create new unique index
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS goods_variations_unique_idx 
      ON goods_variations (goods_id, size, brand) 
      WHERE deleted_at IS NULL;
    `;
    
    // 5. Drop origin_country_id from goods_variations
    await sql`ALTER TABLE goods_variations DROP COLUMN IF EXISTS origin_country_id;`;
    
    // 6. Reload schema cache
    await sql`NOTIFY pgrst, 'reload schema';`;
    
    // Check results
    const goodsCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'goods' AND column_name = 'origin_country_id';`;
    const varCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'goods_variations' AND column_name = 'origin_country_id';`;
    
    await sql.end();
    
    return NextResponse.json({ 
      success: true, 
      message: "Migration 0046 applied and PostgREST schema reloaded. (Force Dynamic)",
      goods_origin_country_id: goodsCols.length > 0,
      goods_variations_origin_country_id: varCols.length > 0
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
