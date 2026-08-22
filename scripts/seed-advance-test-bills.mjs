import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

const billsToSeed = [
  {
    orderNo: "PO-ADV-2026-001",
    billNo: "BILL-ADV-001",
    countryName: "United Arab Emirates",
    countryIso: "AE",
    branchName: "Deira Dubai City Branch",
    branchCode: "DEV-AE-DEIRA",
    currency: "USD",
    baseCurrency: "AED",
    exRate: 3.6725,
    supplierName: "Al Madina Agri Commodities LLC",
    supplierCode: "SUP-AE-1001",
    buyerName: "Damaan General Trading LLC",
    buyerCode: "BYR-AE-0001",
    goodsName: "High-Protein Soya Feed Pellets 48%",
    qty: 2000,
    unit: "BAGS",
    netWeight: 100000,
    grossWeight: 100200,
    rate: 32.50,
    totalUSD: 65000.00,
    advancePercent: 25,
    loadingPort: "Jebel Ali Port (AE)",
    receivingPort: "Karachi Port (PK)",
    shippingMode: "By Sea"
  },
  {
    orderNo: "PO-ADV-2026-002",
    billNo: "BILL-ADV-002",
    countryName: "Pakistan",
    countryIso: "PK",
    branchName: "DEV Demo Karachi City Branch",
    branchCode: "DEV-PK-CITY-001",
    currency: "USD",
    baseCurrency: "PKR",
    exRate: 287.50,
    supplierName: "Indus Grains & Agro Mills Ltd",
    supplierCode: "SUP-PK-2001",
    buyerName: "Damaan Livestock Feeds Pakistan",
    buyerCode: "BYR-PK-0001",
    goodsName: "Super Kernel Basmati Rice (Export Grade)",
    qty: 1500,
    unit: "BAGS",
    netWeight: 75000,
    grossWeight: 75150,
    rate: 48.00,
    totalUSD: 72000.00,
    advancePercent: 30,
    loadingPort: "Port Qasim (PK)",
    receivingPort: "Jebel Ali Port (AE)",
    shippingMode: "By Sea"
  },
  {
    orderNo: "PO-ADV-2026-003",
    billNo: "BILL-ADV-003",
    countryName: "Afghanistan",
    countryIso: "AF",
    branchName: "DEV Demo Kabul City Branch",
    branchCode: "DEV-AF-CITY-001",
    currency: "USD",
    baseCurrency: "AFN",
    exRate: 71.50,
    supplierName: "Khyber Agro Global Supplies",
    supplierCode: "SUP-AF-3001",
    buyerName: "Damaan Import & Export Kabul",
    buyerCode: "BYR-AF-0001",
    goodsName: "White Milling Wheat Grains Grade-A",
    qty: 3000,
    unit: "BAGS",
    netWeight: 150000,
    grossWeight: 150300,
    rate: 24.00,
    totalUSD: 72000.00,
    advancePercent: 20,
    loadingPort: "Torkham Border (AF)",
    receivingPort: "Chaman Border (PK)",
    shippingMode: "By Road"
  },
  {
    orderNo: "PO-ADV-2026-004",
    billNo: "BILL-ADV-004",
    countryName: "United Arab Emirates",
    countryIso: "AE",
    branchName: "Deira Dubai City Branch",
    branchCode: "DEV-AE-DEIRA",
    currency: "USD",
    baseCurrency: "AED",
    exRate: 3.6725,
    supplierName: "Gulf Chemical & Fertilizer FZE",
    supplierCode: "SUP-AE-1002",
    buyerName: "Damaan General Trading LLC",
    buyerCode: "BYR-AE-0001",
    goodsName: "Prilled Urea 46% Nitrogen Fertilizer",
    qty: 4000,
    unit: "BAGS",
    netWeight: 200000,
    grossWeight: 200400,
    rate: 18.75,
    totalUSD: 75000.00,
    advancePercent: 40,
    loadingPort: "Hamriya Port (AE)",
    receivingPort: "Karachi Port (PK)",
    shippingMode: "By Sea"
  },
  {
    orderNo: "PO-ADV-2026-005",
    billNo: "BILL-ADV-005",
    countryName: "Pakistan",
    countryIso: "PK",
    branchName: "Quetta City Branch",
    branchCode: "DEV-PK-QUETTA",
    currency: "USD",
    baseCurrency: "PKR",
    exRate: 287.50,
    supplierName: "Bolan Sugar & Refining Corporation",
    supplierCode: "SUP-PK-2002",
    buyerName: "Damaan Livestock Feeds Pakistan",
    buyerCode: "BYR-PK-0001",
    goodsName: "Refined Fine Granulated White Sugar",
    qty: 2500,
    unit: "BAGS",
    netWeight: 125000,
    grossWeight: 125250,
    rate: 34.00,
    totalUSD: 85000.00,
    advancePercent: 25,
    loadingPort: "Quetta Terminal (PK)",
    receivingPort: "Kandahar Terminal (AF)",
    shippingMode: "By Road"
  },
  {
    orderNo: "PO-ADV-2026-006",
    billNo: "BILL-ADV-006",
    countryName: "United Arab Emirates",
    countryIso: "AE",
    branchName: "Deira Dubai City Branch",
    branchCode: "DEV-AE-DEIRA",
    currency: "USD",
    baseCurrency: "AED",
    exRate: 3.6725,
    supplierName: "Emirates Raw Cotton Traders LLC",
    supplierCode: "SUP-AE-1003",
    buyerName: "Damaan General Trading LLC",
    buyerCode: "BYR-AE-0001",
    goodsName: "Raw Ginned Cotton Bales 220kg",
    qty: 500,
    unit: "BALES",
    netWeight: 110000,
    grossWeight: 110500,
    rate: 160.00,
    totalUSD: 80000.00,
    advancePercent: 50,
    loadingPort: "Jebel Ali Port (AE)",
    receivingPort: "Mundra Port (IN)",
    shippingMode: "By Sea"
  }
];

async function seed() {
  const dbUrl = getDbUrl();
  console.log("Connecting to PostgreSQL at:", dbUrl.split('@')[1] || "local");
  const sql = postgres(dbUrl, { max: 1 });

  for (const b of billsToSeed) {
    const countryRows = await sql`select id from countries where name = ${b.countryName} or iso2 = ${b.countryIso} limit 1`;
    const countryId = countryRows[0]?.id || null;

    const branchRows = await sql`select id, country_id from city_branches where code = ${b.branchCode} or name = ${b.branchName} limit 1`;
    const branchId = branchRows[0]?.id || null;

    const reqAdvUSD = (b.totalUSD * b.advancePercent) / 100;
    const reqAdvLC = reqAdvUSD * b.exRate;
    const totalLC = b.totalUSD * b.exRate;

    const formData = {
      form: {
        purchaseOrderNo: b.orderNo,
        billNo: b.billNo,
        manualBillNo: b.billNo,
        manualBillNumber: b.billNo,
        purchaseDate: new Date().toISOString().slice(0, 10),
        bookingDate: new Date().toISOString().slice(0, 10),
        purchaseAccountName: b.buyerName,
        purchaseAccountNo: b.buyerCode,
        salesAccountName: b.supplierName,
        salesAccountNo: b.supplierCode,
        supplierName: b.supplierName,
        buyerName: b.buyerName,
        goodsName: b.goodsName,
        quantity: b.qty,
        qtyNo: b.qty,
        qtyName: b.unit,
        unitName: b.unit,
        netWeight: b.netWeight,
        grossWeight: b.grossWeight,
        coursePrice: b.rate,
        totalAmount: b.totalUSD,
        currency: b.currency,
        currencyType: b.currency,
        purchaseCurrency: b.currency,
        paymentCurrency: b.baseCurrency,
        exchangeRate: b.exRate,
        advancePercent: b.advancePercent,
        advanceAmount: reqAdvUSD,
        advanceAmountPKR: reqAdvLC,
        loadingCountry: b.countryName,
        loadingPort: b.loadingPort,
        receivingPort: b.receivingPort,
        shippingMode: b.shippingMode,
        branchName: b.branchName,
        branchCode: b.branchCode,
        countryName: b.countryName,
        paymentType: "Advance",
        transferAudit: {
          transferredAt: new Date().toISOString(),
          transferredBy: "ERP Super Admin",
          status: "transferred"
        }
      },
      goodsEntries: [
        {
          goodsName: b.goodsName,
          item: b.goodsName,
          qtyNo: b.qty,
          qtyName: b.unit,
          netWeight: b.netWeight,
          grossWeight: b.grossWeight,
          coursePrice: b.rate,
          totalAmount: b.totalUSD,
          priceType: "P/Item"
        }
      ],
      totals: {
        totalQuantity: b.qty,
        totalNetWeight: b.netWeight,
        totalGrossWeight: b.grossWeight,
        totalAmount: b.totalUSD,
        grandFinal: b.totalUSD
      },
      workflow: {
        journalStatus: "Posted",
        transferStatus: "transferred",
        transferredToLoading: true,
        loadedQuantity: 0,
        advancePaymentStatus: "pending"
      }
    };

    // Upsert PO
    const existing = await sql`select id from purchase_orders where purchase_order_no = ${b.orderNo} limit 1`;
    if (existing[0]) {
      await sql`
        update purchase_orders set
          country_id = ${countryId},
          city_branch_id = ${branchId},
          currency_code = ${b.currency},
          exchange_rate = ${b.exRate},
          order_total = ${b.totalUSD},
          advance_paid = 0,
          remaining_paid = 0,
          remaining_due = ${b.totalUSD - reqAdvUSD},
          payment_status = 'unpaid',
          ledger_posting_status = 'posted',
          status = 'Posted',
          form_data = ${sql.json(formData)},
          updated_at = now()
        where id = ${existing[0].id}
      `;
      console.log(`Updated test PO: ${b.orderNo} (${b.goodsName} - Advance: ${b.advancePercent}%)`);
    } else {
      const newId = crypto.randomUUID();
      await sql`
        insert into purchase_orders (
          id, country_id, city_branch_id, purchase_order_no, purchase_contract_no,
          currency_code, exchange_rate, order_total, advance_paid, remaining_paid,
          remaining_due, payment_status, ledger_posting_status, status, form_data,
          created_at, updated_at
        ) values (
          ${newId}, ${countryId}, ${branchId}, ${b.orderNo}, ${b.billNo},
          ${b.currency}, ${b.exRate}, ${b.totalUSD}, 0, 0,
          ${b.totalUSD - reqAdvUSD}, 'unpaid', 'posted', 'Posted', ${sql.json(formData)},
          now(), now()
        )
      `;
      console.log(`Created test PO: ${b.orderNo} (${b.goodsName} - Advance: ${b.advancePercent}%)`);
    }
  }

  await sql.end();
  console.log("\n✅ All 6 Advance test bills have been successfully seeded!");
}

seed().catch(console.error);
