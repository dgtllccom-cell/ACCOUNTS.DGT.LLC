import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const ledgers = await sql`
    SELECT l.id, l.code, l.name, l.currency, l.current_balance, l.debit_total, l.credit_total,
           c.name as country_name, c.id as country_id, cb.name as branch_name, cb.id as branch_id
    FROM ledgers l
    LEFT JOIN countries c ON c.id = l.country_id
    LEFT JOIN country_branches cb ON cb.id = l.country_branch_id
    WHERE l.deleted_at IS NULL
    ORDER BY c.name, l.name;
  `;
  console.table(ledgers);
  await sql.end();
}

main().catch(console.error);
