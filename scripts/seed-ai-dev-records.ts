import { withLocalPg } from "../lib/db/local-postgres";

async function seedDevRecords() {
  await withLocalPg(async (sql) => {
    console.log("Seeding DEV TEST ONLY records for AI Assistant verification...");

    // 1. Get Pakistan country ID
    const [pak] = await sql`SELECT id FROM countries WHERE iso2 = 'PK' OR name ILIKE '%Pakistan%' LIMIT 1;`;
    // 2. Get UAE country ID
    const [uae] = await sql`SELECT id FROM countries WHERE iso2 = 'AE' OR name ILIKE '%United Arab Emirates%' LIMIT 1;`;

    const pakCountryId = pak?.id;
    const uaeCountryId = uae?.id;

    console.log("Countries: Pakistan =", pakCountryId, "UAE =", uaeCountryId);

    // 3. Seed DEV TEST ONLY Customer (Pakistan)
    const existingCust = await sql`
      SELECT id FROM customers WHERE customer_name = 'DEV TEST ONLY Al-Farooq Traders' LIMIT 1;
    `;
    let custId = existingCust[0]?.id;
    if (!custId && pakCountryId) {
      const [inserted] = await sql`
        INSERT INTO customers (
          country_id,
          customer_name,
          company_name,
          contact_person,
          mobile,
          whatsapp,
          email,
          address,
          notes,
          is_active
        ) VALUES (
          ${pakCountryId},
          'DEV TEST ONLY Al-Farooq Traders',
          'Al-Farooq Logistics Quetta',
          'Tariq Farooq',
          '+923001234567',
          '+923001234567',
          'farooq@devtest.local',
          'Quetta Commercial Zone, Block B',
          'DEV TEST ONLY record for AI Assistant verification',
          true
        ) RETURNING id;
      `;
      custId = inserted.id;
      console.log("Created DEV TEST ONLY customer:", custId);
    } else {
      console.log("DEV TEST ONLY customer already exists:", custId);
    }

    // 4. Seed DEV TEST ONLY Account
    const [comp] = await sql`SELECT id FROM companies LIMIT 1;`;
    const existingAcc = await sql`
      SELECT id FROM accounts WHERE code = '1010-DEV-TEST' LIMIT 1;
    `;
    let accId = existingAcc[0]?.id;
    if (!accId && comp?.id) {
      const [inserted] = await sql`
        INSERT INTO accounts (
          company_id,
          code,
          name,
          kind,
          currency,
          status,
          is_active
        ) VALUES (
          ${comp.id},
          '1010-DEV-TEST',
          'DEV TEST ONLY Cash Vault Quetta',
          'asset',
          'PKR',
          'active',
          true
        ) RETURNING id;
      `;
      accId = inserted.id;
      console.log("Created DEV TEST ONLY account:", accId);
    } else {
      console.log("DEV TEST ONLY account already exists:", accId);
    }

    // 5. Seed DEV TEST ONLY Task
    const [adminUser] = await sql`SELECT id FROM auth.users LIMIT 1;`;
    const existingTask = await sql`
      SELECT id FROM user_tasks WHERE task_no = 'TASK-DEV-TEST-01' LIMIT 1;
    `;
    if (!existingTask[0]?.id && adminUser?.id) {
      const [inserted] = await sql`
        INSERT INTO user_tasks (
          created_by,
          assigned_to,
          task_no,
          title,
          description,
          instructions,
          remarks,
          department
        ) VALUES (
          ${adminUser.id},
          ${adminUser.id},
          'TASK-DEV-TEST-01',
          'DEV TEST ONLY Verify Border Clearance at Chaman',
          'Verify transit docs for consignment C-8891 at Chaman border gate',
          'Contact clearing officer and verify stamp on BL-DEV-TEST-999',
          'High priority DEV verification task',
          'Logistics & Clearing'
        ) RETURNING id;
      `;
      console.log("Created DEV TEST ONLY task:", inserted.id);
    } else {
      console.log("DEV TEST ONLY task already exists");
    }

    // 6. Seed DEV TEST ONLY Shipping BL Record
    const existingBL = await sql`
      SELECT id FROM shipping_bl_records WHERE bl_number = 'BL-DEV-TEST-999' LIMIT 1;
    `;
    if (!existingBL[0]?.id && pakCountryId) {
      const [inserted] = await sql`
        INSERT INTO shipping_bl_records (
          country_id,
          shipping_line_name,
          bl_number,
          container_number,
          vessel_name,
          voyage_number
        ) VALUES (
          ${pakCountryId},
          'DEV TEST Maersk Logistics',
          'BL-DEV-TEST-999',
          'MSKU-998877-0',
          'MV DGT EXPLORER',
          'VOY-2026-X'
        ) RETURNING id;
      `;
      console.log("Created DEV TEST ONLY BL record:", inserted.id);
    } else {
      console.log("DEV TEST ONLY BL record already exists");
    }

    // 7. Seed DEV TEST ONLY Customer Order
    const existingCO = await sql`
      SELECT id FROM clearing_customer_orders WHERE order_no = 'CO-DEV-TEST-001' LIMIT 1;
    `;
    if (!existingCO[0]?.id) {
      const [inserted] = await sql`
        INSERT INTO clearing_customer_orders (
          order_no,
          customer_name,
          route_name,
          shipment_type,
          transport_mode,
          movement_type,
          loading_country_name,
          receiving_country_name
        ) VALUES (
          'CO-DEV-TEST-001',
          'DEV TEST ONLY Al-Farooq Traders',
          'Karachi to Quetta Transit',
          'commercial',
          'road',
          'transit',
          'Pakistan',
          'Afghanistan'
        ) RETURNING id;
      `;
      console.log("Created DEV TEST ONLY Customer Order:", inserted.id);
    } else {
      console.log("DEV TEST ONLY Customer Order already exists");
    }

    console.log("Seeding DEV TEST records completed successfully!");
  });
}

seedDevRecords().catch(console.error);
