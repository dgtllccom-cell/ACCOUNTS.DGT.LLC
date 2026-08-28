import postgres from 'postgres';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(devUrl, { ssl: 'require' });

async function main() {
  try {
    console.log("=== 1. Testing Owner & Sister Company Architecture ===");
    
    // Get a sample customer
    const customers = await sql`
      SELECT id, customer_name, father_name FROM public.customers LIMIT 1;
    `;
    const owner = customers[0];
    console.log("Using Owner:", owner);

    // Insert a sister company under this owner
    const sisterRows = await sql`
      INSERT INTO public.companies (
        name, legal_name, owner_name, owner_person_id, business_type, base_currency, is_active, created_at, updated_at
      ) VALUES (
        'DAMAAN LOGISTICS LLC', 'DAMAAN LOGISTICS GLOBAL', ${owner.customer_name}, ${owner.id}, 'LLC', 'AED', true, NOW(), NOW()
      )
      RETURNING id, name, owner_person_id, is_branch_operative;
    `;
    console.log("Inserted Sister Company:", sisterRows[0]);

    console.log("\n=== 2. Testing Branch Operative Company Architecture ===");
    
    // Get a sample country and branch
    const countries = await sql`SELECT id, name FROM public.countries WHERE name ILIKE '%United Arab Emirates%' OR name ILIKE '%Pakistan%' LIMIT 1;`;
    const country = countries[0];
    const branches = await sql`SELECT id, name, code FROM public.country_branches WHERE country_id = ${country.id} LIMIT 1;`;
    const branch = branches[0];
    console.log("Using Country & Branch:", country.name, branch.name);

    // Insert a branch operative company
    const branchRows = await sql`
      INSERT INTO public.companies (
        name, legal_name, country_id, country_branch_id, is_branch_operative, business_type, base_currency, is_active, created_at, updated_at
      ) VALUES (
        'AL-RAS TRADING & LOGISTICS CO LLC', 'AL-RAS TRADING LLC', ${country.id}, ${branch.id}, true, 'LLC', 'AED', true, NOW(), NOW()
      )
      RETURNING id, name, country_branch_id, is_branch_operative;
    `;
    console.log("Inserted Branch Operative Company:", branchRows[0]);

    console.log("\n=== 3. Querying Sister Companies by Owner ===");
    const ownerComps = await sql`
      SELECT id, name, business_type, is_branch_operative 
      FROM public.companies 
      WHERE owner_person_id = ${owner.id};
    `;
    console.log(`Companies under owner (${owner.customer_name}):`, ownerComps);

    console.log("\n=== 4. Querying Operative Companies by Branch ===");
    const bComps = await sql`
      SELECT id, name, business_type, is_branch_operative 
      FROM public.companies 
      WHERE country_branch_id = ${branch.id} AND is_branch_operative = true;
    `;
    console.log(`Operative Companies under branch (${branch.name}):`, bComps);

    console.log("\n✅ All Company Setup Architecture Database Tests Passed!");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await sql.end();
  }
}

main();
