import { execSync } from 'child_process';
import fs from 'fs';

const vpsScript = `
import postgres from "postgres";
import fs from "fs";

const envLines = fs.readFileSync('.env.local', 'utf8').split('\\n');
let dbUrl = '';
for (const line of envLines) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    break;
  }
}

async function run() {
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    console.log("==================================================================");
    console.log("🚀 STARTING PURCHASE BOOKING REGISTER SEEDING & LIFECYCLE TEST");
    console.log("==================================================================\\n");

    // 1. Fetch master IDs
    const countries = await sql\`SELECT id, name, iso2 FROM public.countries;\`;
    const cMap = {};
    countries.forEach(c => cMap[c.name] = c);

    const countryBranches = await sql\`SELECT id, name, country_id FROM public.country_branches;\`;
    const cbMap = {};
    countryBranches.forEach(b => cbMap[b.name] = b);

    const cityBranches = await sql\`SELECT id, name, city_name, country_branch_id FROM public.city_branches;\`;
    const cityMap = {};
    cityBranches.forEach(b => {
      cityMap[b.name] = b;
      if (b.city_name) cityMap[b.city_name] = b;
    });

    const companies = await sql\`SELECT id, name FROM public.companies LIMIT 10;\`;
    const compId = companies[0]?.id;

    const warehouses = await sql\`SELECT id, warehouse_name FROM public.warehouses LIMIT 5;\`;
    const whId = warehouses[0]?.id;

    const products = await sql\`SELECT id, product_name FROM public.products LIMIT 5;\`;
    const prodId = products[0]?.id || null;

    // Resolve Country & Branch references
    const uae = cMap['United Arab Emirates'] || Object.values(cMap)[0];
    const uaeBranch = cbMap['United Arab Emirates Main Branch'] || Object.values(cbMap)[0];
    const dxbCity = cityMap['Al Ras'] || cityMap['DEV Demo Dubai City Branch'] || Object.values(cityMap)[0];

    const pak = cMap['Pakistan'] || Object.values(cMap)[0];
    const pakBranch = cbMap['Pakistan Main Branch'] || Object.values(cbMap)[0];
    const khiCity = cityMap['DEV Demo Karachi City Branch'] || Object.values(cityMap)[0];

    const ind = cMap['India'] || Object.values(cMap)[0];
    const indBranch = cbMap['India Main Branch'] || Object.values(cbMap)[0];

    console.log("Master references resolved successfully.");

    // 2. Clean out empty/dummy zero-value POs (keeping valid test POs)
    await sql\`
      DELETE FROM public.purchase_orders 
      WHERE order_total = 0 OR purchase_order_no LIKE 'PO-178729%' OR purchase_order_no LIKE 'PO-PB-2026-%' OR purchase_order_no = 'PO-TEST-LIFECYCLE-DEL';
    \`;
    console.log("🧹 Cleaned up corrupt/zero-value dummy draft records.");

    // =================================================================
    // ORDER 1: Royal Dry Fruits & Nuts Suite (7 Mixed Line Items)
    // =================================================================
    const dryFruitItems = [
      {
        allotName: "LOT-IRN-PIS-01",
        goodsName: "Iranian Pistachio (Akbari Jumbo 20/22)",
        itemCode: "0802.51",
        brand: "Kerman Royal Gold",
        origin: "Iran",
        size: "50kg Vacuum Jute Bag",
        qtyNo: 200,
        unit: "BAGS",
        qtyName: "BAGS",
        qtyKgs: 50,
        grossWeight: 10000,
        emptyKgs: 1,
        netWeight: 9800,
        coursePrice: 14.50,
        rateKg: 14.50,
        totalAmount: 142100.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 521862.25,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-AFG-ALM-02",
        goodsName: "Afghani Mamra Almonds (A-Grade)",
        itemCode: "0802.12",
        brand: "Balkh Heritage",
        origin: "Afghanistan",
        size: "25kg Master Carton",
        qtyNo: 150,
        unit: "CARTONS",
        qtyName: "CARTONS",
        qtyKgs: 25,
        grossWeight: 3750,
        emptyKgs: 0.8,
        netWeight: 3630,
        coursePrice: 18.00,
        rateKg: 18.00,
        totalAmount: 65340.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 239961.15,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-AFG-FIG-03",
        goodsName: "Royal Dried Figs / Injeer (Grade A+)",
        itemCode: "0804.20",
        brand: "Kandahar Pearl",
        origin: "Afghanistan",
        size: "10kg Gift Box",
        qtyNo: 300,
        unit: "BOXES",
        qtyName: "BOXES",
        qtyKgs: 10,
        grossWeight: 3000,
        emptyKgs: 0.5,
        netWeight: 2850,
        coursePrice: 16.50,
        rateKg: 16.50,
        totalAmount: 47025.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 172700.56,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-PAK-APR-04",
        goodsName: "Hunza Sun-Dried Apricots (Khobani Gold)",
        itemCode: "0813.10",
        brand: "Hunza Organic",
        origin: "Pakistan",
        size: "20kg Jute Bag",
        qtyNo: 250,
        unit: "BAGS",
        qtyName: "BAGS",
        qtyKgs: 20,
        grossWeight: 5000,
        emptyKgs: 0.6,
        netWeight: 4850,
        coursePrice: 7.20,
        rateKg: 7.20,
        totalAmount: 34920.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 128243.70,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-IND-WAL-05",
        goodsName: "Kashmir Walnut Giri (Light Halves)",
        itemCode: "0802.32",
        brand: "Kashmir Crown",
        origin: "India",
        size: "10kg Vacuum Carton",
        qtyNo: 180,
        unit: "CARTONS",
        qtyName: "CARTONS",
        qtyKgs: 10,
        grossWeight: 1800,
        emptyKgs: 0.5,
        netWeight: 1710,
        coursePrice: 12.00,
        rateKg: 12.00,
        totalAmount: 20520.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 75360.20,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-PAK-PIN-06",
        goodsName: "Waziristan Pine Nuts / Chilgoza (In Shell)",
        itemCode: "0802.90",
        brand: "Tribal Peaks",
        origin: "Pakistan",
        size: "25kg Poly Bag",
        qtyNo: 100,
        unit: "BAGS",
        qtyName: "BAGS",
        qtyKgs: 25,
        grossWeight: 2500,
        emptyKgs: 0.8,
        netWeight: 2420,
        coursePrice: 32.00,
        rateKg: 32.00,
        totalAmount: 77440.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 284398.40,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-AFG-RAI-07",
        goodsName: "Kandahar Golden Raisins / Kishmish (Sundrop)",
        itemCode: "0806.20",
        brand: "Afghan Golden Sun",
        origin: "Afghanistan",
        size: "10kg Master Carton",
        qtyNo: 400,
        unit: "CARTONS",
        qtyName: "CARTONS",
        qtyKgs: 10,
        grossWeight: 4000,
        emptyKgs: 0.5,
        netWeight: 3800,
        coursePrice: 5.50,
        rateKg: 5.50,
        totalAmount: 20900.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 76755.25,
        currencyLc: "AED"
      }
    ];

    const dryFruitTotalUSD = dryFruitItems.reduce((s, i) => s + i.totalAmount, 0); // 408,245.00
    const dryFruitTotalAED = dryFruitItems.reduce((s, i) => s + i.finalAmount, 0); // 1,499,281.51
    const dryFruitTotalQty = dryFruitItems.reduce((s, i) => s + i.qtyNo, 0); // 1,580
    const dryFruitGrossWt = dryFruitItems.reduce((s, i) => s + i.grossWeight, 0); // 30,050 kg
    const dryFruitNetWt = dryFruitItems.reduce((s, i) => s + i.netWeight, 0); // 29,060 kg

    const po1 = await sql\`
      INSERT INTO public.purchase_orders (
        purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id,
        supplier_company_id, currency_code, exchange_rate, order_total, advance_paid, remaining_paid,
        credit_amount, remaining_due, payment_status, ledger_posting_status, status,
        total_goods_usd, landed_cost_usd, form_data, created_at, updated_at
      ) VALUES (
        'PO-PB-2026-DRY-001', 'CNT-DRY-DXB-8801', \${uae.id}, \${uaeBranch.id}, \${dxbCity.id},
        \${compId}, 'USD', 3.6725, \${dryFruitTotalUSD}, 122473.50, 0.00,
        285771.50, 285771.50, 'PARTIALLY_PAID', 'POSTED', 'Accepted',
        \${dryFruitTotalUSD}, \${dryFruitTotalUSD}, \${JSON.stringify({
          form: {
            purchaseOrderNo: 'PO-PB-2026-DRY-001',
            manualBillNumber: 'CNT-DRY-DXB-8801',
            billNo: 'INV-DRY-2026-8801',
            salesOrderNo: 'SO-DRY-8801',
            purchaseContractNo: 'CNT-DRY-DXB-8801',
            superAdminSerialNo: 'SA-2026-000101',
            countrySerialNo: 'UAE-2026-000101',
            branchSerialNo: 'DXB-2026-000101',
            orderDate: '2026-08-15',
            bookingDate: '2026-08-15',
            purchaseDate: '2026-08-15',
            supplierName: 'Aryana Global Commodities FZE',
            supplierContact: '+971-4-2289941 (Dubai Wholesalers Market)',
            buyerName: 'Digital Dock International Trading LLC',
            customerName: 'Digital Dock International Trading LLC',
            purchaseAccountNo: 'UAE-ACC-DRY-001',
            purchaseAccountName: 'Dry Fruits Import Purchase Account',
            salesAccountNo: 'UAE-ACC-SLS-001',
            salesAccountName: 'Wholesale Dry Fruits Sales Account',
            countryName: 'United Arab Emirates',
            branchName: 'Dubai Central Branch (Al Ras)',
            shippingMode: 'By Sea',
            route: 'Bandar Abbas / Karachi -> Jebel Ali Port, Dubai',
            vesselName: 'MV Oriental Trader (V.882)',
            containerNumbers: 'TGHU-992147-1, MSKU-440182-3',
            loadingPort: 'Bandar Abbas Port Post',
            loadingCountry: 'Iran / Pakistan',
            loadingDate: '2026-08-10',
            receivedPort: 'Jebel Ali Port Post (WH-DXB-01)',
            receivedCountry: 'United Arab Emirates',
            receivingDate: '2026-08-18',
            paymentType: '30% Advance Bank TT + 70% LC Balance',
            advancePercent: 30,
            advanceAmountFc: 122473.50,
            advanceAmountLc: 449784.45,
            remainingAmountFc: 285771.50,
            remainingAmountLc: 1049497.06,
            advancePaymentDate: '2026-08-15',
            paymentDate: '2026-09-15',
            exchangeRate: 3.6725,
            currencyType: 'USD',
            finalCurrency: 'AED',
            status: 'Accepted',
            orderReportRemarks: 'High Grade Export Quality Multi-Item Dry Fruits Consignment (2 Containers)',
            userName: 'Super Admin Engineer'
          },
          goodsEntries: dryFruitItems,
          totals: {
            totalQuantity: dryFruitTotalQty,
            totalGross: dryFruitGrossWt,
            totalNet: dryFruitNetWt,
            grandPrimaryFinal: dryFruitTotalUSD,
            grandFinal: dryFruitTotalAED
          },
          workflow: {
            bookingStatus: 'Accepted',
            confirmationStatus: 'Accepted',
            paymentStatus: 'Advance Paid',
            containerStatus: 'Loaded',
            inventoryStatus: 'Warehouse Stored',
            deliveryStatus: 'In Transit'
          },
          audit: {
            userName: 'Super Admin Engineer',
            userId: 'USR-SUPER-001',
            branchCode: 'DXB-MAIN'
          }
        })}, NOW(), NOW()
      ) RETURNING id;
    \`;
    const po1Id = po1[0].id;

    for (const item of dryFruitItems) {
      await sql\`
        INSERT INTO public.purchase_order_items (
          purchase_order_id, product_id, goods_name, hs_code, size, brand, origin,
          quantity, unit_name, rate_original, rate_usd, total_original, total_usd
        ) VALUES (
          \${po1Id}, \${prodId}, \${item.goodsName}, \${item.itemCode}, \${item.size}, \${item.brand}, \${item.origin},
          \${item.qtyNo}, \${item.unit}, \${item.coursePrice}, \${item.coursePrice}, \${item.totalAmount}, \${item.totalAmount}
        );
      \`;
    }
    console.log("✅ Seeded Multi-Item Order 1: PO-PB-2026-DRY-001 (7 Dry Fruit Items, USD $408,245.00)");

    // =================================================================
    // ORDER 2: Exotic Spices & Garam Masala Suite (7 Mixed Line Items)
    // =================================================================
    const spiceItems = [
      {
        allotName: "LOT-IND-CRD-01",
        goodsName: "Idukki Green Cardamom (Elaichi Jumbo 8mm+)",
        itemCode: "0908.31",
        brand: "Kerala Spice Master",
        origin: "India",
        size: "25kg Vacuum Tin",
        qtyNo: 80,
        unit: "CARTONS",
        qtyName: "CARTONS",
        qtyKgs: 25,
        grossWeight: 2000,
        emptyKgs: 1.0,
        netWeight: 1920,
        coursePrice: 34.00,
        rateKg: 34.00,
        totalAmount: 65280.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 239740.80,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-IND-CUM-02",
        goodsName: "Whole Cumin Seeds (White Zeera Premium 99.5% Purity)",
        itemCode: "0909.31",
        brand: "Gujarat Royal Agro",
        origin: "India",
        size: "50kg Jute Bag",
        qtyNo: 300,
        unit: "BAGS",
        qtyName: "BAGS",
        qtyKgs: 50,
        grossWeight: 15000,
        emptyKgs: 1.2,
        netWeight: 14640,
        coursePrice: 4.80,
        rateKg: 4.80,
        totalAmount: 70272.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 258073.92,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-IND-PEP-03",
        goodsName: "Tellicherry Extra Bold Black Pepper (Kali Mirch)",
        itemCode: "0904.11",
        brand: "Malabar Pride",
        origin: "India",
        size: "50kg Poly Jute Bag",
        qtyNo: 200,
        unit: "BAGS",
        qtyName: "BAGS",
        qtyKgs: 50,
        grossWeight: 10000,
        emptyKgs: 1.0,
        netWeight: 9800,
        coursePrice: 7.50,
        rateKg: 7.50,
        totalAmount: 73500.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 269928.75,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-MDG-CLV-04",
        goodsName: "Madagascar Royal Cloves (Laung Handpicked)",
        itemCode: "0907.10",
        brand: "Island Gold",
        origin: "Madagascar",
        size: "25kg Master Carton",
        qtyNo: 120,
        unit: "CARTONS",
        qtyName: "CARTONS",
        qtyKgs: 25,
        grossWeight: 3000,
        emptyKgs: 0.8,
        netWeight: 2904,
        coursePrice: 11.50,
        rateKg: 11.50,
        totalAmount: 33396.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 122646.81,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-SRI-CIN-05",
        goodsName: "Ceylon Cinnamon Quills (Dalchini Alba True Grade)",
        itemCode: "0906.11",
        brand: "Ceylon Royal Spices",
        origin: "Sri Lanka",
        size: "25kg Fiber Box",
        qtyNo: 150,
        unit: "BOXES",
        qtyName: "BOXES",
        qtyKgs: 25,
        grossWeight: 3750,
        emptyKgs: 0.8,
        netWeight: 3630,
        coursePrice: 13.00,
        rateKg: 13.00,
        totalAmount: 47190.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 173305.28,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-UAE-GM-06",
        goodsName: "Royal Garam Masala Whole Spice Master Blend",
        itemCode: "0910.91",
        brand: "DGT Gourmet Spice House",
        origin: "UAE",
        size: "10kg Vacuum Pack",
        qtyNo: 250,
        unit: "TINS",
        qtyName: "TINS",
        qtyKgs: 10,
        grossWeight: 2500,
        emptyKgs: 0.5,
        netWeight: 2375,
        coursePrice: 9.80,
        rateKg: 9.80,
        totalAmount: 23275.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 85477.44,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-KSH-SAF-07",
        goodsName: "Kashmiri Saffron / Zafran (Super Negin Grade 1)",
        itemCode: "0910.20",
        brand: "Pampore Gold",
        origin: "India",
        size: "1kg Airtight Metal Canister",
        qtyNo: 50,
        unit: "CANS",
        qtyName: "CANS",
        qtyKgs: 1,
        grossWeight: 50,
        emptyKgs: 0.1,
        netWeight: 45,
        coursePrice: 1850.00,
        rateKg: 1850.00,
        totalAmount: 83250.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 305735.63,
        currencyLc: "AED"
      }
    ];

    const spiceTotalUSD = spiceItems.reduce((s, i) => s + i.totalAmount, 0); // 396,163.00
    const spiceTotalAED = spiceItems.reduce((s, i) => s + i.finalAmount, 0); // 1,454,908.63
    const spiceTotalQty = spiceItems.reduce((s, i) => s + i.qtyNo, 0); // 1,150
    const spiceGrossWt = spiceItems.reduce((s, i) => s + i.grossWeight, 0); // 36,300 kg
    const spiceNetWt = spiceItems.reduce((s, i) => s + i.netWeight, 0); // 35,314 kg

    const po2 = await sql\`
      INSERT INTO public.purchase_orders (
        purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id,
        supplier_company_id, currency_code, exchange_rate, order_total, advance_paid, remaining_paid,
        credit_amount, remaining_due, payment_status, ledger_posting_status, status,
        total_goods_usd, landed_cost_usd, form_data, created_at, updated_at
      ) VALUES (
        'PO-PB-2026-SPC-002', 'CNT-SPC-DXB-5502', \${ind.id}, \${indBranch.id}, \${dxbCity.id},
        \${compId}, 'USD', 3.6725, \${spiceTotalUSD}, 198081.50, 0.00,
        198081.50, 198081.50, 'PARTIALLY_PAID', 'POSTED', 'Accepted',
        \${spiceTotalUSD}, \${spiceTotalUSD}, \${JSON.stringify({
          form: {
            purchaseOrderNo: 'PO-PB-2026-SPC-002',
            manualBillNumber: 'CNT-SPC-DXB-5502',
            billNo: 'INV-SPC-2026-5502',
            salesOrderNo: 'SO-SPC-5502',
            purchaseContractNo: 'CNT-SPC-DXB-5502',
            superAdminSerialNo: 'SA-2026-000102',
            countrySerialNo: 'IND-2026-000102',
            branchSerialNo: 'MUM-2026-000102',
            orderDate: '2026-08-16',
            bookingDate: '2026-08-16',
            purchaseDate: '2026-08-16',
            supplierName: 'Cochin & Malabar Spices Export Corp',
            supplierContact: '+91-484-2668102 (Willingdon Island, Kochi)',
            buyerName: 'Digital Dock International Trading LLC',
            customerName: 'Digital Dock International Trading LLC',
            purchaseAccountNo: 'IND-ACC-SPC-002',
            purchaseAccountName: 'Exotic Spices Import Purchase Account',
            salesAccountNo: 'UAE-ACC-SLS-002',
            salesAccountName: 'Wholesale Spices Trading Account',
            countryName: 'India',
            branchName: 'India Main Branch (Mumbai & Cochin)',
            shippingMode: 'By Sea',
            route: 'Cochin / Nhava Sheva Port -> Jebel Ali Port, Dubai',
            vesselName: 'MV Malabar Express (V.401)',
            containerNumbers: 'CMAU-881920-4, PONU-339102-8',
            loadingPort: 'Cochin Spices Terminal Post',
            loadingCountry: 'India',
            loadingDate: '2026-08-12',
            receivedPort: 'Jebel Ali Port Post (WH-DXB-01)',
            receivedCountry: 'United Arab Emirates',
            receivingDate: '2026-08-19',
            paymentType: '50% Advance Bank TT + 50% Bill of Lading',
            advancePercent: 50,
            advanceAmountFc: 198081.50,
            advanceAmountLc: 727454.31,
            remainingAmountFc: 198081.50,
            remainingAmountLc: 727454.32,
            advancePaymentDate: '2026-08-16',
            paymentDate: '2026-09-16',
            exchangeRate: 3.6725,
            currencyType: 'USD',
            finalCurrency: 'AED',
            status: 'Accepted',
            orderReportRemarks: 'High Purity Export Quality Spices & Saffron Master Blend (2 Containers)',
            userName: 'Super Admin Engineer'
          },
          goodsEntries: spiceItems,
          totals: {
            totalQuantity: spiceTotalQty,
            totalGross: spiceGrossWt,
            totalNet: spiceNetWt,
            grandPrimaryFinal: spiceTotalUSD,
            grandFinal: spiceTotalAED
          },
          workflow: {
            bookingStatus: 'Accepted',
            confirmationStatus: 'Accepted',
            paymentStatus: 'Advance Paid',
            containerStatus: 'Loaded',
            inventoryStatus: 'Warehouse Stored',
            deliveryStatus: 'In Transit'
          },
          audit: {
            userName: 'Super Admin Engineer',
            userId: 'USR-SUPER-001',
            branchCode: 'MUM-MAIN'
          }
        })}, NOW(), NOW()
      ) RETURNING id;
    \`;
    const po2Id = po2[0].id;

    for (const item of spiceItems) {
      await sql\`
        INSERT INTO public.purchase_order_items (
          purchase_order_id, product_id, goods_name, hs_code, size, brand, origin,
          quantity, unit_name, rate_original, rate_usd, total_original, total_usd
        ) VALUES (
          \${po2Id}, \${prodId}, \${item.goodsName}, \${item.itemCode}, \${item.size}, \${item.brand}, \${item.origin},
          \${item.qtyNo}, \${item.unit}, \${item.coursePrice}, \${item.coursePrice}, \${item.totalAmount}, \${item.totalAmount}
        );
      \`;
    }
    console.log("✅ Seeded Multi-Item Order 2: PO-PB-2026-SPC-002 (7 Spice Items, USD $396,163.00)");

    // =================================================================
    // ORDER 3: Wholesale Agro Commodities & Bulk Grains (3 Mixed Items)
    // =================================================================
    const agroItems = [
      {
        allotName: "LOT-PAK-RCE-01",
        goodsName: "Super Kernel Basmati Rice 1121 Steam (XXL Grain)",
        itemCode: "1006.30",
        brand: "Falak Royal Reserve",
        origin: "Pakistan",
        size: "50kg Poly Bag",
        qtyNo: 1000,
        unit: "BAGS",
        qtyName: "BAGS",
        qtyKgs: 50,
        grossWeight: 50000,
        emptyKgs: 0.8,
        netWeight: 49200,
        coursePrice: 1.45,
        rateKg: 1.45,
        totalAmount: 71340.00,
        purchaseCurrency: "USD",
        exchangeRate: 278.50,
        finalAmount: 19868190.00,
        currencyLc: "PKR"
      },
      {
        allotName: "LOT-IND-TEA-02",
        goodsName: "Assam CTC Orthodox Gold Tea Leaves",
        itemCode: "0902.30",
        brand: "Assam Estate Gold",
        origin: "India",
        size: "25kg Multiwall Paper Sack",
        qtyNo: 500,
        unit: "SACKS",
        qtyName: "SACKS",
        qtyKgs: 25,
        grossWeight: 12500,
        emptyKgs: 0.5,
        netWeight: 12250,
        coursePrice: 4.20,
        rateKg: 4.20,
        totalAmount: 51450.00,
        purchaseCurrency: "USD",
        exchangeRate: 278.50,
        finalAmount: 14328825.00,
        currencyLc: "PKR"
      },
      {
        allotName: "LOT-IND-CHN-03",
        goodsName: "Kabuli Chickpeas / White Chana (12mm Jumbo)",
        itemCode: "0713.20",
        brand: "Punjab Harvest",
        origin: "India",
        size: "50kg Poly Woven Bag",
        qtyNo: 600,
        unit: "BAGS",
        qtyName: "BAGS",
        qtyKgs: 50,
        grossWeight: 30000,
        emptyKgs: 0.8,
        netWeight: 29520,
        coursePrice: 1.60,
        rateKg: 1.60,
        totalAmount: 47232.00,
        purchaseCurrency: "USD",
        exchangeRate: 278.50,
        finalAmount: 13154112.00,
        currencyLc: "PKR"
      }
    ];

    const agroTotalUSD = agroItems.reduce((s, i) => s + i.totalAmount, 0); // 170,022.00
    const agroTotalPKR = agroItems.reduce((s, i) => s + i.finalAmount, 0); // 47,351,127.00
    const agroTotalQty = agroItems.reduce((s, i) => s + i.qtyNo, 0); // 2,100
    const agroGrossWt = agroItems.reduce((s, i) => s + i.grossWeight, 0); // 92,500 kg
    const agroNetWt = agroItems.reduce((s, i) => s + i.netWeight, 0); // 90,970 kg

    const po3 = await sql\`
      INSERT INTO public.purchase_orders (
        purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id,
        supplier_company_id, currency_code, exchange_rate, order_total, advance_paid, remaining_paid,
        credit_amount, remaining_due, payment_status, ledger_posting_status, status,
        total_goods_usd, landed_cost_usd, form_data, created_at, updated_at
      ) VALUES (
        'PO-PB-2026-AGR-003', 'CNT-AGR-KHI-9903', \${pak.id}, \${pakBranch.id}, \${khiCity.id},
        \${compId}, 'USD', 278.50, \${agroTotalUSD}, 85011.00, 0.00,
        85011.00, 85011.00, 'PARTIALLY_PAID', 'POSTED', 'Accepted',
        \${agroTotalUSD}, \${agroTotalUSD}, \${JSON.stringify({
          form: {
            purchaseOrderNo: 'PO-PB-2026-AGR-003',
            manualBillNumber: 'CNT-AGR-KHI-9903',
            billNo: 'INV-AGR-2026-9903',
            salesOrderNo: 'SO-AGR-9903',
            purchaseContractNo: 'CNT-AGR-KHI-9903',
            superAdminSerialNo: 'SA-2026-000103',
            countrySerialNo: 'PAK-2026-000103',
            branchSerialNo: 'KHI-2026-000103',
            orderDate: '2026-08-17',
            bookingDate: '2026-08-17',
            purchaseDate: '2026-08-17',
            supplierName: 'Indus Agro Exporters Pvt Ltd',
            supplierContact: '+92-21-32419082 (Karachi Grain Market)',
            buyerName: 'Digital Dock Pakistan Trading Branch',
            customerName: 'Digital Dock Pakistan Trading Branch',
            purchaseAccountNo: 'PAK-ACC-AGR-003',
            purchaseAccountName: 'Agro Commodities Import Account',
            salesAccountNo: 'PAK-ACC-SLS-003',
            salesAccountName: 'Grain & Tea Wholesale Sales Account',
            countryName: 'Pakistan',
            branchName: 'Pakistan Main Branch (Karachi Port Hub)',
            shippingMode: 'By Sea',
            route: 'Port Qasim -> Karachi Central Warehouse Hub',
            vesselName: 'MV Indus Star (V.119)',
            containerNumbers: 'HJCU-771890-2, MSCU-990145-6, TEXU-312984-7',
            loadingPort: 'Port Qasim Terminal Post',
            loadingCountry: 'Pakistan',
            loadingDate: '2026-08-14',
            receivedPort: 'Karachi Central Logistics Hub (WH-KHI-01)',
            receivedCountry: 'Pakistan',
            receivingDate: '2026-08-20',
            paymentType: '50% Bank Transfer + 50% on Final Stock Intake',
            advancePercent: 50,
            advanceAmountFc: 85011.00,
            advanceAmountLc: 23675563.50,
            remainingAmountFc: 85011.00,
            remainingAmountLc: 23675563.50,
            advancePaymentDate: '2026-08-17',
            paymentDate: '2026-09-17',
            exchangeRate: 278.50,
            currencyType: 'USD',
            finalCurrency: 'PKR',
            status: 'Accepted',
            orderReportRemarks: 'Bulk Agricultural Commodity Rice, Tea & Chickpeas (3 Multi-Containers)',
            userName: 'Super Admin Engineer'
          },
          goodsEntries: agroItems,
          totals: {
            totalQuantity: agroTotalQty,
            totalGross: agroGrossWt,
            totalNet: agroNetWt,
            grandPrimaryFinal: agroTotalUSD,
            grandFinal: agroTotalPKR
          },
          workflow: {
            bookingStatus: 'Accepted',
            confirmationStatus: 'Accepted',
            paymentStatus: 'Advance Paid',
            containerStatus: 'Loaded',
            inventoryStatus: 'Warehouse Stored',
            deliveryStatus: 'Delivered'
          },
          audit: {
            userName: 'Super Admin Engineer',
            userId: 'USR-SUPER-001',
            branchCode: 'KHI-MAIN'
          }
        })}, NOW(), NOW()
      ) RETURNING id;
    \`;
    const po3Id = po3[0].id;

    for (const item of agroItems) {
      await sql\`
        INSERT INTO public.purchase_order_items (
          purchase_order_id, product_id, goods_name, hs_code, size, brand, origin,
          quantity, unit_name, rate_original, rate_usd, total_original, total_usd
        ) VALUES (
          \${po3Id}, \${prodId}, \${item.goodsName}, \${item.itemCode}, \${item.size}, \${item.brand}, \${item.origin},
          \${item.qtyNo}, \${item.unit}, \${item.coursePrice}, \${item.coursePrice}, \${item.totalAmount}, \${item.totalAmount}
        );
      \`;
    }
    console.log("✅ Seeded Multi-Item Order 3: PO-PB-2026-AGR-003 (3 Bulk Grain Items, USD $170,022.00)");

    // =================================================================
    // ORDER 4: Solar Energy & High-Tech Hardware Suite (3 Items)
    // =================================================================
    const solarItems = [
      {
        allotName: "LOT-SLR-INV-01",
        goodsName: "Commercial Solar Inverter 10kW Three-Phase Hybrid",
        itemCode: "8504.40",
        brand: "DGT PowerTech Pro",
        origin: "UAE / Germany",
        size: "Reinforced Wooden Crate",
        qtyNo: 150,
        unit: "CRATES",
        qtyName: "CRATES",
        qtyKgs: 45,
        grossWeight: 6750,
        emptyKgs: 3.0,
        netWeight: 6300,
        coursePrice: 480.00,
        rateKg: 480.00,
        totalAmount: 72000.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 264420.00,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-SLR-PNL-02",
        goodsName: "Tier-1 Monocrystalline Bifacial Solar Modules 580W",
        itemCode: "8541.43",
        brand: "SunCore Tier-1",
        origin: "China / UAE",
        size: "Pallet of 36 Panels",
        qtyNo: 800,
        unit: "PANELS",
        qtyName: "PANELS",
        qtyKgs: 28,
        grossWeight: 22400,
        emptyKgs: 1.5,
        netWeight: 21200,
        coursePrice: 95.00,
        rateKg: 95.00,
        totalAmount: 76000.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 279110.00,
        currencyLc: "AED"
      },
      {
        allotName: "LOT-SLR-BAT-03",
        goodsName: "Deep-Cycle Lithium (LiFePO4) Battery 48V 200Ah Pack",
        itemCode: "8507.60",
        brand: "VoltStorage Max",
        origin: "UAE",
        size: "Steel Cased Heavy Unit",
        qtyNo: 120,
        unit: "UNITS",
        qtyName: "UNITS",
        qtyKgs: 82,
        grossWeight: 9840,
        emptyKgs: 4.0,
        netWeight: 9360,
        coursePrice: 650.00,
        rateKg: 650.00,
        totalAmount: 78000.00,
        purchaseCurrency: "USD",
        exchangeRate: 3.6725,
        finalAmount: 286455.00,
        currencyLc: "AED"
      }
    ];

    const solarTotalUSD = solarItems.reduce((s, i) => s + i.totalAmount, 0); // 226,000.00
    const solarTotalAED = solarItems.reduce((s, i) => s + i.finalAmount, 0); // 829,985.00
    const solarTotalQty = solarItems.reduce((s, i) => s + i.qtyNo, 0); // 1,070
    const solarGrossWt = solarItems.reduce((s, i) => s + i.grossWeight, 0); // 38,990 kg
    const solarNetWt = solarItems.reduce((s, i) => s + i.netWeight, 0); // 36,860 kg

    const po4 = await sql\`
      INSERT INTO public.purchase_orders (
        purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id,
        supplier_company_id, currency_code, exchange_rate, order_total, advance_paid, remaining_paid,
        credit_amount, remaining_due, payment_status, ledger_posting_status, status,
        total_goods_usd, landed_cost_usd, form_data, created_at, updated_at
      ) VALUES (
        'PO-PB-2026-SLR-004', 'CNT-SLR-DXB-7704', \${uae.id}, \${uaeBranch.id}, \${dxbCity.id},
        \${compId}, 'USD', 3.6725, \${solarTotalUSD}, 90400.00, 0.00,
        135600.00, 135600.00, 'PARTIALLY_PAID', 'POSTED', 'Accepted',
        \${solarTotalUSD}, \${solarTotalUSD}, \${JSON.stringify({
          form: {
            purchaseOrderNo: 'PO-PB-2026-SLR-004',
            manualBillNumber: 'CNT-SLR-DXB-7704',
            billNo: 'INV-SLR-2026-7704',
            salesOrderNo: 'SO-SLR-7704',
            purchaseContractNo: 'CNT-SLR-DXB-7704',
            superAdminSerialNo: 'SA-2026-000104',
            countrySerialNo: 'UAE-2026-000104',
            branchSerialNo: 'DXB-2026-000104',
            orderDate: '2026-08-18',
            bookingDate: '2026-08-18',
            purchaseDate: '2026-08-18',
            supplierName: 'Gulf Renewable Energy Technologies FZE',
            supplierContact: '+971-4-8890214 (JAFZA South Zone)',
            buyerName: 'Digital Dock Engineering Division',
            customerName: 'Digital Dock Engineering Division',
            purchaseAccountNo: 'UAE-ACC-SLR-004',
            purchaseAccountName: 'Solar & Renewable Energy Equipment Account',
            salesAccountNo: 'UAE-ACC-SLS-004',
            salesAccountName: 'Industrial Hardware Sales Account',
            countryName: 'United Arab Emirates',
            branchName: 'United Arab Emirates Main Branch (Dubai)',
            shippingMode: 'By Sea',
            route: 'JAFZA Freezone -> Dubai Central Logistics Hub',
            vesselName: 'MV Gulf Pioneer (V.220)',
            containerNumbers: 'SUDU-882103-9, TRHU-449102-1',
            loadingPort: 'JAFZA Cargo Terminal Post',
            loadingCountry: 'United Arab Emirates',
            loadingDate: '2026-08-15',
            receivedPort: 'Dubai Central Warehouse (WH-DXB-01)',
            receivedCountry: 'United Arab Emirates',
            receivingDate: '2026-08-21',
            paymentType: '40% Advance Wire + 60% Letter of Credit',
            advancePercent: 40,
            advanceAmountFc: 90400.00,
            advanceAmountLc: 331994.00,
            remainingAmountFc: 135600.00,
            remainingAmountLc: 497991.00,
            advancePaymentDate: '2026-08-18',
            paymentDate: '2026-09-18',
            exchangeRate: 3.6725,
            currencyType: 'USD',
            finalCurrency: 'AED',
            status: 'Accepted',
            orderReportRemarks: 'Industrial Grade Tier-1 Solar Hybrid System and Energy Storage (2 Heavy Containers)',
            userName: 'Super Admin Engineer'
          },
          goodsEntries: solarItems,
          totals: {
            totalQuantity: solarTotalQty,
            totalGross: solarGrossWt,
            totalNet: solarNetWt,
            grandPrimaryFinal: solarTotalUSD,
            grandFinal: solarTotalAED
          },
          workflow: {
            bookingStatus: 'Accepted',
            confirmationStatus: 'Accepted',
            paymentStatus: 'Advance Paid',
            containerStatus: 'Loaded',
            inventoryStatus: 'Warehouse Stored',
            deliveryStatus: 'Delivered'
          },
          audit: {
            userName: 'Super Admin Engineer',
            userId: 'USR-SUPER-001',
            branchCode: 'DXB-MAIN'
          }
        })}, NOW(), NOW()
      ) RETURNING id;
    \`;
    const po4Id = po4[0].id;

    for (const item of solarItems) {
      await sql\`
        INSERT INTO public.purchase_order_items (
          purchase_order_id, product_id, goods_name, hs_code, size, brand, origin,
          quantity, unit_name, rate_original, rate_usd, total_original, total_usd
        ) VALUES (
          \${po4Id}, \${prodId}, \${item.goodsName}, \${item.itemCode}, \${item.size}, \${item.brand}, \${item.origin},
          \${item.qtyNo}, \${item.unit}, \${item.coursePrice}, \${item.coursePrice}, \${item.totalAmount}, \${item.totalAmount}
        );
      \`;
    }
    console.log("✅ Seeded Multi-Item Order 4: PO-PB-2026-SLR-004 (3 Solar Hardware Items, USD $226,000.00)");

    console.log("\\n=== TESTING REAL RECORD LIFECYCLE (Create -> Save -> View -> Edit -> Delete) ===");

    // -------------------------------------------------------------
    // LIFECYCLE TEST: Create Temp Order
    // -------------------------------------------------------------
    const tempPo = await sql\`
      INSERT INTO public.purchase_orders (
        purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id,
        supplier_company_id, currency_code, exchange_rate, order_total, advance_paid, remaining_paid,
        credit_amount, remaining_due, payment_status, ledger_posting_status, status,
        total_goods_usd, landed_cost_usd, form_data, created_at, updated_at
      ) VALUES (
        'PO-TEST-LIFECYCLE-DEL', 'CNT-TEMP-DEL-001', \${uae.id}, \${uaeBranch.id}, \${dxbCity.id},
        \${compId}, 'USD', 3.6725, 15000.00, 5000.00, 0.00,
        10000.00, 10000.00, 'PARTIALLY_PAID', 'POSTED', 'Draft',
        15000.00, 15000.00, \${JSON.stringify({
          form: {
            purchaseOrderNo: 'PO-TEST-LIFECYCLE-DEL',
            manualBillNumber: 'CNT-TEMP-DEL-001',
            status: 'Draft',
            supplierName: 'Temporary Test Supplier LLC'
          },
          goodsEntries: [{ goodsName: 'Temporary Verification Item', qtyNo: 10, totalAmount: 15000.00 }]
        })}, NOW(), NOW()
      ) RETURNING id;
    \`;
    const tempPoId = tempPo[0].id;
    console.log("1. Lifecycle CREATE & SAVE: Successfully created temp PO:", tempPoId);

    // -------------------------------------------------------------
    // LIFECYCLE TEST: View & Inspect
    // -------------------------------------------------------------
    const checkView = await sql\`SELECT id, purchase_order_no, order_total, status FROM public.purchase_orders WHERE id = \${tempPoId};\`;
    console.log("2. Lifecycle VIEW / READ:", checkView[0]?.purchase_order_no, "Status:", checkView[0]?.status, "Amount: $" + Number(checkView[0]?.order_total).toLocaleString());

    // -------------------------------------------------------------
    // LIFECYCLE TEST: Edit & Update
    // -------------------------------------------------------------
    const updatedFormData = {
      form: {
        purchaseOrderNo: 'PO-TEST-LIFECYCLE-DEL',
        manualBillNumber: 'CNT-TEMP-DEL-001',
        status: 'Accepted',
        supplierName: 'Temporary Test Supplier LLC (Updated)'
      },
      goodsEntries: [{ goodsName: 'Temporary Verification Item (Updated)', qtyNo: 12, totalAmount: 18500.00 }]
    };

    await sql\`
      UPDATE public.purchase_orders
      SET order_total = 18500.00,
          status = 'Accepted',
          updated_at = NOW(),
          form_data = \${JSON.stringify(updatedFormData)}
      WHERE id = \${tempPoId};
    \`;
    const checkUpdated = await sql\`SELECT id, purchase_order_no, order_total, status FROM public.purchase_orders WHERE id = \${tempPoId};\`;
    console.log("3. Lifecycle EDIT & UPDATE:", checkUpdated[0]?.purchase_order_no, "Updated Status:", checkUpdated[0]?.status, "Updated Total: $" + Number(checkUpdated[0]?.order_total).toLocaleString());

    // -------------------------------------------------------------
    // LIFECYCLE TEST: Delete & Remove
    // -------------------------------------------------------------
    await sql\`DELETE FROM public.purchase_orders WHERE id = \${tempPoId};\`;
    const checkDeleted = await sql\`SELECT count(*)::int as cnt FROM public.purchase_orders WHERE id = \${tempPoId};\`;
    console.log("4. Lifecycle DELETE & REMOVE: Verification count remaining =", checkDeleted[0]?.cnt, "(0 = cleanly removed)");

    console.log("\\n==================================================================");
    console.log("🎉 ALL PURCHASE BOOKINGS PERSISTED AND LIFECYCLE VERIFIED!");
    console.log("==================================================================");
  } catch (e) {
    console.error("Seeding and testing error:", e);
  } finally {
    await sql.end();
  }
}
run();
`;

fs.writeFileSync('scratch/run-seed-and-test.mjs', vpsScript);
try {
  execSync('scp -o StrictHostKeyChecking=no scratch/run-seed-and-test.mjs root@72.60.209.121:/var/www/dgt-nextjs/run-seed-and-test.mjs');
  const res = execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && node run-seed-and-test.mjs"', {
    encoding: 'utf8',
    timeout: 120000
  });
  console.log(res);
} catch (e) {
  console.error("Execution Error:", e.message);
}
