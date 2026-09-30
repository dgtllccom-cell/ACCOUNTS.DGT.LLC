import postgres from 'postgres';

const PROD_URL = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const DEV_URL = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";

async function inspect(label, url) {
  console.log(`\n=================== ${label} ===================`);
  const sql = postgres(url, { max: 1, ssl: 'require' });
  try {
    const rows = await sql`
      SELECT 
        po.id,
        po.purchase_order_no,
        po.order_total,
        po.advance_paid,
        po.remaining_due,
        po.credit_amount,
        po.status,
        po.payment_status,
        po.country_id,
        c.name as country_name,
        po.country_branch_id,
        cb.name as branch_name,
        po.city_branch_id,
        po.created_at,
        po.form_data->'form'->>'paymentType' as form_payment_type,
        po.form_data->'form'->>'paymentCondition' as form_payment_condition,
        po.form_data->'workflow'->>'transferState' as transfer_state,
        po.form_data->'workflow'->>'transferredAt' as transferred_at,
        po.form_data->'workflow'->>'transferredTo' as transferred_to
      FROM purchase_orders po
      LEFT JOIN countries c ON c.id = po.country_id
      LEFT JOIN country_branches cb ON cb.id = po.country_branch_id
      WHERE po.deleted_at IS NULL
      ORDER BY po.created_at DESC
      LIMIT 25
    `;
    console.table(rows);

    // Also check transfers table if any
    const transfers = await sql`
      SELECT id, purchase_order_id, transfer_type, source_stage, destination_stage, status, created_at
      FROM purchase_order_transfers
      ORDER BY created_at DESC
      LIMIT 10
    `.catch(() => []);
    if (transfers.length > 0) {
      console.log("Transfers table entries:");
      console.table(transfers);
    }
  } catch (err) {
    console.error(`Error inspecting ${label}:`, err.message);
  } finally {
    await sql.end();
  }
}

async function run() {
  await inspect("PROD DATABASE (inmayhrxucimxqhgseqi)", PROD_URL);
  await inspect("DEV DATABASE (csesvyxxjivnkkozgopt)", DEV_URL);
}

run();
