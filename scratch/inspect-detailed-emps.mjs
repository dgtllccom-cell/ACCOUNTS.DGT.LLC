import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const emps = await sql`
      SELECT 
        e.id as emp_id,
        e.employee_code,
        e.category,
        e.designation,
        e.department,
        e.joining_date,
        e.net_salary,
        e.salary_currency,
        e.status,
        e.country_id,
        e.country_branch_id,
        e.city_branch_id,
        c.id as cust_id,
        c.customer_name,
        c.contact_person,
        c.mobile,
        c.email,
        c.notes,
        c.deleted_at as cust_deleted,
        c.is_active as cust_active,
        cnt.name as country_name,
        cb.name as branch_name
      FROM public.employees e
      LEFT JOIN public.customers c ON e.person_master_id = c.id
      LEFT JOIN public.countries cnt ON e.country_id = cnt.id
      LEFT JOIN public.country_branches cb ON e.country_branch_id = cb.id
      ORDER BY e.employee_code ASC;
    `;
    console.log(`Found ${emps.length} employees:`);
    for (const emp of emps) {
      console.log(JSON.stringify(emp, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
