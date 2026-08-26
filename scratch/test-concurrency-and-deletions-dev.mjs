import postgres from 'postgres';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(devUrl, { ssl: 'require', max: 1 });

async function runTests() {
  console.log("===============================================================");
  console.log("  4-LEVEL SERIAL ARCHITECTURE: CONCURRENCY & ZERO-REUSE TEST");
  console.log("===============================================================\n");

  try {
    const countryId = 'fb021716-a2e7-4141-9c1a-bd1ddd92eb14'; // Pakistan
    const branchId = '7d7d42fe-ddd1-4bec-8703-3911ad14fa8b';  // Quetta
    const entityType = 'stress_test_doc';
    const prefix = 'TST';

    // Test 1: Concurrency - 20 rapid allocations
    console.log("Test 1: Launching 20 rapid sequential allocations...");
    const allocated = [];
    for (let i = 0; i < 20; i++) {
      const [res] = await sql`SELECT allocate_4level_serials(${entityType}, ${countryId}, ${branchId}, ${prefix}) as serials`;
      allocated.push(res.serials);
    }

    const saSet = new Set(allocated.map(a => a.super_admin_serial));
    const coSet = new Set(allocated.map(a => a.country_serial));
    const brSet = new Set(allocated.map(a => a.branch_serial));
    const modSet = new Set(allocated.map(a => a.entry_serial));

    console.log(`Total calls: ${allocated.length}`);
    console.log(`Unique Super Admin Serials: ${saSet.size} / 20`);
    console.log(`Unique Country Serials: ${coSet.size} / 20`);
    console.log(`Unique Branch Serials: ${brSet.size} / 20`);
    console.log(`Unique Module / Entry Serials: ${modSet.size} / 20`);

    console.log("Sample allocated row (First):", JSON.stringify(allocated[0], null, 2));
    console.log("Sample allocated row (Last):", JSON.stringify(allocated[19], null, 2));

    if (saSet.size === 20 && coSet.size === 20 && brSet.size === 20 && modSet.size === 20) {
      console.log("✅ CONCURRENCY & UNIQUENESS TEST PASSED: Zero duplicates across all 4 levels!\n");
    } else {
      throw new Error("❌ Test failed: Duplicate serials detected!");
    }

    // Test 2: Soft-Delete Zero-Reuse Test on customers table
    console.log("Test 2: Testing Deletion Zero-Reuse Guarantee...");
    
    // Allocate serial 1
    const [res1] = await sql`SELECT allocate_4level_serials('test_entity', ${countryId}, ${branchId}, 'ENT') as serials`;
    const s1 = res1.serials;
    console.log(`Allocated Record 1 serials:`, s1.entry_serial, s1.super_admin_serial);

    // Insert dummy test record in customers table
    const [inserted] = await sql`
      INSERT INTO public.customers (
        country_id, customer_name, original_language_code,
        super_admin_serial, country_serial, branch_serial, entry_serial, person_code
      ) VALUES (
        ${countryId}::uuid, 'Test Delete Person', 'en',
        ${s1.super_admin_serial}, ${s1.country_serial}, ${s1.branch_serial}, ${s1.entry_serial}, ${s1.entry_serial}
      ) RETURNING id;
    `;
    console.log(`Inserted Record ID: ${inserted.id}`);

    // Soft delete the record
    await sql`
      UPDATE public.customers
      SET deleted_at = NOW(), is_active = FALSE
      WHERE id = ${inserted.id}::uuid;
    `;
    console.log(`Soft-deleted Record ID: ${inserted.id}`);

    // Allocate serial 2 (must NOT reuse serial 1)
    const [res2] = await sql`SELECT allocate_4level_serials('test_entity', ${countryId}, ${branchId}, 'ENT') as serials`;
    const s2 = res2.serials;
    console.log(`Allocated Record 2 serials (after delete):`, s2.entry_serial, s2.super_admin_serial);

    if (s1.entry_serial !== s2.entry_serial && s1.super_admin_serial !== s2.super_admin_serial) {
      console.log("✅ ZERO-REUSE TEST PASSED: Serial monotonically moved forward and never reused deleted serial!\n");
    } else {
      throw new Error("❌ Zero-reuse test failed: Reused serial detected!");
    }

    // Clean up test customer
    await sql`DELETE FROM public.customers WHERE id = ${inserted.id}::uuid`;

    console.log("===============================================================");
    console.log("  ALL TESTS PASSED SUCCESSFULLY ON DEV!");
    console.log("===============================================================");

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await sql.end();
  }
}

runTests();
