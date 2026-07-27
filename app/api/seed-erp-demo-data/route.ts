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
  let seededAccountsCount = 0;
  let seededOrdersCount = 0;

  try {
    const countries = await sql`SELECT id, name, iso2 FROM countries`;
    const countryBranches = await sql`SELECT id, country_id, name, code FROM country_branches`;
    const cityBranches = await sql`SELECT id, country_id, country_branch_id, name, code FROM city_branches`;

    const uaeCountry = countries?.find(c => String(c.name || "").toLowerCase().includes("united arab emirates") || c.iso2 === "AE") || countries?.[0];
    const pkCountry = countries?.find(c => String(c.name || "").toLowerCase().includes("pakistan") || c.iso2 === "PK") || countries?.[1] || uaeCountry;

    const uaeCb = countryBranches?.find(cb => cb.country_id === uaeCountry?.id) || countryBranches?.[0];
    const pkCb = countryBranches?.find(cb => cb.country_id === pkCountry?.id) || countryBranches?.[1] || uaeCb;

    const alRasCity = cityBranches?.find(city => String(city.name || "").toLowerCase().includes("al_ras") || String(city.name || "").toLowerCase().includes("al ras")) || cityBranches?.[0];
    const dubaiMainCity = cityBranches?.find(city => String(city.name || "").toLowerCase().includes("dubai")) || cityBranches?.[1];
    const chamanCity = cityBranches?.find(city => String(city.name || "").toLowerCase().includes("chaman")) || cityBranches?.[2];
    const quettaCity = cityBranches?.find(city => String(city.name || "").toLowerCase().includes("quetta")) || cityBranches?.[3];

    // 1. SEED 25 UAE AL_RAS ACCOUNTS
    for (let i = 1; i <= 25; i++) {
      const accNo = `UAE-ALRAS-${String(1000 + i).padStart(4, "0")}`;
      const custNo = `CUST-${accNo}`;
      const name = i === 1 ? "Al Ras Dry Fruit Traders LLC" : i === 2 ? "Al Ras Foodstuff Trading Co" : i === 3 ? "Dubai Islamic Bank - Al Ras Branch" : i === 4 ? "Al Ras Main Cash Book" : `Al Ras Wholesale Merchant ${i}`;
      const code = i === 3 ? "BA-2001" : i === 4 ? "CA-3001" : `PA-10${i}`;
      const kind = i === 3 || i === 4 ? "asset" : "liability";
      const curr = i % 3 === 0 ? "USD" : "AED";

      try {
        await sql`
          INSERT INTO enterprise_accounts (account_number, customer_number, name, code, kind, currency, scope, country_id, country_branch_id, city_branch_id, status)
          VALUES (${accNo}, ${custNo}, ${name}, ${code}, ${kind}, ${curr}, 'city_branch', ${uaeCountry?.id || null}, ${uaeCb?.id || null}, ${alRasCity?.id || null}, 'active')
        `;
        seededAccountsCount++;
      } catch (err: any) {
        if (!err.message.includes("unique")) errors.push(`Acc err: ${err.message}`);
      }
    }

    // 2. SEED 15 CHAMAN PAKISTAN ACCOUNTS
    for (let i = 1; i <= 15; i++) {
      const accNo = `PK-CHM-${String(1000 + i).padStart(4, "0")}`;
      const custNo = `CUST-${accNo}`;
      const name = i === 1 ? "Chaman Fruit Market Wholesalers" : i === 2 ? "Meezan Bank - Chaman Branch" : i === 3 ? "Chaman Main Cash Ledger" : `Chaman Mandi Merchant ${i}`;
      const code = i === 2 ? "BA-CHM-01" : i === 3 ? "CA-CHM-01" : `PA-CHM-${i}`;
      const kind = i === 2 || i === 3 ? "asset" : "liability";

      try {
        await sql`
          INSERT INTO enterprise_accounts (account_number, customer_number, name, code, kind, currency, scope, country_id, country_branch_id, city_branch_id, status)
          VALUES (${accNo}, ${custNo}, ${name}, ${code}, ${kind}, 'PKR', 'city_branch', ${pkCountry?.id || null}, ${pkCb?.id || null}, ${chamanCity?.id || null}, 'active')
        `;
        seededAccountsCount++;
      } catch (err: any) {
        if (!err.message.includes("unique")) errors.push(`Acc err: ${err.message}`);
      }
    }

    // 3. SEED 15 QUETTA PAKISTAN ACCOUNTS
    for (let i = 1; i <= 15; i++) {
      const accNo = `PK-QTA-${String(1000 + i).padStart(4, "0")}`;
      const custNo = `CUST-${accNo}`;
      const name = i === 1 ? "Quetta Dry Fruit Commission Agents" : i === 2 ? "Habib Bank Limited - Quetta Branch" : i === 3 ? "Quetta City Main Cash Book" : `Quetta Merchant Account ${i}`;
      const code = i === 2 ? "BA-QTA-01" : i === 3 ? "CA-QTA-01" : `PA-QTA-${i}`;
      const kind = i === 2 || i === 3 ? "asset" : "liability";

      try {
        await sql`
          INSERT INTO enterprise_accounts (account_number, customer_number, name, code, kind, currency, scope, country_id, country_branch_id, city_branch_id, status)
          VALUES (${accNo}, ${custNo}, ${name}, ${code}, ${kind}, 'PKR', 'city_branch', ${pkCountry?.id || null}, ${pkCb?.id || null}, ${quettaCity?.id || null}, 'active')
        `;
        seededAccountsCount++;
      } catch (err: any) {
        if (!err.message.includes("unique")) errors.push(`Acc err: ${err.message}`);
      }
    }

    // 4. SEED PURCHASE BOOKING ORDERS
    const orders = [
      { no: "PB-2026-0001", manual: "INV-UAE-801", cId: uaeCountry?.id, cbId: uaeCb?.id, citId: alRasCity?.id, cName: "United Arab Emirates", bName: "AL_RAS", sName: "Al Ras Dry Fruit Traders LLC", pName: "Almond Kernels USA Extra No. 1", qty: 1200, unit: "BAGS", amount: 323400, final: 1187686, curr: "USD", fCurr: "AED" },
      { no: "PB-2026-0002", manual: "INV-UAE-802", cId: uaeCountry?.id, cbId: uaeCb?.id, citId: alRasCity?.id, cName: "United Arab Emirates", bName: "AL_RAS", sName: "Al Ras Foodstuff Trading Co", pName: "Pistachios Roasted Salted Kerman", qty: 800, unit: "BAGS", amount: 360640, final: 1324450, curr: "USD", fCurr: "AED" },
      { no: "PB-2026-0003", manual: "INV-DXB-901", cId: uaeCountry?.id, cbId: uaeCb?.id, citId: dubaiMainCity?.id, cName: "United Arab Emirates", bName: "Dubai Main Branch", sName: "Gulf Commodities Clearing Agent", pName: "Walnuts In-Shell Chandler", qty: 600, unit: "BAGS", amount: 141120, final: 518263, curr: "USD", fCurr: "AED" },
      { no: "PB-2026-0004", manual: "INV-PK-CHM-101", cId: pkCountry?.id, cbId: pkCb?.id, citId: chamanCity?.id, cName: "Pakistan", bName: "Chaman Branch", sName: "Chaman Fruit Market Wholesalers", pName: "Green Raisins Sundekhani Grade A", qty: 1500, unit: "BAGS", amount: 235200, final: 65385600, curr: "USD", fCurr: "PKR" },
      { no: "PB-2026-0005", manual: "INV-PK-QTA-201", cId: pkCountry?.id, cbId: pkCb?.id, citId: quettaCity?.id, cName: "Pakistan", bName: "Quetta Branch", sName: "Quetta Dry Fruit Commission Agents", pName: "Pine Nuts Chilgoza Whole Unshelled", qty: 400, unit: "BAGS", amount: 558600, final: 155290800, curr: "USD", fCurr: "PKR" }
    ];

    for (const o of orders) {
      const formDataJson = JSON.stringify({
        form: {
          billNo: o.manual,
          supplierName: o.sName,
          countryName: o.cName,
          branchName: o.bName,
          purchaseCurrency: o.curr,
          currencyType: o.curr,
          advancePercent: 10,
          advanceAmountFc: o.amount * 0.1,
          advanceAmountLc: o.final * 0.1,
          remainingAmountFc: o.amount * 0.9,
          remainingAmountLc: o.final * 0.9
        },
        goodsEntries: [
          {
            goodsName: o.pName,
            qtyNo: o.qty,
            qtyName: o.unit,
            qtyKgs: 50,
            emptyKgs: 1,
            coursePrice: (o.amount / (o.qty * 49)).toFixed(2),
            totalAmount: o.amount,
            finalAmount: o.final,
            origin: o.cName === "Pakistan" ? "Afghanistan" : "USA"
          }
        ]
      });

      try {
        await sql`
          INSERT INTO purchase_orders (
            purchase_order_no, country_id, country_branch_id, city_branch_id,
            purchase_currency, currency_code, order_total, form_data
          ) VALUES (
            ${o.no}, ${o.cId || null}, ${o.cbId || null}, ${o.citId || null},
            ${o.curr}, ${o.curr}, ${o.amount}, ${formDataJson}
          )
        `;
        seededOrdersCount++;
      } catch (err: any) {
        if (!err.message.includes("unique")) errors.push(`Order err: ${err.message}`);
      }
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      message: "Seeding complete!",
      metrics: {
        accountsCreatedOrUpdated: seededAccountsCount,
        purchaseOrdersSeeded: seededOrdersCount
      },
      errors: errors.slice(0, 10)
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
