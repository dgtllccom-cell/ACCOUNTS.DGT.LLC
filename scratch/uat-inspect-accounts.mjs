import { withLocalPg } from "@/lib/db/local-postgres";

await withLocalPg(async (sql) => {
  const like = (t, cols) => sql.unsafe(
    `SELECT ${cols} FROM public.${t}
     WHERE deleted_at IS NULL AND (${cols.split(',').map(c=>`${c.trim()} ILIKE ANY($1)`).join(' OR ')})
     LIMIT 25`,
    [['%al ras%','%al raz%','%alras%','%damman%','%damaan%','%dalian%','%sunshine%','%walnut%']]
  ).catch(e => [{ERR: e.message}]);

  console.log("\n=== enterprise_accounts (name/code/type/parent) ===");
  console.log(JSON.stringify(await sql`
    SELECT id, account_name, account_code, account_type, account_category, parent_account_id,
           country_id, country_branch_id, city_branch_id, currency, is_active
    FROM public.enterprise_accounts
    WHERE deleted_at IS NULL
      AND (account_name ILIKE ANY(ARRAY['%al ras%','%al raz%','%alras%','%damman%','%damaan%','%dalian%','%sunshine%','%purchase%'])
        OR account_code ILIKE ANY(ARRAY['%alras%','%alraz%','%damman%','%purchase%']))
    ORDER BY account_name LIMIT 40`, null, {}).then(r=>r, e=>[{ERR:e.message}]));

  console.log("\n=== customers (parties) ===");
  console.log(JSON.stringify(await sql`
    SELECT id, customer_name, company_name, customer_type, customer_code, country_id, city_id, email, mobile
    FROM public.customers
    WHERE deleted_at IS NULL
      AND (customer_name ILIKE ANY(ARRAY['%damman%','%damaan%','%dalian%','%sunshine%'])
        OR company_name ILIKE ANY(ARRAY['%damman%','%damaan%','%dalian%','%sunshine%']))
    ORDER BY customer_name LIMIT 20`));

  console.log("\n=== tables containing 'purchase' + 'account' concept ===");
  console.log(JSON.stringify(await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND (table_name ILIKE '%purchase%account%' OR table_name ILIKE '%account%hierarch%' OR table_name ILIKE '%account_group%')
    ORDER BY 1`));
});
