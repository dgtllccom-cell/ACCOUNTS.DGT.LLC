import fs from 'node:fs';
import postgres from 'postgres';

function parseEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^"|"$/g, '');
  }
  return env;
}

const env = { ...parseEnv('.env'), ...parseEnv('.env.local') };
const sql = postgres(env.DATABASE_URL, { max: 1 });

async function check() {
  const orders = await sql`
    SELECT id, order_no FROM public.clearing_customer_orders WHERE deleted_at IS NULL LIMIT 5
  `;
  const orderIds = orders.map(o => o.id);
  console.log('Sample order IDs:', orderIds);

  const handovers = await sql`
    SELECT distinct on (t.source_id)
      t.id, t.transfer_no, t.transfer_type, t.status, t.source_id,
      t.sender_user_id, t.receiver_user_id,
      t.source_country_id, t.dest_country_id,
      t.source_country_branch_id, t.dest_country_branch_id,
      t.source_city_branch_id, t.dest_city_branch_id,
      t.return_reason, t.narration as instructions, t.remarks, t.metadata,
      t.created_at, t.accepted_at, t.completed_at,
      sp.full_name as sender_name,
      rp.full_name as receiver_name,
      scb.name as source_branch_name,
      dcb.name as dest_branch_name
    FROM public.inter_country_transfers t
    LEFT JOIN public.profiles sp ON sp.id = t.sender_user_id
    LEFT JOIN public.profiles rp ON rp.id = t.receiver_user_id
    LEFT JOIN public.country_branches scb ON scb.id = t.source_country_branch_id
    LEFT JOIN public.country_branches dcb ON dcb.id = t.dest_country_branch_id
    WHERE t.deleted_at IS NULL
      AND t.source_table = 'clearing_customer_orders'
      AND t.source_id = ANY(${orderIds}::uuid[])
    ORDER BY t.source_id, t.created_at DESC
  `;
  console.log('Handovers query succeeded, rows:', handovers.length);
  process.exit(0);
}

check().catch(e => { console.error('Query error:', e); process.exit(1); });
