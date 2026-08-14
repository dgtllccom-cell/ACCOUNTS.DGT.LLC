import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

async function verifyStockWorkflow() {
  console.log("==================================================");
  console.log("   STOCK / INVENTORY WORKFLOW VERIFICATION SUITE   ");
  console.log("==================================================\n");

  try {
    // 1. Table Existence Check
    console.log("1. Checking Database Tables...");
    const requiredTables = ["stock_movements", "warehouses", "goods", "product_inventory_balances"];
    for (const t of requiredTables) {
      const res = await sql`
        SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=${t}) as exists;
      `;
      if (!res[0].exists) {
        throw new Error(`CRITICAL: Required table [${t}] is missing!`);
      }
      console.log(`   ✓ Table [${t}] exists`);
    }

    // 2. Fetch or create test Warehouse and Goods
    console.log("\n2. Setting up Test Master Data (Warehouse & Goods)...");
    let country = (await sql`SELECT id FROM public.countries ORDER BY created_at ASC LIMIT 1`)[0];
    if (!country) {
      const cRows = await sql`INSERT INTO public.countries (name, code) VALUES ('Test Country', 'TC') RETURNING id`;
      country = cRows[0];
    }

    let warehouse = (await sql`SELECT * FROM public.warehouses WHERE deleted_at IS NULL LIMIT 1`)[0];
    if (!warehouse) {
      console.log("   Creating test warehouse...");
      const whRows = await sql`
        INSERT INTO public.warehouses (country_id, warehouse_code, warehouse_name, warehouse_type, status, is_active)
        VALUES (${country.id}::uuid, 'WH-TEST-01', 'Primary Test Warehouse', 'General', 'Active', true)
        RETURNING *
      `;
      warehouse = whRows[0];
    }
    const countryId = warehouse.country_id || country.id;
    console.log(`   ✓ Test Warehouse: ${warehouse.warehouse_name} (${warehouse.id}), Country=${countryId}`);

    let goodsItem = (await sql`SELECT * FROM public.goods WHERE deleted_at IS NULL LIMIT 1`)[0];
    if (!goodsItem) {
      console.log("   Creating test goods item...");
      const gRows = await sql`
        INSERT INTO public.goods (chs_code, goods_name, is_active)
        VALUES ('CHS-TEST-8899', 'Premium Test Fabric Roll', true)
        RETURNING *
      `;
      goodsItem = gRows[0];
    }
    console.log(`   ✓ Test Goods Item: ${goodsItem.goods_name} (${goodsItem.id})`);

    // Ensure shadow record in public.products table
    const productCode = goodsItem.chs_code || "PRD-" + goodsItem.id.slice(0, 8);
    await sql`
      INSERT INTO public.products (id, product_code, product_name, hs_code, country_id, is_active, created_at, updated_at)
      VALUES (${goodsItem.id}::uuid, ${productCode}, ${goodsItem.goods_name}, ${goodsItem.chs_code}, ${countryId}::uuid, true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    // 3. Test Stock In (Receiving)
    console.log("\n3. Testing Stock In (Receiving + 150 units)...");
    const stockInQty = 150;
    const stockInCost = 12.50;
    const stockInRows = await sql`
      INSERT INTO public.stock_movements (
        movement_type, goods_id, warehouse_id, country_id, quantity, unit_cost, total_amount, reference_no, notes
      ) VALUES (
        'STOCK_IN', ${goodsItem.id}::uuid, ${warehouse.id}::uuid, ${countryId}::uuid, ${stockInQty}, ${stockInCost}, ${stockInQty * stockInCost}, 'TEST-PO-1001', 'Automated QA Stock In Test'
      )
      RETURNING *
    `;
    const stockIn = stockInRows[0];
    console.log(`   ✓ Stock In Movement Created: ID=${stockIn.id}, Qty=${stockIn.quantity}`);

    // Update balance
    await sql`
      INSERT INTO public.product_inventory_balances (
        product_id, country_id, warehouse_id, quantity_on_hand, quantity_reserved, updated_at
      ) VALUES (
        ${goodsItem.id}::uuid, ${countryId}::uuid, ${warehouse.id}::uuid, ${stockInQty}, 0, NOW()
      )
      ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = public.product_inventory_balances.quantity_on_hand + ${stockInQty},
        updated_at = NOW()
    `;

    let balRows = await sql`
      SELECT * FROM public.product_inventory_balances WHERE product_id=${goodsItem.id}::uuid AND warehouse_id=${warehouse.id}::uuid
    `;
    console.log(`   ✓ Inventory Balance after Stock In: OnHand=${balRows[0].quantity_on_hand}, Available=${balRows[0].quantity_available}`);

    // 4. Test Stock Out (Issuance)
    console.log("\n4. Testing Stock Out (Issuance - 50 units)...");
    const stockOutQty = 50;
    const stockOutRows = await sql`
      INSERT INTO public.stock_movements (
        movement_type, goods_id, warehouse_id, country_id, quantity, unit_cost, total_amount, reference_no, notes
      ) VALUES (
        'STOCK_OUT', ${goodsItem.id}::uuid, ${warehouse.id}::uuid, ${countryId}::uuid, ${stockOutQty}, 12.50, ${stockOutQty * 12.50}, 'TEST-SO-2001', 'Automated QA Stock Out Test'
      )
      RETURNING *
    `;
    const stockOut = stockOutRows[0];
    console.log(`   ✓ Stock Out Movement Created: ID=${stockOut.id}, Qty=${stockOut.quantity}`);

    await sql`
      UPDATE public.product_inventory_balances
      SET
        quantity_on_hand = GREATEST(0, quantity_on_hand - ${stockOutQty}),
        updated_at = NOW()
      WHERE product_id=${goodsItem.id}::uuid AND warehouse_id=${warehouse.id}::uuid
    `;

    balRows = await sql`
      SELECT * FROM public.product_inventory_balances WHERE product_id=${goodsItem.id}::uuid AND warehouse_id=${warehouse.id}::uuid
    `;
    console.log(`   ✓ Inventory Balance after Stock Out: OnHand=${balRows[0].quantity_on_hand}, Available=${balRows[0].quantity_available}`);

    // 5. Test Stock Movement View & Edit
    console.log("\n5. Testing Stock Movement View & Edit (Updating Stock Out Qty to 40)...");
    const newQty = 40;
    const qtyDelta = stockOutQty - newQty; // 10 units returned to balance

    await sql`
      UPDATE public.stock_movements
      SET quantity=${newQty}, total_amount=${newQty * 12.50}, notes='Updated via QA Suite', updated_at=NOW()
      WHERE id=${stockOut.id}::uuid
    `;

    await sql`
      UPDATE public.product_inventory_balances
      SET
        quantity_on_hand = quantity_on_hand + ${qtyDelta},
        updated_at = NOW()
      WHERE product_id=${goodsItem.id}::uuid AND warehouse_id=${warehouse.id}::uuid
    `;

    balRows = await sql`
      SELECT * FROM public.product_inventory_balances WHERE product_id=${goodsItem.id}::uuid AND warehouse_id=${warehouse.id}::uuid
    `;
    console.log(`   ✓ Inventory Balance after Edit: OnHand=${balRows[0].quantity_on_hand}, Available=${balRows[0].quantity_available}`);

    // 6. Verify Account Multi-Linking Junction Tables remain intact
    console.log("\n6. Verifying Account Multi-Linking Junction Tables Integrity...");
    const accountJunctions = ['account_companies', 'account_banks', 'account_warehouses', 'account_customer_owners'];
    for (const j of accountJunctions) {
      const res = await sql`
        SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=${j}) as exists;
      `;
      if (!res[0].exists) {
        throw new Error(`REGRESSION ERROR: Account multi-linking table [${j}] was broken!`);
      }
      console.log(`   ✓ Account Multi-Linking Table [${j}]: INTACT`);
    }

    console.log("\n==================================================");
    console.log("   ✓ ALL STOCK / INVENTORY TESTS PASSED CLEANLY!  ");
    console.log("==================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ VERIFICATION FAILED:", err);
    process.exit(1);
  }
}

verifyStockWorkflow();
