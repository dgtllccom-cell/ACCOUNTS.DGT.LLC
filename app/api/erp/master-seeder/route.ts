import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ success: false, error: "DATABASE_URL is not defined." }, { status: 500 });
  }

  const sql = postgres(dbUrl, { ssl: "require", prepare: false, max: 1 });
  const errors: string[] = [];

  try {
    const countries = await sql`SELECT id, name, iso2, currency_code FROM countries`;
    const uaeCountry = countries?.find(c => String(c.name || "").toLowerCase().includes("united arab emirates") || c.iso2 === "AE");
    const pkCountry = countries?.find(c => String(c.name || "").toLowerCase().includes("pakistan") || c.iso2 === "PK");
    const afgCountry = countries?.find(c => String(c.name || "").toLowerCase().includes("afghanistan") || c.iso2 === "AF");
    const indCountry = countries?.find(c => String(c.name || "").toLowerCase().includes("india") || c.iso2 === "IN");

    // 1. Ensure Country Branches exist for all 4 countries
    const targetBranches = [
      { countryId: uaeCountry?.id, name: "United Arab Emirates Main Branch", code: "ARE-MAIN-001", currency: "AED", email: "uae@damaan.com" },
      { countryId: pkCountry?.id, name: "Pakistan Main Branch", code: "PAK-MAIN-001", currency: "PKR", email: "pk@damaan.com" },
      { countryId: afgCountry?.id, name: "Afghanistan Main Branch", code: "AFG-MAIN-001", currency: "AFN", email: "afg@damaan.com" },
      { countryId: indCountry?.id, name: "India Main Branch", code: "IND-MAIN-001", currency: "INR", email: "india@damaan.com" }
    ];

    for (const b of targetBranches) {
      if (!b.countryId) continue;
      try {
        const existing = await sql`SELECT id FROM country_branches WHERE country_id = ${b.countryId} LIMIT 1`;
        if (existing.length === 0) {
          await sql`
            INSERT INTO country_branches (country_id, name, code, local_currency, email, is_main, status)
            VALUES (${b.countryId}, ${b.name}, ${b.code}, ${b.currency}, ${b.email}, true, 'active')
          `;
        }
      } catch (err: any) {
        errors.push(`CB err (${b.name}): ${err.message}`);
      }
    }

    const countryBranches = await sql`SELECT id, country_id, name, code FROM country_branches`;
    const indCb = countryBranches?.find(cb => cb.country_id === indCountry?.id);

    // 2. Ensure Mumbai Vashi Market City Branch is linked to India Main Branch
    if (indCountry && indCb) {
      try {
        await sql`
          UPDATE city_branches
          SET country_branch_id = ${indCb.id}
          WHERE country_id = ${indCountry.id} AND (code = 'MUM_VASHI' OR name LIKE '%Mumbai%')
        `;
      } catch (err: any) {
        errors.push(`City update err: ${err.message}`);
      }
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      message: "India Main Branch Created & Linked Successfully!",
      countryBranchesCount: countryBranches.length,
      errors
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
