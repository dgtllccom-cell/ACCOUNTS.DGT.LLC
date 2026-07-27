import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ success: false, error: "DATABASE_URL is not defined." }, { status: 500 });
  }

  const sql = postgres(dbUrl, { ssl: "require", prepare: false, max: 1 });

  try {
    const cityBranches = await sql`SELECT id, country_id, name, code, city_name FROM city_branches ORDER BY name ASC`;
    const accounts = await sql`SELECT account_number, name, code, currency, branch_code FROM enterprise_accounts WHERE branch_code IN ('KND', 'CHM', 'QTA', 'ALRAS') ORDER BY id DESC LIMIT 20`;

    await sql.end();

    return NextResponse.json({
      success: true,
      message: "City Branches & Accounts Verification",
      cityBranches,
      accountsFoundCount: accounts.length,
      sampleAccounts: accounts
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
