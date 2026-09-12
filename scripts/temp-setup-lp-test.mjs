import postgres from "postgres";
const sql = postgres("postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres", { ssl: "require" });

const [company] = await sql`select id, country_id from public.companies where deleted_at is null limit 1`;
const [branch] = await sql`select id, country_id from public.country_branches where deleted_at is null and country_id = ${company.country_id} limit 1`;

const [row] = await sql`
  insert into public.local_purchases (
    company_id, country_id, country_branch_id, goods_name, supplier_name,
    quantity_kgs, total_gross_weight, empty_kgs, net_weight, divide_kgs, numbers,
    purchase_rate, purchase_cost, final_cost, status, created_by
  ) values (
    ${company.id}, ${company.country_id}, ${branch?.id ?? null}, 'Test Goods Before Edit', 'Test Supplier Before',
    100, 100, 0, 100, 50, 2,
    10, 1000, 1000, 'draft', '00000000-0000-4000-8000-000000000001'
  ) returning id, goods_name, supplier_name, status
`;
console.log(JSON.stringify({ companyId: company.id, countryId: company.country_id, branchId: branch?.id, row }));
await sql.end();
