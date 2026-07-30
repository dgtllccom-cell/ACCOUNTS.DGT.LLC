import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ error: "DATABASE_URL environment variable missing" }, { status: 500 });
    }

    const sql = postgres(dbUrl, { max: 1, prepare: false });

    // High throughput performance indexes
    const indexStatements = [
      `CREATE INDEX IF NOT EXISTS idx_roznamcha_hierarchy ON public.roznamcha(country_id, country_branch_id, city_branch_id, entry_date, status);`,
      `CREATE INDEX IF NOT EXISTS idx_ledgers_hierarchy ON public.ledgers(country_id, country_branch_id, city_branch_id, code);`,
      `CREATE INDEX IF NOT EXISTS idx_office_documents_hierarchy ON public.office_documents(country_id, country_branch_id, city_branch_id, module_type);`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_orders_hierarchy ON public.purchase_orders(country_id, country_branch_id, city_branch_id, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_sales_orders_hierarchy ON public.sales_orders(country_id, country_branch_id, city_branch_id, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_role_assignments ON public.user_role_assignments(user_id, country_id, country_branch_id, city_branch_id, is_active);`
    ];

    const results: string[] = [];
    for (const stmt of indexStatements) {
      try {
        await sql.unsafe(stmt);
        results.push(`Executed: ${stmt.slice(0, 45)}...`);
      } catch (err: any) {
        results.push(`Notice: ${err.message}`);
      }
    }

    await sql.end();
    return NextResponse.json({ success: true, message: "Database indexes verified and created", results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
