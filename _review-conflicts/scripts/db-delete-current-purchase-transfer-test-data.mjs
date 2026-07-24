import fs from "node:fs";
import postgres from "postgres";

const confirmFlag = "--confirm-delete-purchase-transfer-test-data";
const applyChanges = process.argv.includes(confirmFlag);

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, idle_timeout: 5 });

async function tableExists(tx, table) {
  const [row] = await tx`select to_regclass(${`public.${table}`}) as table_name`;
  return Boolean(row?.table_name);
}

async function countTable(table) {
  const [exists] = await sql`select to_regclass(${`public.${table}`}) as table_name`;
  if (!exists?.table_name) return null;
  const [row] = await sql.unsafe(`select count(*)::int as count from public."${table.replaceAll('"', '""')}"`);
  return row.count;
}

async function deleteAuditLogs(tx, entityTables, ids = []) {
  if (!(await tableExists(tx, "audit_logs"))) return 0;
  if (!entityTables.length) return 0;
  let result;
  if (ids.length) {
    result = await tx`
      delete from audit_logs
      where entity_table in ${tx(entityTables)}
         or entity_id in ${tx(ids)}
      returning id
    `;
  } else {
    result = await tx`
      delete from audit_logs
      where entity_table in ${tx(entityTables)}
      returning id
    `;
  }
  return result.length;
}

try {
  const before = {
    purchase_orders: await countTable("purchase_orders"),
    purchase_loading_records: await countTable("purchase_loading_records"),
    purchase_order_payments: await countTable("purchase_order_payments"),
    roznamcha_entries: await countTable("roznamcha_entries"),
    roznamcha_lines: await countTable("roznamcha_lines")
  };

  const preview = await sql`
    select
      id,
      purchase_order_no,
      payment_status,
      ledger_posting_status,
      form_data #>> '{workflow,transferStatus}' as transfer_status,
      form_data #>> '{form,transferAudit,transferDate}' as transfer_date,
      created_at
    from purchase_orders
    order by created_at desc
  `.catch(() => []);

  if (!applyChanges) {
    console.log(JSON.stringify({
      status: "dry_run",
      mode: `No rows deleted. Rerun with ${confirmFlag}`,
      before,
      purchaseOrdersPreview: preview
    }, null, 2));
    process.exit(0);
  }

  const result = await sql.begin(async (tx) => {
    const orderRows = (await tx`
      select id, purchase_order_no
      from purchase_orders
    `.catch(() => []));
    const orderIds = orderRows.map((row) => row.id);
    const orderNos = orderRows.map((row) => row.purchase_order_no).filter(Boolean);

    const paymentRows = (await tx`
      select id, roznamcha_entry_id
      from purchase_order_payments
      where purchase_order_id in ${tx(orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"])}
         or purchase_order_id is null
    `.catch(() => []));
    const paymentIds = paymentRows.map((row) => row.id);
    const paymentRoznamchaIds = paymentRows.map((row) => row.roznamcha_entry_id).filter(Boolean);

    const sourceRoznamchaRows = (await tx`
      select id
      from roznamcha_entries
      where source_module ilike '%purchase%'
         or source_transaction_type ilike '%purchase%'
         or source_transaction_id in ${tx(orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"])}
         or source_reference_no in ${tx(orderNos.length ? orderNos : ["__NO_PURCHASE_ORDER__"])}
         or reference_no in ${tx(orderNos.length ? orderNos : ["__NO_PURCHASE_ORDER__"])}
    `.catch(() => []));

    const roznamchaIds = [...new Set([
      ...paymentRoznamchaIds,
      ...sourceRoznamchaRows.map((row) => row.id)
    ])];

    let deletedRoznamchaLines = 0;
    let deletedRoznamchaEntries = 0;
    let deletedJournalLines = 0;
    let deletedJournalEntries = 0;
    let deletedLoading = 0;
    let deletedPayments = 0;
    let deletedOrders = 0;
    let deletedAudit = 0;

    if (await tableExists(tx, "purchase_loading_records")) {
      const rows = await tx`delete from purchase_loading_records returning id`;
      deletedLoading = rows.length;
    }
    if (await tableExists(tx, "purchase_order_payments")) {
      const rows = await tx`delete from purchase_order_payments returning id`;
      deletedPayments = rows.length;
    }
    if (await tableExists(tx, "purchase_orders")) {
      const rows = await tx`delete from purchase_orders returning id`;
      deletedOrders = rows.length;
    }

    if (await tableExists(tx, "journal_entries")) {
      const journalRows = await tx`
        select id
        from journal_entries
        where source_type ilike '%purchase%'
           or source_id in ${tx([...orderIds, ...paymentIds, ...roznamchaIds].length ? [...orderIds, ...paymentIds, ...roznamchaIds] : ["00000000-0000-0000-0000-000000000000"])}
      `.catch(() => []);
      const journalIds = journalRows.map((row) => row.id);
      if (journalIds.length && await tableExists(tx, "journal_lines")) {
        const rows = await tx`delete from journal_lines where journal_entry_id in ${tx(journalIds)} returning id`;
        deletedJournalLines = rows.length;
      }
      if (journalIds.length && await tableExists(tx, "ledger_entries")) {
        const rows = await tx`delete from ledger_entries where journal_entry_id in ${tx(journalIds)} returning id`;
      }
      if (journalIds.length) {
        const rows = await tx`delete from journal_entries where id in ${tx(journalIds)} returning id`;
        deletedJournalEntries = rows.length;
      }
    }

    if (roznamchaIds.length && await tableExists(tx, "roznamcha_lines")) {
      const rows = await tx`delete from roznamcha_lines where roznamcha_entry_id in ${tx(roznamchaIds)} returning id`;
      deletedRoznamchaLines = rows.length;
    }
    if (roznamchaIds.length && await tableExists(tx, "roznamcha_entries")) {
      const rows = await tx`delete from roznamcha_entries where id in ${tx(roznamchaIds)} returning id`;
      deletedRoznamchaEntries = rows.length;
    }

    deletedAudit = await deleteAuditLogs(
      tx,
      [
        "purchase_orders",
        "purchase_order_payments",
        "purchase_loading_records",
        "purchase_order_items",
        "purchase_order_expenses",
        "purchase_order_reports",
        "roznamcha_entries",
        "roznamcha_lines",
        "journal_entries",
        "journal_lines",
        "ledger_entries"
      ],
      [...orderIds, ...paymentIds, ...roznamchaIds]
    );

    return {
      purchaseOrdersFound: orderRows.length,
      purchaseOrderNos: orderNos,
      deletedOrders,
      deletedPayments,
      deletedLoading,
      deletedRoznamchaEntries,
      deletedRoznamchaLines,
      deletedJournalEntries,
      deletedJournalLines,
      deletedAudit
    };
  });

  const after = {
    purchase_orders: await countTable("purchase_orders"),
    purchase_loading_records: await countTable("purchase_loading_records"),
    purchase_order_payments: await countTable("purchase_order_payments"),
    roznamcha_entries: await countTable("roznamcha_entries"),
    roznamcha_lines: await countTable("roznamcha_lines")
  };

  const preserved = {
    countries: await countTable("countries"),
    country_branches: await countTable("country_branches"),
    city_branches: await countTable("city_branches"),
    profiles: await countTable("profiles"),
    enterprise_accounts: await countTable("enterprise_accounts"),
    ledgers: await countTable("ledgers")
  };

  console.log(JSON.stringify({ status: "success", before, result, after, preserved }, null, 2));
} finally {
  await sql.end();
}
