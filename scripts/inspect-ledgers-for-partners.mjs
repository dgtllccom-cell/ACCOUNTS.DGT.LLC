import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
const sql = postgres(dbUrl);

async function run() {
  const accounts = await sql`
    SELECT id, code, name, currency, scope, is_active 
    FROM public.ledgers 
    WHERE deleted_at IS NULL 
    LIMIT 20
  `;
  console.log('--- Sample Ledgers in DEV DB ---');
  console.table(accounts);

  const vendorAccounts = await sql`
    SELECT l.id, l.code, l.name, l.currency, l.scope, l.is_active, ea.category
    FROM public.ledgers l
    LEFT JOIN public.enterprise_accounts ea ON ea.id = l.enterprise_account_id
    WHERE l.deleted_at IS NULL 
      AND (
        lower(l.name) LIKE '%agent%' 
        OR lower(l.name) LIKE '%trans%' 
        OR lower(l.name) LIKE '%vendor%'
        OR lower(l.name) LIKE '%payable%'
        OR lower(l.name) LIKE '%shipping%'
        OR lower(l.name) LIKE '%customs%'
        OR lower(ea.category) LIKE '%vendor%'
        OR lower(ea.category) LIKE '%payable%'
        OR lower(ea.category) LIKE '%agent%'
      )
    LIMIT 20
  `;
  console.log('--- Vendor / Agent / Payable Ledgers ---');
  console.table(vendorAccounts);

  const bankCashAccounts = await sql`
    SELECT l.id, l.code, l.name, l.currency, l.scope, l.is_active
    FROM public.ledgers l
    WHERE l.deleted_at IS NULL
      AND (
        lower(l.name) LIKE '%bank%'
        OR lower(l.name) LIKE '%cash%'
      )
    LIMIT 10
  `;
  console.log('--- Bank / Cash Ledgers ---');
  console.table(bankCashAccounts);

  await sql.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
