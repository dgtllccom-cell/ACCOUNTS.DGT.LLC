import postgres from "postgres";

async function ensureTablesAndReloadSchema() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  try {
    const sql = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 10 });

    await sql.unsafe(`
      alter table if exists purchase_orders
        add column if not exists purchase_currency text not null default 'USD',
        add column if not exists payment_currency text not null default 'USD',
        add column if not exists total_goods_original numeric(18,4) not null default 0,
        add column if not exists total_goods_local numeric(18,4) not null default 0,
        add column if not exists total_goods_usd numeric(18,4) not null default 0,
        add column if not exists total_expenses_original numeric(18,4) not null default 0,
        add column if not exists total_expenses_local numeric(18,4) not null default 0,
        add column if not exists total_expenses_usd numeric(18,4) not null default 0,
        add column if not exists landed_cost_original numeric(18,4) not null default 0,
        add column if not exists landed_cost_local numeric(18,4) not null default 0,
        add column if not exists landed_cost_usd numeric(18,4) not null default 0,
        add column if not exists super_admin_serial_number text,
        add column if not exists country_transaction_serial_number text,
        add column if not exists branch_transaction_serial_number text;

      create table if not exists purchase_order_items (
        id uuid primary key default gen_random_uuid(),
        purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
        product_id uuid references products(id),
        goods_name text not null,
        hs_code text,
        size text,
        brand text,
        origin text,
        quantity numeric(18,4) not null default 0,
        unit_name text not null,
        unit_weight numeric(18,4) not null default 0,
        gross_weight numeric(18,4) not null default 0,
        net_weight numeric(18,4) not null default 0,
        rate_original numeric(18,4) not null default 0,
        rate_local numeric(18,4) not null default 0,
        rate_usd numeric(18,4) not null default 0,
        total_original numeric(18,4) not null default 0,
        total_local numeric(18,4) not null default 0,
        total_usd numeric(18,4) not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists purchase_order_items_po_idx on purchase_order_items(purchase_order_id);
      alter table purchase_order_items enable row level security;

      create table if not exists purchase_order_expenses (
        id uuid primary key default gen_random_uuid(),
        purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
        expense_type text not null,
        ledger_id uuid references ledgers(id),
        description text,
        expense_currency text not null default 'USD',
        exchange_rate numeric(18,8) not null default 1,
        amount_original numeric(18,4) not null default 0,
        amount_local numeric(18,4) not null default 0,
        amount_usd numeric(18,4) not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists purchase_order_expenses_po_idx on purchase_order_expenses(purchase_order_id);
      alter table purchase_order_expenses enable row level security;
    `);

    try {
      await sql.unsafe(`ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'transferred'`);
    } catch (e) {}
    try {
      await sql.unsafe(`ALTER TABLE purchase_orders ALTER COLUMN ledger_posting_status TYPE text`);
    } catch (e) {}
    try {
      await sql.unsafe(`ALTER TABLE purchase_orders ALTER COLUMN payment_status TYPE text`);
    } catch (e) {}
    try {
      await sql.unsafe(`ALTER TABLE purchase_order_payments ALTER COLUMN ledger_posting_status TYPE text`);
    } catch (e) {}

    try {
      await sql.unsafe(`create policy purchase_order_items_all on purchase_order_items for all using (true) with check (true);`);
    } catch (e) {}
    try {
      await sql.unsafe(`create policy purchase_order_expenses_all on purchase_order_expenses for all using (true) with check (true);`);
    } catch (e) {}

    await sql.unsafe(`NOTIFY pgrst, 'reload schema'`);

    return sql;
  } catch (err) {
    console.error("Error ensuring tables and schema:", err);
    return null;
  }
}

export async function ensurePurchaseSchemaAndEnums() {
  const sql = await ensureTablesAndReloadSchema();
  if (sql) await sql.end();
}

export async function safeInsertPurchaseOrderItems(supabase: any, itemsPayload: any[]) {
  if (!itemsPayload || itemsPayload.length === 0) return;

  const res = await supabase.from("purchase_order_items").insert(itemsPayload);
  if (!res.error) return;

  // If error is schema cache or table not found, fallback via postgres
  const errMsg = String(res.error.message || res.error);
  if (errMsg.includes("schema cache") || errMsg.includes("purchase_order_items") || errMsg.includes("relation")) {
    const sql = await ensureTablesAndReloadSchema();
    if (sql) {
      try {
        await sql`insert into purchase_order_items ${sql(itemsPayload)}`;
      } finally {
        await sql.end();
      }
      return;
    }
  }
  throw new Error(res.error.message || "Failed to insert purchase order items.");
}

export async function safeDeletePurchaseOrderItems(supabase: any, orderId: string) {
  const res = await supabase.from("purchase_order_items").delete().eq("purchase_order_id", orderId);
  if (!res.error) return;

  const errMsg = String(res.error.message || res.error);
  if (errMsg.includes("schema cache") || errMsg.includes("purchase_order_items") || errMsg.includes("relation")) {
    const sql = await ensureTablesAndReloadSchema();
    if (sql) {
      try {
        await sql`delete from purchase_order_items where purchase_order_id = ${orderId}`;
      } finally {
        await sql.end();
      }
      return;
    }
  }
  throw new Error(res.error.message || "Failed to delete purchase order items.");
}

export async function safeInsertPurchaseOrderExpenses(supabase: any, expPayload: any[]) {
  if (!expPayload || expPayload.length === 0) return;

  const res = await supabase.from("purchase_order_expenses").insert(expPayload);
  if (!res.error) return;

  const errMsg = String(res.error.message || res.error);
  if (errMsg.includes("schema cache") || errMsg.includes("purchase_order_expenses") || errMsg.includes("relation")) {
    const sql = await ensureTablesAndReloadSchema();
    if (sql) {
      try {
        await sql`insert into purchase_order_expenses ${sql(expPayload)}`;
      } finally {
        await sql.end();
      }
      return;
    }
  }
  throw new Error(res.error.message || "Failed to insert purchase order expenses.");
}

export async function safeDeletePurchaseOrderExpenses(supabase: any, orderId: string) {
  const res = await supabase.from("purchase_order_expenses").delete().eq("purchase_order_id", orderId);
  if (!res.error) return;

  const errMsg = String(res.error.message || res.error);
  if (errMsg.includes("schema cache") || errMsg.includes("purchase_order_expenses") || errMsg.includes("relation")) {
    const sql = await ensureTablesAndReloadSchema();
    if (sql) {
      try {
        await sql`delete from purchase_order_expenses where purchase_order_id = ${orderId}`;
      } finally {
        await sql.end();
      }
      return;
    }
  }
  throw new Error(res.error.message || "Failed to delete purchase order expenses.");
}
