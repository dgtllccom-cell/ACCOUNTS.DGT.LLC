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
  let cityBranchesCreated = 0;
  let accountsSeeded = 0;

  try {
    const countries = await sql`SELECT id, name, iso2 FROM countries`;
    const countryBranches = await sql`SELECT id, country_id, name, code FROM country_branches`;

    const uaeCountry = countries?.find(c => String(c.name || "").toLowerCase().includes("united arab emirates") || c.iso2 === "AE") || countries?.[0];
    const pkCountry = countries?.find(c => String(c.name || "").toLowerCase().includes("pakistan") || c.iso2 === "PK") || countries?.[1] || uaeCountry;
    const afgCountry = countries?.find(c => String(c.name || "").toLowerCase().includes("afghanistan") || c.iso2 === "AF") || countries?.[2] || uaeCountry;

    const uaeCb = countryBranches?.find(cb => cb.country_id === uaeCountry?.id) || countryBranches?.[0];
    const pkCb = countryBranches?.find(cb => cb.country_id === pkCountry?.id) || countryBranches?.[1] || uaeCb;
    const afgCb = countryBranches?.find(cb => cb.country_id === afgCountry?.id) || countryBranches?.[2] || uaeCb;

    // 1. ENSURE CITY BRANCHES EXIST
    const targetCityBranches = [
      { countryId: afgCountry?.id, countryBranchId: afgCb?.id, cityName: "Kandahar", name: "Kandahar City Branch", code: "KND", curr: "AFN", email: "kandahar@damaan.com" },
      { countryId: afgCountry?.id, countryBranchId: afgCb?.id, cityName: "Kabul", name: "Kabul City Branch", code: "KBL", curr: "AFN", email: "kabul@damaan.com" },
      { countryId: afgCountry?.id, countryBranchId: afgCb?.id, cityName: "Herat", name: "Herat City Branch", code: "HRT", curr: "AFN", email: "herat@damaan.com" },
      { countryId: pkCountry?.id, countryBranchId: pkCb?.id, cityName: "Chaman", name: "Chaman City Branch", code: "CHM", curr: "PKR", email: "chaman@damaan.com" },
      { countryId: pkCountry?.id, countryBranchId: pkCb?.id, cityName: "Quetta", name: "Quetta City Branch", code: "QTA", curr: "PKR", email: "quetta@damaan.com" },
      { countryId: uaeCountry?.id, countryBranchId: uaeCb?.id, cityName: "Al Ras", name: "AL_RAS City Branch", code: "ALRAS", curr: "AED", email: "alras@damaan.com" },
      { countryId: uaeCountry?.id, countryBranchId: uaeCb?.id, cityName: "Dubai", name: "Dubai Main City Branch", code: "DXB", curr: "AED", email: "dubai@damaan.com" }
    ];

    for (const b of targetCityBranches) {
      if (!b.countryId || !b.countryBranchId) continue;
      try {
        const existing = await sql`SELECT id FROM city_branches WHERE country_id = ${b.countryId} AND (code = ${b.code} OR name = ${b.name}) LIMIT 1`;
        if (existing.length === 0) {
          await sql`
            INSERT INTO city_branches (country_id, country_branch_id, city_name, name, code, local_currency, email, status)
            VALUES (${b.countryId}, ${b.countryBranchId}, ${b.cityName}, ${b.name}, ${b.code}, ${b.curr}, ${b.email}, 'active')
          `;
          cityBranchesCreated++;
        }
      } catch (err: any) {
        errors.push(`City branch err (${b.name}): ${err.message}`);
      }
    }

    // Refetch updated city branches
    const cityBranches = await sql`SELECT id, country_id, country_branch_id, name, code FROM city_branches`;
    const kandaharCity = cityBranches?.find(city => String(city.name || "").toLowerCase().includes("kandahar") || city.code === "KND");
    const chamanCity = cityBranches?.find(city => String(city.name || "").toLowerCase().includes("chaman") || city.code === "CHM");
    const quettaCity = cityBranches?.find(city => String(city.name || "").toLowerCase().includes("quetta") || city.code === "QTA");

    const todayStr = new Date().toISOString();

    // 2. SEED KANDAHAR AFGHANISTAN ACCOUNTS (15 ACCOUNTS)
    if (afgCountry && afgCb && kandaharCity) {
      for (let i = 1; i <= 15; i++) {
        const accNo = `AFG-KND-${String(1000 + i).padStart(4, "0")}`;
        const custNo = `CUST-${accNo}`;
        const name = i === 1 ? "Kandahar Dry Fruit Wholesalers" : i === 2 ? "Da Afghanistan Bank - Kandahar Branch" : i === 3 ? "Kandahar Main Cash Ledger" : `Kandahar Dry Fruit Merchant ${i}`;
        const code = i === 2 ? "BA-KND-01" : i === 3 ? "CA-KND-01" : `PA-KND-${i}`;
        const kind = i === 2 || i === 3 ? "asset" : "liability";

        try {
          await sql`
            INSERT INTO enterprise_accounts (
              account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, branch_code, branch_account_sequence,
              name, code, kind, currency, scope, country_id, country_branch_id, city_branch_id, status, creation_date
            ) VALUES (
              ${accNo}, ${custNo}, ${4000 + i}, ${`AFG-SR-${i}`}, ${`KND-SR-${i}`}, 'KND', ${i},
              ${name}, ${code}, ${kind}, 'AFN', 'city_branch', ${afgCountry.id}, ${afgCb.id}, ${kandaharCity.id}, 'active', ${todayStr}
            )
          `;
          accountsSeeded++;
        } catch (err: any) {
          if (!err.message.includes("unique")) errors.push(`KND Acc err (${name}): ${err.message}`);
        }
      }
    }

    // 3. SEED CHAMAN PAKISTAN ACCOUNTS (15 ACCOUNTS)
    if (pkCountry && pkCb && chamanCity) {
      for (let i = 1; i <= 15; i++) {
        const accNo = `PK-CHM-${String(2000 + i).padStart(4, "0")}`;
        const custNo = `CUST-${accNo}`;
        const name = i === 1 ? "Chaman Fruit Market Wholesalers" : i === 2 ? "Meezan Bank - Chaman Branch" : i === 3 ? "Chaman Main Cash Ledger" : `Chaman Mandi Merchant ${i}`;
        const code = i === 2 ? "BA-CHM-01" : i === 3 ? "CA-CHM-01" : `PA-CHM-${i}`;
        const kind = i === 2 || i === 3 ? "asset" : "liability";

        try {
          await sql`
            INSERT INTO enterprise_accounts (
              account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, branch_code, branch_account_sequence,
              name, code, kind, currency, scope, country_id, country_branch_id, city_branch_id, status, creation_date
            ) VALUES (
              ${accNo}, ${custNo}, ${2000 + i}, ${`PK-SR-${i}`}, ${`CHM-SR-${i}`}, 'CHM', ${i},
              ${name}, ${code}, ${kind}, 'PKR', 'city_branch', ${pkCountry.id}, ${pkCb.id}, ${chamanCity.id}, 'active', ${todayStr}
            )
          `;
          accountsSeeded++;
        } catch (err: any) {
          if (!err.message.includes("unique")) errors.push(`CHM Acc err (${name}): ${err.message}`);
        }
      }
    }

    // 4. SEED QUETTA PAKISTAN ACCOUNTS (15 ACCOUNTS)
    if (pkCountry && pkCb && quettaCity) {
      for (let i = 1; i <= 15; i++) {
        const accNo = `PK-QTA-${String(2000 + i).padStart(4, "0")}`;
        const custNo = `CUST-${accNo}`;
        const name = i === 1 ? "Quetta Dry Fruit Commission Agents" : i === 2 ? "Habib Bank Limited - Quetta Branch" : i === 3 ? "Quetta City Main Cash Book" : `Quetta Merchant Account ${i}`;
        const code = i === 2 ? "BA-QTA-01" : i === 3 ? "CA-QTA-01" : `PA-QTA-${i}`;
        const kind = i === 2 || i === 3 ? "asset" : "liability";

        try {
          await sql`
            INSERT INTO enterprise_accounts (
              account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, branch_code, branch_account_sequence,
              name, code, kind, currency, scope, country_id, country_branch_id, city_branch_id, status, creation_date
            ) VALUES (
              ${accNo}, ${custNo}, ${3000 + i}, ${`PK-SR-${i + 100}`}, ${`QTA-SR-${i}`}, 'QTA', ${i},
              ${name}, ${code}, ${kind}, 'PKR', 'city_branch', ${pkCountry.id}, ${pkCb.id}, ${quettaCity.id}, 'active', ${todayStr}
            )
          `;
          accountsSeeded++;
        } catch (err: any) {
          if (!err.message.includes("unique")) errors.push(`QTA Acc err (${name}): ${err.message}`);
        }
      }
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      message: "City Branches & Accounts Seeded Successfully!",
      metrics: {
        cityBranchesCreated,
        accountsSeeded
      },
      errors: errors.slice(0, 10)
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
