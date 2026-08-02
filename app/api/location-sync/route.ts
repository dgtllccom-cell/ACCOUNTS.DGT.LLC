import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPaths = ['.env.local', '.env.production', '.env'];
  for (const envFile of envPaths) {
    const fullPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

export async function GET(request: NextRequest) {
  try {
    const dbUrl = getDbUrl();
    if (!dbUrl) {
      return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
    }

    const sql = postgres(dbUrl, { max: 1, prepare: false });

    const counts = await sql`
      SELECT c.name as country_name, c.iso2, 
             count(distinct s.id) as state_count, 
             count(distinct d.id) as district_count, 
             count(distinct ct.id) as city_count
      FROM public.countries c
      LEFT JOIN public.states_provinces s ON s.country_id = c.id AND s.deleted_at IS NULL
      LEFT JOIN public.districts d ON d.country_id = c.id AND d.deleted_at IS NULL
      LEFT JOIN public.cities ct ON ct.country_id = c.id AND ct.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.iso2
      ORDER BY c.name
    `;

    await sql.end();
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      counts
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache"
      }
    });
  } catch (err: any) {
    return NextResponse.json({ syncError: err?.message || String(err), stack: err?.stack }, { status: 200 });
  }
}
