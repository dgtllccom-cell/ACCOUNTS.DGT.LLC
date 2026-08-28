import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    console.log("=== CHECKING PROD DATABASE ===");
    
    // Check customers table columns
    const customerCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'customers'
      ORDER BY ordinal_position;
    `;
    console.log("Prod Customer columns:", customerCols.map(c => c.column_name).join(", "));

    // Check count in customers
    const custCount = await sql`SELECT count(*) FROM public.customers WHERE deleted_at IS NULL`;
    console.log("Total active customers in prod:", custCount[0].count);

    // List customers
    const custs = await sql`SELECT id, customer_name, mobile, email, created_at FROM public.customers WHERE deleted_at IS NULL LIMIT 20`;
    console.log("Prod Customers sample:");
    console.table(custs);

    // Check employees table and person_master_id links
    const emps = await sql`
      SELECT e.id, e.employee_code, e.person_master_id, e.category, e.designation, e.department, e.status, e.created_at,
             c.customer_name, c.deleted_at as cust_deleted
      FROM public.employees e
      LEFT JOIN public.customers c ON e.person_master_id = c.id
      WHERE e.deleted_at IS NULL
      ORDER BY e.employee_code ASC;
    `;
    console.log(`\nProd Employees (${emps.length} total):`);
    console.table(emps.map(e => ({
      code: e.employee_code,
      name: e.customer_name,
      cat: e.category,
      desig: e.designation,
      person_master_id: e.person_master_id,
      cust_deleted: e.cust_deleted
    })));

  } catch (err) {
    console.error("Error inspecting prod DB:", err);
  } finally {
    await sql.end();
  }
}

main();
