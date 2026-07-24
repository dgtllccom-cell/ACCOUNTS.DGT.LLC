import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
    
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
        add column if not exists landed_cost_usd numeric(18,4) not null default 0;

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

    // Execute the NOTIFY command to reload PostgREST schema cache
    await sql`NOTIFY pgrst, 'reload schema'`;
    
    await sql.end();
    
    return NextResponse.json({ success: true, message: "Schema cache reloaded successfully!" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
