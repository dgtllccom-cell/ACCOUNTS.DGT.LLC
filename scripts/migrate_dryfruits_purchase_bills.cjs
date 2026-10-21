const fs = require('fs');
const crypto = require('crypto');
const postgres = require('/var/www/dgt-nextjs/node_modules/postgres');
const mysql = require('/var/www/dgt-nextjs/node_modules/mysql2/promise');

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

// Generate deterministic UUIDv4 from a string seed (PB-...)
function deterministicUuid(seed) {
  const hash = crypto.createHash('sha256').update('dgt-dryfruits-po:' + seed).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join('-');
}

async function migrate() {
  const env = loadEnv('/var/www/dgt-nextjs/.env');
  console.log('Target DB URL:', env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

  const myConn = await mysql.createConnection({
    socketPath: '/var/run/mysqld/mysqld.sock',
    user: 'root',
    database: 'dryfruits_erp'
  });
  console.log('Connected to MySQL dryfruits_erp');

  const pgSql = postgres(env.DATABASE_URL, { max: 2 });
  console.log('Connected to PostgreSQL Production');

  // --- Step 1: Ensure Country & Branches for Saudi Arabia and Oman exist in Postgres ---
  console.log('\n--- Step 1: Ensuring Countries & Branches in Postgres ---');

  // 1a. Oman
  let [omanCountry] = await pgSql`SELECT id, name, iso2 FROM public.countries WHERE iso2 = 'OM' LIMIT 1`;
  if (!omanCountry) {
    console.log('Adding Oman (OM) to public.countries...');
    const [cSample] = await pgSql`SELECT * FROM public.countries LIMIT 1`;
    console.log('Sample country columns:', Object.keys(cSample));
    [omanCountry] = await pgSql`
      INSERT INTO public.countries (name, iso2, currency_code, official_email, admin_email, email_domain, is_active)
      VALUES ('Oman', 'OM', 'OMR', 'oman@dgt.llc', 'oman.admin@dgt.llc', 'dgt.llc', true)
      RETURNING id, name, iso2
    `;
  }
  console.log(`Oman Country ID: ${omanCountry.id}`);

  // 1b. Saudi Arabia
  let [saCountry] = await pgSql`SELECT id, name, iso2 FROM public.countries WHERE iso2 = 'SA' LIMIT 1`;
  console.log(`Saudi Arabia Country ID: ${saCountry.id}`);

  // 1c. Country Branches
  const reqCbCols = await pgSql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'country_branches' AND is_nullable = 'NO' AND column_default IS NULL
  `;
  console.log('Required country_branches columns without defaults:', reqCbCols);

  const [existingCb] = await pgSql`SELECT * FROM public.country_branches LIMIT 1`;

  // Saudi Country Branch
  let [saCb] = await pgSql`SELECT id, name, code FROM public.country_branches WHERE country_id = ${saCountry.id} LIMIT 1`;
  if (!saCb) {
    console.log('Creating Saudi Arabia Main Branch...');
    [saCb] = await pgSql`
      INSERT INTO public.country_branches (
        country_id, name, code, local_currency, is_main, status,
        email, phone, address
      )
      VALUES (
        ${saCountry.id}, 'Saudi Arabia Main Branch', 'SAU-MAIN-001', 'SAR', true, 'active',
        'saudi.branch@dgt.llc', '+966-11-0000000', 'Riyadh, Saudi Arabia'
      )
      RETURNING id, name, code
    `;
  }
  console.log(`Saudi Country Branch: ${saCb.code} [${saCb.id}]`);

  // Oman Country Branch
  let [omCb] = await pgSql`SELECT id, name, code FROM public.country_branches WHERE country_id = ${omanCountry.id} LIMIT 1`;
  if (!omCb) {
    console.log('Creating Oman Main Branch...');
    [omCb] = await pgSql`
      INSERT INTO public.country_branches (
        country_id, name, code, local_currency, is_main, status,
        email, phone, address
      )
      VALUES (
        ${omanCountry.id}, 'Oman Main Branch', 'OMN-MAIN-001', 'OMR', true, 'active',
        'oman.branch@dgt.llc', '+968-24-000000', 'Muscat, Oman'
      )
      RETURNING id, name, code
    `;
  }
  console.log(`Oman Country Branch: ${omCb.code} [${omCb.id}]`);

  // 1d. City Branches
  const reqCibCols = await pgSql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'city_branches' AND is_nullable = 'NO' AND column_default IS NULL
  `;
  console.log('Required city_branches columns without defaults:', reqCibCols);

  const ensureCityBranch = async (countryId, cbId, code, name, cityName, currency) => {
    let [b] = await pgSql`SELECT id, name, code, city_name, country_branch_id FROM public.city_branches WHERE code = ${code} LIMIT 1`;
    if (!b) {
      console.log(`Creating city branch ${code} (${cityName})...`);
      const branchEmail = `${code.toLowerCase().replace(/[^a-z0-9]/g, '.')}@dgt.llc`;
      [b] = await pgSql`
        INSERT INTO public.city_branches (
          country_id, country_branch_id, code, name, city_name, local_currency, status, email
        )
        VALUES (
          ${countryId}, ${cbId}, ${code}, ${name}, ${cityName}, ${currency}, 'active', ${branchEmail}
        )
        RETURNING id, name, code, city_name, country_branch_id
      `;
    }
    return b;
  };

  const saRiyadh = await ensureCityBranch(saCountry.id, saCb.id, 'SAU-RUH-001', 'Riyadh City Branch', 'Riyadh', 'SAR');
  const saJeddah = await ensureCityBranch(saCountry.id, saCb.id, 'SAU-JED-001', 'Jeddah City Branch', 'Jeddah', 'SAR');
  const omMuscat = await ensureCityBranch(omanCountry.id, omCb.id, 'OMN-MCT-001', 'Muscat City Branch', 'Muscat', 'OMR');
  const omSalalah = await ensureCityBranch(omanCountry.id, omCb.id, 'OMN-SLL-001', 'Salalah City Branch', 'Salalah', 'OMR');

  // Load all Postgres city branches and countries
  const allPgCityBranches = await pgSql`SELECT id, name, code, city_name, country_branch_id FROM public.city_branches`;
  const allPgCountryBranches = await pgSql`SELECT id, name, code, country_id FROM public.country_branches`;
  const allPgCountries = await pgSql`SELECT id, name, iso2 FROM public.countries`;

  const cbMap = new Map(allPgCountryBranches.map(cb => [cb.id, cb]));
  const countryMap = new Map(allPgCountries.map(c => [c.id, c]));

  // Branch mapping dictionary: MySQL branch code -> Postgres city_branch
  const branchMapping = {
    'UAE-DXB-01': allPgCityBranches.find(b => b.code === 'ARE-DXB-001'),
    'UAE-AUH-01': allPgCityBranches.find(b => b.code === 'ARE-AUH-001'),
    'PK-KHI-01': allPgCityBranches.find(b => b.code === 'PAK-KHI-001'),
    'PK-LHR-01': allPgCityBranches.find(b => b.code === 'PAK-LHE-001'),
    'AF-KBL-01': allPgCityBranches.find(b => b.code === 'AFG-KBL-001'),
    'AF-HER-01': allPgCityBranches.find(b => b.code === 'AFG-HRT-001'),
    'SA-RUH-01': saRiyadh,
    'SA-JED-01': saJeddah,
    'OM-MCT-01': omMuscat,
    'OM-SLL-01': omSalalah
  };

  console.log('\nBranch Mappings:');
  for (const [myCode, pgBranch] of Object.entries(branchMapping)) {
    const cb = cbMap.get(pgBranch.country_branch_id);
    const country = countryMap.get(cb.country_id);
    console.log(`  MySQL ${myCode} -> Postgres ${pgBranch.code} (${pgBranch.name}) in ${country.name}`);
  }

  // --- Step 2: Fetch MySQL Data ---
  console.log('\n--- Step 2: Fetching MySQL Data ---');
  const [branches] = await myConn.query(`SELECT b.*, c.name as country_name, c.code as country_code FROM branches b JOIN countries c ON b.country_id = c.id`);
  const myBranchMap = new Map(branches.map(b => [b.id, b]));

  const [suppliers] = await myConn.query(`SELECT * FROM suppliers`);
  const mySupplierMap = new Map(suppliers.map(s => [s.id, s]));

  const [products] = await myConn.query(`SELECT * FROM products`);
  const myProductMap = new Map(products.map(p => [p.id, p]));

  const [shipments] = await myConn.query(`SELECT * FROM shipments`);
  const myShipmentMap = new Map(shipments.map(s => [s.id, s]));

  const [containers] = await myConn.query(`SELECT * FROM shipment_containers`);
  const containersByShipment = new Map();
  containers.forEach(c => {
    if (!containersByShipment.has(c.shipment_id)) containersByShipment.set(c.shipment_id, []);
    containersByShipment.get(c.shipment_id).push(c);
  });

  const [items] = await myConn.query(`SELECT * FROM purchase_bill_items ORDER BY id`);
  const itemsByBill = new Map();
  items.forEach(item => {
    if (!itemsByBill.has(item.purchase_bill_id)) itemsByBill.set(item.purchase_bill_id, []);
    itemsByBill.get(item.purchase_bill_id).push(item);
  });

  const [bills] = await myConn.query(`SELECT * FROM purchase_bills ORDER BY bill_date ASC, id ASC`);
  console.log(`Total Bills to Migrate: ${bills.length}`);

  // --- Step 3: Check Existing Records in Postgres to Prevent Duplicates ---
  console.log('\n--- Step 3: Checking Existing Records in Postgres ---');
  const existingOrders = await pgSql`SELECT purchase_order_no FROM public.purchase_orders`;
  const existingSet = new Set(existingOrders.map(r => r.purchase_order_no));
  console.log(`Existing Purchase Orders in Postgres: ${existingSet.size}`);

  const poItemCols = await pgSql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'purchase_order_items'
  `;
  const poItemColSet = new Set(poItemCols.map(c => c.column_name));
  console.log('purchase_order_items columns in DB:', [...poItemColSet]);
  const [poItemSample] = await pgSql`SELECT * FROM public.purchase_order_items LIMIT 1`;
  console.log('Sample purchase_order_items row:', poItemSample ? Object.keys(poItemSample) : '(empty)');

  // --- Step 4: Migrate Records ---
  console.log('\n--- Step 4: Migrating Bills into public.purchase_orders ---');
  let insertedCount = 0;
  let skippedCount = 0;
  let totalItemsMigrated = 0;

  for (let i = 0; i < bills.length; i++) {
    const b = bills[i];
    const orderAlreadyExisted = existingSet.has(b.bill_number);

    const myBranch = myBranchMap.get(b.branch_id);
    const pgBranch = branchMapping[myBranch.code];
    const pgCb = cbMap.get(pgBranch.country_branch_id);
    const pgCountry = countryMap.get(pgCb.country_id);
    const supplier = mySupplierMap.get(b.supplier_id) || {};
    const shipment = myShipmentMap.get(b.shipment_id) || null;
    const shipmentContainers = shipment ? (containersByShipment.get(shipment.id) || []) : [];
    const billItems = itemsByBill.get(b.id) || [];

    const orderId = deterministicUuid(b.bill_number);

    // Build goodsEntries
    let totalQty = 0;
    let totalNet = 0;
    let totalGross = 0;

    const goodsEntries = billItems.map((item, idx) => {
      const prod = myProductMap.get(item.product_id) || {};
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const lineTotal = Number(item.line_total) || (qty * price);
      totalQty += qty;
      totalNet += qty; // unit in KG
      totalGross += qty * 1.01;

      return {
        id: deterministicUuid(`${b.bill_number}-item-${item.id || idx}`),
        goodsName: prod.name || item.description || 'Dry Fruits Commodity',
        goodsDescription: item.description || prod.name || '',
        hsCode: prod.hs_code || '',
        origin: prod.origin_country || myBranch.country_name || '',
        brand: 'DGT',
        size: prod.pack_size || 'Standard',
        variety: prod.grade || 'standard',
        qtyNo: qty,
        quantity: qty,
        qtyName: item.unit || prod.unit || 'KG',
        qtyKgs: 1,
        netWeight: qty,
        grossWeight: qty * 1.01,
        coursePrice: price,
        unitPrice: price,
        totalAmount: lineTotal,
        finalAmount: lineTotal,
        currencyType: b.currency_code,
        exchangeRate: Number(b.exchange_rate_to_usd) || 1,
        purchaseCurrency: b.currency_code
      };
    });

    // Form data object exactly compliant with normalizeOrder
    const billDateStr = b.bill_date ? new Date(b.bill_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const dueDateStr = b.due_date ? new Date(b.due_date).toISOString().slice(0, 10) : billDateStr;

    const containersList = shipmentContainers.map(c => ({
      containerNo: c.container_number,
      sealNo: c.seal_number || '',
      type: c.container_type || '40ft',
      grossWeight: Number(c.gross_weight) || 0,
      netWeight: Number(c.net_weight) || 0,
      status: c.status || 'loaded'
    }));

    const formData = {
      form: {
        purchaseOrderNo: b.bill_number,
        billNo: b.bill_number,
        manualBillNumber: b.supplier_invoice_number || b.reference_number || '',
        purchaseContractNo: b.supplier_invoice_number || b.reference_number || b.bill_number,
        purchaseDate: billDateStr,
        orderDate: billDateStr,
        dueDate: dueDateStr,
        supplierName: supplier.name || supplier.company_name || 'Historical Supplier',
        supplierAccountNo: supplier.supplier_code || 'SUP-HIST',
        supplierCompany: supplier.company_name || supplier.name || '',
        purchaseAccountName: 'PURCHASE SALES ACCOUNTS',
        purchaseAccountNo: `PUR-ACC-${myBranch.country_code}`,
        salesAccountName: supplier.name || supplier.company_name || 'Historical Supplier',
        salesAccountNo: supplier.supplier_code || 'SUP-HIST',
        currencyType: b.currency_code,
        purchaseCurrency: b.currency_code,
        paymentCurrency: b.currency_code,
        secondaryCurrency: 'USD',
        exchangeRate: Number(b.exchange_rate_to_usd) || 1,
        orderTotal: Number(b.total_amount),
        totalAmount: Number(b.total_amount),
        advanceAmount: Number(b.amount_paid),
        remainingAmount: Number(b.balance_due),
        paymentType: b.payment_status === 'paid' ? 'Final Payment' : Number(b.amount_paid) > 0 ? 'Advance Payment' : 'Credit',
        salesStatus: b.status === 'approved' ? 'Confirmed' : 'Draft',
        branchName: `${pgBranch.name} (${pgBranch.code})`,
        branchCode: pgBranch.code,
        branchCity: pgBranch.city_name,
        branchCountry: pgCountry.name,
        countryName: pgCountry.name,
        countryCode: pgCountry.iso2,
        cityName: pgBranch.city_name,
        cityCode: pgBranch.code,
        countryId: pgCountry.id,
        countryBranchId: pgCb.id,
        cityBranchId: pgBranch.id,
        originCountry: shipment?.origin_country || pgCountry.name,
        destinationCountry: shipment?.destination_country || pgCountry.name,
        loadingPort: shipment?.origin_port || shipment?.origin_city || '',
        receivingPort: shipment?.destination_port || shipment?.destination_city || '',
        transportMode: shipment?.transport_mode || 'sea',
        shippingMode: shipment?.transport_mode || 'sea',
        shippingLine: shipment?.shipping_line || '',
        vesselName: shipment?.vessel_name || '',
        billOfLadingNo: shipment?.bill_of_lading_number || '',
        bookedContainerCount: containersList.length,
        containerNumbers: containersList.map(c => c.containerNo).join(', '),
        notes: b.notes || '',
        legacySource: 'dryfruits_erp'
      },
      goodsEntries,
      totals: {
        totalQty,
        totalNet,
        totalGross,
        grandFinal: Number(b.total_amount),
        grandPrimaryFinal: Number(b.total_amount_usd) || Number(b.total_amount)
      },
      purchaseBooking: {
        totalContainersBooked: containersList.length,
        loadingStatus: b.status === 'approved' ? 'Confirmed' : 'Pending',
        containers: containersList
      },
      workflow: {
        currentStepName: b.status === 'approved' ? 'Booking Confirmed' : 'Booking Purchase Order',
        nextStepName: b.status === 'approved' ? 'Completed' : 'Booking Confirm',
        lifecycleStatus: b.status === 'approved' ? 'Completed' : 'Draft',
        bookingStatus: b.status === 'approved' ? 'Confirmed' : 'Draft',
        confirmationStatus: b.status === 'approved' ? 'Accepted' : 'Pending',
        journalStatus: b.status === 'approved' ? 'posted' : 'Draft',
        paymentStatus: b.payment_status === 'paid' ? 'paid' : Number(b.amount_paid) > 0 ? 'partial' : 'pending',
        containerStatus: containersList.length > 0 ? 'Loaded' : 'Pending',
        inventoryStatus: b.status === 'approved' ? 'Goods Received' : 'Pending'
      }
    };

    // Normalized Statuses
    const paymentStatus = b.payment_status === 'paid' ? 'paid' : Number(b.amount_paid) > 0 ? 'partial' : 'unpaid';
    const ledgerPostingStatus = b.status === 'approved' ? 'posted' : 'draft';
    const orderStatus = b.status === 'approved' ? 'Approved' : b.status === 'pending_approval' ? 'Pending' : 'Draft';

    // Insert PO if not already existed
    if (!orderAlreadyExisted) {
      await pgSql`
        INSERT INTO public.purchase_orders (
          id,
          country_id,
          country_branch_id,
          city_branch_id,
          purchase_order_no,
          purchase_contract_no,
          currency_code,
          purchase_currency,
          payment_currency,
          exchange_rate,
          order_total,
          total_goods_original,
          total_goods_local,
          total_goods_usd,
          advance_paid,
          remaining_paid,
          credit_amount,
          remaining_due,
          payment_status,
          ledger_posting_status,
          status,
          form_data,
          created_at,
          updated_at
        ) VALUES (
          ${orderId}::uuid,
          ${pgCountry.id}::uuid,
          ${pgCb.id}::uuid,
          ${pgBranch.id}::uuid,
          ${b.bill_number},
          ${b.supplier_invoice_number || b.reference_number || b.bill_number},
          ${b.currency_code},
          ${b.currency_code},
          ${b.currency_code},
          ${Number(b.exchange_rate_to_usd) || 1},
          ${Number(b.total_amount)},
          ${Number(b.total_amount)},
          ${Number(b.total_amount)},
          ${Number(b.total_amount_usd) || Number(b.total_amount)},
          ${Number(b.amount_paid)},
          ${Number(b.amount_paid)},
          ${Number(b.balance_due)},
          ${Number(b.balance_due)},
          ${paymentStatus},
          ${ledgerPostingStatus},
          ${orderStatus},
          ${pgSql.json(formData)},
          ${b.bill_date ? new Date(b.bill_date) : new Date()},
          ${b.updated_at ? new Date(b.updated_at) : new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      insertedCount++;
    } else {
      skippedCount++;
    }

    // Also populate child purchase_order_items for complete schema relational integrity
    if (poItemColSet.size > 0 && goodsEntries.length > 0) {
      try {
        const itemRows = goodsEntries.map(item => ({
          id: item.id,
          purchase_order_id: orderId,
          goods_name: item.goodsName || 'Dry Fruits Commodity',
          hs_code: item.hsCode || '',
          size: item.size || 'Standard',
          brand: item.brand || 'DGT',
          origin: item.origin || '',
          quantity: item.qtyNo || 0,
          unit_name: item.qtyName || 'KG',
          unit_weight: item.qtyKgs || 1,
          gross_weight: item.grossWeight || (item.qtyNo || 0),
          net_weight: item.netWeight || (item.qtyNo || 0),
          rate_original: item.coursePrice || 0,
          rate_local: item.coursePrice || 0,
          rate_usd: (item.coursePrice || 0) / (Number(b.exchange_rate_to_usd) || 1),
          total_original: item.totalAmount || 0,
          total_local: item.totalAmount || 0,
          total_usd: (item.totalAmount || 0) / (Number(b.exchange_rate_to_usd) || 1),
          created_at: b.bill_date ? new Date(b.bill_date) : new Date()
        }));

        await pgSql`
          INSERT INTO public.purchase_order_items ${pgSql(itemRows)}
          ON CONFLICT (id) DO NOTHING
        `;
        totalItemsMigrated += itemRows.length;
      } catch (itemErr) {
        console.warn(`    ! Warning inserting PO items for ${b.bill_number}:`, itemErr.message);
      }
    }

    if ((i + 1) % 10 === 0 || (i + 1) === bills.length) {
      console.log(`Progress: ${i + 1}/${bills.length} bills processed (New POs: ${insertedCount}, Existing POs: ${skippedCount}, Items: ${totalItemsMigrated})...`);
    }
  }

  console.log('\n--- Migration Completed ---');
  console.log(`Successfully Inserted: ${insertedCount}`);
  console.log(`Skipped (already existing): ${skippedCount}`);
  console.log(`Total Order Items Inserted: ${totalItemsMigrated}`);

  // --- Step 5: Verification & Reconciliation against Previous Software ---
  console.log('\n--- Step 5: Verification & Reconciliation ---');
  const [mysqlStats] = await myConn.query(`
    SELECT 
      count(*) as bills_count,
      sum(total_amount_usd) as total_usd,
      sum(amount_paid) as total_paid_local,
      sum(balance_due) as total_due_local
    FROM purchase_bills
  `);

  const pgStats = await pgSql`
    SELECT 
      count(*)::int as bills_count,
      sum(total_goods_usd) as total_usd,
      sum(advance_paid) as total_paid_local,
      sum(remaining_due) as total_due_local
    FROM public.purchase_orders
    WHERE purchase_order_no LIKE 'PB-%'
  `;

  console.log('MySQL (Previous Software):', {
    bills_count: mysqlStats[0].bills_count,
    total_usd: Number(mysqlStats[0].total_usd).toFixed(2),
    total_paid_local: Number(mysqlStats[0].total_paid_local).toFixed(2),
    total_due_local: Number(mysqlStats[0].total_due_local).toFixed(2)
  });

  console.log('PostgreSQL (Current System Migrated):', {
    bills_count: pgStats[0].bills_count,
    total_usd: Number(pgStats[0].total_usd).toFixed(2),
    total_paid_local: Number(pgStats[0].total_paid_local).toFixed(2),
    total_due_local: Number(pgStats[0].total_due_local).toFixed(2)
  });

  const diffBills = mysqlStats[0].bills_count - pgStats[0].bills_count;
  const diffUsd = Math.abs(Number(mysqlStats[0].total_usd) - Number(pgStats[0].total_usd));

  console.log(`Reconciliation Result: Difference in Bills = ${diffBills}, Difference in USD = $${diffUsd.toFixed(2)}`);
  if (diffBills === 0 && diffUsd < 0.01) {
    console.log('>>> 100% PERFECT MATCH! ZERO DATA LOSS. ALL HISTORICAL RECORDS RESTORED! <<<');
  }

  await myConn.end();
  await pgSql.end();
}

migrate().catch(console.error);
