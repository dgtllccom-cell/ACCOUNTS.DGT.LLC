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
    const countries = await sql`SELECT id, name, iso2, currency_code FROM countries`;
    const countryBranches = await sql`SELECT id, country_id, name, code FROM country_branches`;
    const cityBranches = await sql`SELECT id, country_id, country_branch_id, name, code FROM city_branches`;

    const indCountry = countries?.find(c => String(c.name || "").toLowerCase().includes("india") || c.iso2 === "IN");
    const indCb = countryBranches?.find(cb => cb.country_id === indCountry?.id);
    const mumbaiCity = cityBranches?.find(c => c.code === "MUM_VASHI" || c.name?.includes("Mumbai"));

    const todayStr = new Date().toISOString();
    let seeded = 0;

    if (indCountry && indCb && mumbaiCity) {
      const list = [
        { name: "Damandar General Trading Company (Mumbai HQ)", kind: "asset", code: "CO-MUM-01" },
        { name: "APMC Vashi Dry Fruit Wholesalers Ltd", kind: "liability", code: "PA-MUM-01" },
        { name: "Navi Mumbai Almond Imports Corp", kind: "liability", code: "PA-MUM-02" },
        { name: "HDFC Bank - Vashi Market Branch", kind: "asset", code: "BA-MUM-01" },
        { name: "Mumbai Main Cash Ledger", kind: "asset", code: "CA-MUM-01" },
        { name: "Vashi Cold Storage & Logistics", kind: "expense", code: "EX-MUM-01" },
        { name: "JNPT Port Customs Clearing Agent", kind: "liability", code: "PA-MUM-03" },
        { name: "Maharashtra Goods Freight Agency", kind: "expense", code: "EX-MUM-02" },
        { name: "Bombay Commodity Sales Account", kind: "income", code: "SA-MUM-01" },
        { name: "India Import-Export Clearing House", kind: "liability", code: "PA-MUM-04" },
        ...Array.from({ length: 10 }).map((_, idx) => ({ name: `Vashi Market Merchant ${idx + 1}`, kind: idx % 2 === 0 ? "liability" : "asset", code: `PA-MUM-1${idx}` }))
      ];

      for (const [idx, item] of list.entries()) {
        const accNo = `IND-MUM-${String(7000 + idx).padStart(4, "0")}`;
        const custNo = `CUST-${accNo}`;
        try {
          await sql`
            INSERT INTO enterprise_accounts (
              account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, branch_code, branch_account_sequence,
              name, code, kind, currency, scope, country_id, country_branch_id, city_branch_id, status, creation_date
            ) VALUES (
              ${accNo}, ${custNo}, ${7000 + idx}, ${`IND-SR-${idx}`}, ${`MUM-BR-${idx}`}, 'MUM_VASHI', ${idx + 1},
              ${item.name}, ${item.code}, ${item.kind}, 'INR', 'city_branch', ${indCountry.id}, ${indCb.id}, ${mumbaiCity.id}, 'active', ${todayStr}
            )
            ON CONFLICT DO NOTHING
          `;
          seeded++;
        } catch (e: any) {}
      }
    }

    const [{ count: totalAcc }] = await sql`SELECT count(*)::int FROM enterprise_accounts`;
    const [{ count: totalOrders }] = await sql`SELECT count(*)::int FROM purchase_orders`;
    await sql.end();

    return NextResponse.json({
      success: true,
      message: "Seeded India Mumbai Accounts!",
      mumbaiAccountsSeeded: seeded,
      totalAccountsInDatabase: totalAcc,
      totalPurchaseOrdersInDatabase: totalOrders
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
