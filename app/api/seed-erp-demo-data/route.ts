import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const errors: any[] = [];
  let seededAccountsCount = 0;
  let seededOrdersCount = 0;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ success: false, error: "DATABASE_URL is not defined in environment." }, { status: 500 });
  }

  const sql = postgres(dbUrl, { ssl: "require", prepare: false, max: 1 });

  try {
    // 1. Fetch countries, country_branches, city_branches
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

    const makeAccNo = (prefix: string, i: number) => `${prefix}-${String(100 + i).padStart(4, "0")}`;

    // 2. SEED ACCOUNTS FOR UAE - AL_RAS BRANCH (25 ACCOUNTS)
    const uaeAccountsData = [
      { name: "Al Ras Dry Fruit Traders LLC", kind: "liability", code: "PA-1001", curr: "AED" },
      { name: "Al Ras Foodstuff Trading Co", kind: "liability", code: "PA-1002", curr: "AED" },
      { name: "Al Ras Grain & Spices Imports", kind: "liability", code: "PA-1003", curr: "USD" },
      { name: "Dubai Islamic Bank - Al Ras Branch", kind: "asset", code: "BA-2001", curr: "AED" },
      { name: "Al Ras Main Cash Book", kind: "asset", code: "CA-3001", curr: "AED" },
      { name: "Al Ras Petty Cash Ledger", kind: "asset", code: "CA-3002", curr: "AED" },
      { name: "Gulf Commodities Clearing Agent", kind: "liability", code: "PA-1004", curr: "USD" },
      { name: "Emirates Freight & Shipping Agency", kind: "expense", code: "EX-4001", curr: "AED" },
      { name: "Al Ras Commercial Purchase Account", kind: "expense", code: "EX-4002", curr: "USD" },
      { name: "Al Ras General Sales Revenue", kind: "income", code: "SA-5001", curr: "AED" }
    ];

    for (let i = 11; i <= 25; i++) {
      uaeAccountsData.push({
        name: `Al Ras Wholesale Merchant ${i - 10}`,
        kind: i % 2 === 0 ? "liability" : "asset",
        code: `PA-10${i}`,
        curr: i % 3 === 0 ? "USD" : "AED"
      });
    }

    for (const [idx, item] of uaeAccountsData.entries()) {
      const accNo = makeAccNo("UAE-ALRAS", idx + 1);
      try {
        const existing = await sql`SELECT id FROM enterprise_accounts WHERE account_number = ${accNo} OR name = ${item.name} LIMIT 1`;
        if (existing.length === 0) {
          await sql`
            INSERT INTO enterprise_accounts (
              account_number, name, code, kind, currency, country_id, country_branch_id, city_branch_id, status
            ) VALUES (
              ${accNo}, ${item.name}, ${item.code}, ${item.kind}, ${item.curr}, ${uaeCountry?.id || null}, ${uaeCb?.id || null}, ${alRasCity?.id || null}, 'active'
            )
          `;
        }
        seededAccountsCount++;
      } catch (err: any) {
        errors.push(`Acc insert err (${item.name}): ${err.message}`);
      }
    }

    // 3. SEED ACCOUNTS FOR PAKISTAN - CHAMAN BRANCH (15 ACCOUNTS)
    const chamanAccountsData = [
      { name: "Chaman Fruit Market Wholesalers", kind: "liability", code: "PA-CHM-01", curr: "PKR" },
      { name: "Meezan Bank - Chaman Branch", kind: "asset", code: "BA-CHM-01", curr: "PKR" },
      { name: "Chaman Main Cash Ledger", kind: "asset", code: "CA-CHM-01", curr: "PKR" },
      { name: "Chaman Border Goods Transport", kind: "expense", code: "EX-CHM-01", curr: "PKR" },
      { name: "Chaman Dry Fruit Mandi Commission", kind: "income", code: "SA-CHM-01", curr: "PKR" }
    ];

    for (let i = 6; i <= 15; i++) {
      chamanAccountsData.push({
        name: `Chaman Traders Account ${i}`,
        kind: i % 2 === 0 ? "liability" : "asset",
        code: `PA-CHM-${String(i).padStart(2, "0")}`,
        curr: "PKR"
      });
    }

    for (const [idx, item] of chamanAccountsData.entries()) {
      const accNo = makeAccNo("PK-CHM", idx + 1);
      try {
        const existing = await sql`SELECT id FROM enterprise_accounts WHERE account_number = ${accNo} OR name = ${item.name} LIMIT 1`;
        if (existing.length === 0) {
          await sql`
            INSERT INTO enterprise_accounts (
              account_number, name, code, kind, currency, country_id, country_branch_id, city_branch_id, status
            ) VALUES (
              ${accNo}, ${item.name}, ${item.code}, ${item.kind}, ${item.curr}, ${pkCountry?.id || null}, ${pkCb?.id || null}, ${chamanCity?.id || null}, 'active'
            )
          `;
        }
        seededAccountsCount++;
      } catch (err: any) {
        errors.push(`Acc insert err (${item.name}): ${err.message}`);
      }
    }

    // 4. SEED ACCOUNTS FOR PAKISTAN - QUETTA BRANCH (15 ACCOUNTS)
    const quettaAccountsData = [
      { name: "Quetta Dry Fruit Commission Agents", kind: "liability", code: "PA-QTA-01", curr: "PKR" },
      { name: "Habib Bank Limited - Quetta Branch", kind: "asset", code: "BA-QTA-01", curr: "PKR" },
      { name: "Quetta City Main Cash Book", kind: "asset", code: "CA-QTA-01", curr: "PKR" },
      { name: "Quetta Cold Storage & Logistics", kind: "expense", code: "EX-QTA-01", curr: "PKR" },
      { name: "Quetta Wholesale Sales Account", kind: "income", code: "SA-QTA-01", curr: "PKR" }
    ];

    for (let i = 6; i <= 15; i++) {
      quettaAccountsData.push({
        name: `Quetta Merchant Account ${i}`,
        kind: i % 2 === 0 ? "liability" : "asset",
        code: `PA-QTA-${String(i).padStart(2, "0")}`,
        curr: "PKR"
      });
    }

    for (const [idx, item] of quettaAccountsData.entries()) {
      const accNo = makeAccNo("PK-QTA", idx + 1);
      try {
        const existing = await sql`SELECT id FROM enterprise_accounts WHERE account_number = ${accNo} OR name = ${item.name} LIMIT 1`;
        if (existing.length === 0) {
          await sql`
            INSERT INTO enterprise_accounts (
              account_number, name, code, kind, currency, country_id, country_branch_id, city_branch_id, status
            ) VALUES (
              ${accNo}, ${item.name}, ${item.code}, ${item.kind}, ${item.curr}, ${pkCountry?.id || null}, ${pkCb?.id || null}, ${quettaCity?.id || null}, 'active'
            )
          `;
        }
        seededAccountsCount++;
      } catch (err: any) {
        errors.push(`Acc insert err (${item.name}): ${err.message}`);
      }
    }

    // 5. SEED PURCHASE BOOKING ORDERS INTO purchase_orders
    const demoOrders = [
      {
        purchase_booking_order_number: "PB-2026-0001",
        manual_bill_number: "INV-UAE-801",
        country_id: uaeCountry?.id || null,
        country_branch_id: uaeCb?.id || null,
        city_branch_id: alRasCity?.id || null,
        country_name: "United Arab Emirates",
        branch_name: "AL_RAS",
        supplier_name: "Al Ras Dry Fruit Traders LLC",
        product_name: "Almond Kernels USA Extra No. 1",
        quantity: 1200,
        unit: "BAGS",
        purchase_amount: 323400,
        final_amount: 1187686,
        currency: "USD",
        final_currency: "AED",
        status: "Posted",
        booking_date: "2026-07-20"
      },
      {
        purchase_booking_order_number: "PB-2026-0002",
        manual_bill_number: "INV-UAE-802",
        country_id: uaeCountry?.id || null,
        country_branch_id: uaeCb?.id || null,
        city_branch_id: alRasCity?.id || null,
        country_name: "United Arab Emirates",
        branch_name: "AL_RAS",
        supplier_name: "Al Ras Foodstuff Trading Co",
        product_name: "Pistachios Roasted Salted Kerman",
        quantity: 800,
        unit: "BAGS",
        purchase_amount: 360640,
        final_amount: 1324450,
        currency: "USD",
        final_currency: "AED",
        status: "Accepted",
        booking_date: "2026-07-22"
      },
      {
        purchase_booking_order_number: "PB-2026-0003",
        manual_bill_number: "INV-DXB-901",
        country_id: uaeCountry?.id || null,
        country_branch_id: uaeCb?.id || null,
        city_branch_id: dubaiMainCity?.id || null,
        country_name: "United Arab Emirates",
        branch_name: "Dubai Main Branch",
        supplier_name: "Gulf Commodities Clearing Agent",
        product_name: "Walnuts In-Shell Chandler",
        quantity: 600,
        unit: "BAGS",
        purchase_amount: 141120,
        final_amount: 518263,
        currency: "USD",
        final_currency: "AED",
        status: "Accepted",
        booking_date: "2026-07-24"
      },
      {
        purchase_booking_order_number: "PB-2026-0004",
        manual_bill_number: "INV-PK-CHM-101",
        country_id: pkCountry?.id || null,
        country_branch_id: pkCb?.id || null,
        city_branch_id: chamanCity?.id || null,
        country_name: "Pakistan",
        branch_name: "Chaman Branch",
        supplier_name: "Chaman Fruit Market Wholesalers",
        product_name: "Green Raisins Sundekhani Grade A",
        quantity: 1500,
        unit: "BAGS",
        purchase_amount: 235200,
        final_amount: 65385600,
        currency: "USD",
        final_currency: "PKR",
        status: "Transferred",
        booking_date: "2026-07-25"
      },
      {
        purchase_booking_order_number: "PB-2026-0005",
        manual_bill_number: "INV-PK-QTA-201",
        country_id: pkCountry?.id || null,
        country_branch_id: pkCb?.id || null,
        city_branch_id: quettaCity?.id || null,
        country_name: "Pakistan",
        branch_name: "Quetta Branch",
        supplier_name: "Quetta Dry Fruit Commission Agents",
        product_name: "Pine Nuts Chilgoza Whole Unshelled",
        quantity: 400,
        unit: "BAGS",
        purchase_amount: 558600,
        final_amount: 155290800,
        currency: "USD",
        final_currency: "PKR",
        status: "Accepted",
        booking_date: "2026-07-26"
      }
    ];

    for (const order of demoOrders) {
      const formDataJson = JSON.stringify({
        form: {
          billNo: order.manual_bill_number,
          supplierName: order.supplier_name,
          countryName: order.country_name,
          branchName: order.branch_name,
          advancePercent: 10,
          advanceAmountFc: order.purchase_amount * 0.1,
          advanceAmountLc: order.final_amount * 0.1,
          remainingAmountFc: order.purchase_amount * 0.9,
          remainingAmountLc: order.final_amount * 0.9
        },
        goodsEntries: [
          {
            goodsName: order.product_name,
            qtyNo: order.quantity,
            qtyName: order.unit,
            qtyKgs: 50,
            emptyKgs: 1,
            coursePrice: (order.purchase_amount / (order.quantity * 49)).toFixed(2),
            totalAmount: order.purchase_amount,
            finalAmount: order.final_amount,
            origin: order.country_name === "Pakistan" ? "Afghanistan" : "USA"
          }
        ]
      });

      try {
        const existing = await sql`SELECT id FROM purchase_orders WHERE purchase_booking_order_number = ${order.purchase_booking_order_number} LIMIT 1`;
        if (existing.length === 0) {
          await sql`
            INSERT INTO purchase_orders (
              purchase_booking_order_number, manual_bill_number, country_id, country_branch_id, city_branch_id,
              country_name, branch_name, supplier_name, product_name, quantity, unit, purchase_amount,
              final_amount, currency, final_currency, status, booking_date, form_data
            ) VALUES (
              ${order.purchase_booking_order_number}, ${order.manual_bill_number}, ${order.country_id}, ${order.country_branch_id}, ${order.city_branch_id},
              ${order.country_name}, ${order.branch_name}, ${order.supplier_name}, ${order.product_name}, ${order.quantity}, ${order.unit}, ${order.purchase_amount},
              ${order.final_amount}, ${order.currency}, ${order.final_currency}, ${order.status}, ${order.booking_date}, ${formDataJson}
            )
          `;
        }
        seededOrdersCount++;
      } catch (err: any) {
        errors.push(`Order insert err (${order.purchase_booking_order_number}): ${err.message}`);
      }
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
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
