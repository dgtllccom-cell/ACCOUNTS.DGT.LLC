import fs from "node:fs";
import postgres from "postgres";

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const sql = postgres(url, { ssl: "require", max: 1, idle_timeout: 5 });

try {
  const result = await sql.begin(async (tx) => {
    const corrupt = await tx`
      select
        p.id as payment_id,
        p.purchase_order_id,
        p.kind,
        p.entry_date,
        p.roznamcha_entry_id,
        po.purchase_order_no
      from purchase_order_payments p
      left join roznamcha_entries re on re.id = p.roznamcha_entry_id
      left join purchase_orders po on po.id = p.purchase_order_id
      where p.deleted_at is null
        and p.status = 'posted'
        and (
          p.kind = 'booking'
          or p.roznamcha_entry_id is null
          or re.id is null
          or re.source_module is null
          or re.super_admin_serial_number is null
          or re.country_transaction_serial_number is null
          or re.branch_transaction_serial_number is null
        )
      order by p.created_at;
    `;

    const affectedOrders = new Set();
    let revertedLines = 0;

    for (const p of corrupt) {
      affectedOrders.add(p.purchase_order_id);
      if (p.roznamcha_entry_id) {
        const lines = await tx`
          select ledger_id, enterprise_account_id, debit, credit
          from roznamcha_lines
          where roznamcha_entry_id = ${p.roznamcha_entry_id};
        `;
        for (const line of lines) {
          const debit = Number(line.debit || 0);
          const credit = Number(line.credit || 0);
          if (line.ledger_id) {
            await tx`
              update ledgers
              set debit_total = coalesce(debit_total, 0) - ${debit},
                  credit_total = coalesce(credit_total, 0) - ${credit},
                  current_balance = coalesce(current_balance, 0) - ${debit} + ${credit},
                  updated_at = now()
              where id = ${line.ledger_id};
            `;
            await tx`
              update ledger_balances
              set debit_total = coalesce(debit_total, 0) - ${debit},
                  credit_total = coalesce(credit_total, 0) - ${credit},
                  closing_balance = coalesce(closing_balance, 0) - ${debit} + ${credit},
                  updated_at = now()
              where ledger_id = ${line.ledger_id}
                and balance_date = ${p.entry_date};
            `;
          }
          if (line.enterprise_account_id) {
            await tx`
              update enterprise_accounts
              set current_balance = coalesce(current_balance, 0) - ${debit} + ${credit},
                  updated_at = now()
              where id = ${line.enterprise_account_id};
            `;
          }
          revertedLines += 1;
        }

        await tx`delete from purchase_order_payments where id = ${p.payment_id};`;
        await tx`delete from roznamcha_lines where roznamcha_entry_id = ${p.roznamcha_entry_id};`;
        await tx`delete from roznamcha_entries where id = ${p.roznamcha_entry_id};`;
      } else {
        await tx`delete from purchase_order_payments where id = ${p.payment_id};`;
      }
    }

    for (const orderId of affectedOrders) {
      await tx`select recalc_purchase_order_payment_totals(${orderId}::uuid);`;
      await tx`
        update purchase_orders
        set ledger_posting_status = case
              when (form_data #> '{form,transferAudit}') is not null then 'draft'::document_status
              else ledger_posting_status
            end,
            payment_status = case
              when coalesce(advance_paid, 0) + coalesce(remaining_paid, 0) + coalesce(credit_amount, 0) <= 0 then 'pending'::purchase_order_status
              else payment_status
            end,
            remaining_due = case
              when coalesce(advance_paid, 0) + coalesce(remaining_paid, 0) + coalesce(credit_amount, 0) <= 0 then coalesce(order_total, 0)
              else greatest(coalesce(remaining_due, 0), 0)
            end,
            updated_at = now()
        where id = ${orderId};
      `;
    }

    return { corruptPaymentsDeleted: corrupt.length, revertedLines, affectedOrders: [...affectedOrders] };
  });

  const verify = await sql`
    select
      count(*)::int as remaining_corrupt_posted_payments
    from purchase_order_payments p
    left join roznamcha_entries re on re.id = p.roznamcha_entry_id
    where p.deleted_at is null
      and p.status = 'posted'
      and (
        p.kind = 'booking'
        or p.roznamcha_entry_id is null
        or re.id is null
        or re.source_module is null
        or re.super_admin_serial_number is null
        or re.country_transaction_serial_number is null
        or re.branch_transaction_serial_number is null
      );
  `;

  console.log(JSON.stringify({ ...result, verify: verify[0] }, null, 2));
} finally {
  await sql.end();
}



