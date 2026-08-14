import postgres from 'postgres';

const sql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function checkEmp() {
  const emps = await sql`
    SELECT e.id, e.employee_code, e.designation, e.department, e.status,
           c.customer_name as name, c.mobile, c.email, c.national_id_or_passport, c.address
    FROM employees e
    LEFT JOIN customers c ON c.id = e.person_master_id
    LIMIT 5
  `;
  console.log("Sample employees with linked person details:", emps);

  await sql.end();
}

checkEmp().catch(console.error);
