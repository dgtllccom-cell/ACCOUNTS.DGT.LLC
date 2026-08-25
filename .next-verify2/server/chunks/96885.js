"use strict";exports.id=96885,exports.ids=[96885],exports.modules={10044:(a,b,c)=>{c.d(b,{LI:()=>i,OZ:()=>g,Xl:()=>j,uf:()=>f,ym:()=>h});var d=c(49122);async function e(){let a=process.env.DATABASE_URL;if(!a)return null;try{let b=(0,d.A)(a,{max:1,prepare:!1,connect_timeout:10});await b.unsafe(`
      alter table if exists purchase_orders
        add column if not exists status text default 'Draft',
        add column if not exists purchase_contract_no text,
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
      
      notify pgrst, 'reload schema';

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
    `);try{await b.unsafe("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'transferred'")}catch(a){}try{await b.unsafe("ALTER TABLE purchase_orders ALTER COLUMN ledger_posting_status TYPE text")}catch(a){}try{await b.unsafe("ALTER TABLE purchase_orders ALTER COLUMN payment_status TYPE text")}catch(a){}try{await b.unsafe("ALTER TABLE purchase_order_payments ALTER COLUMN ledger_posting_status TYPE text")}catch(a){}try{await b.unsafe("create policy purchase_order_items_all on purchase_order_items for all using (true) with check (true);")}catch(a){}try{await b.unsafe("create policy purchase_order_expenses_all on purchase_order_expenses for all using (true) with check (true);")}catch(a){}return await b.unsafe("NOTIFY pgrst, 'reload schema'"),b}catch(a){return console.error("Error ensuring tables and schema:",a),null}}async function f(){let a=await e();a&&await a.end()}async function g(a,b){if(!b||0===b.length)return[];let c=await a.from("purchase_order_items").insert(b).select("id, goods_name, brand, unit_name");if(!c.error)return c.data||[];let d=String(c.error.message||c.error);if(d.includes("schema cache")||d.includes("purchase_order_items")||d.includes("relation")){let a=await e();if(a)try{return await a`insert into purchase_order_items ${a(b)} returning id, goods_name, brand, unit_name`}finally{await a.end()}}throw Error(c.error.message||"Failed to insert purchase order items.")}async function h(a,b){let c=await a.from("purchase_order_items").delete().eq("purchase_order_id",b);if(!c.error)return;let d=String(c.error.message||c.error);if(d.includes("schema cache")||d.includes("purchase_order_items")||d.includes("relation")){let a=await e();if(a){try{await a`delete from purchase_order_items where purchase_order_id = ${b}`}finally{await a.end()}return}}throw Error(c.error.message||"Failed to delete purchase order items.")}async function i(a,b){if(!b||0===b.length)return;let c=await a.from("purchase_order_expenses").insert(b);if(!c.error)return;let d=String(c.error.message||c.error);if(d.includes("schema cache")||d.includes("purchase_order_expenses")||d.includes("relation")){let a=await e();if(a){try{await a`insert into purchase_order_expenses ${a(b)}`}finally{await a.end()}return}}throw Error(c.error.message||"Failed to insert purchase order expenses.")}async function j(a,b){let c=await a.from("purchase_order_expenses").delete().eq("purchase_order_id",b);if(!c.error)return;let d=String(c.error.message||c.error);if(d.includes("schema cache")||d.includes("purchase_order_expenses")||d.includes("relation")){let a=await e();if(a){try{await a`delete from purchase_order_expenses where purchase_order_id = ${b}`}finally{await a.end()}return}}throw Error(c.error.message||"Failed to delete purchase order expenses.")}},20682:(a,b,c)=>{c.d(b,{UU:()=>i,bq:()=>k,oI:()=>j});var d=c(64445),e=c(99875),f=c(5104),g=c(53028);function h(){let a=(0,g.Oq)();return!!(a&&!/^sb_(publishable|anon)_/i.test(a)&&a!==(0,g.nq)())}async function i(){return h()?(0,e.createSupabaseAdminClient)():await (0,d.z)()}async function j(a){let{data:b,error:c}=await a;if(c)throw Error(c.message);return b}async function k(a){if("production"===(0,f.rA)()||h())try{let b=await i(),{error:c}=await b.rpc("write_erp_audit_log",{p_action:a.action,p_entity_table:a.entityTable,p_entity_id:a.entityId??null,p_before:a.before??null,p_after:a.after??null,p_company_id:a.companyId??null,p_ip_address:a.ipAddress??null});if(!c)return;throw Error(c.message)}catch(b){try{let b=(0,e.createSupabaseAdminClient)(),{error:c}=await b.from("audit_logs").insert({company_id:a.companyId??null,actor_id:null,action:a.action,entity_table:a.entityTable,entity_id:a.entityId??null,before:a.before??null,after:a.after??null,ip_address:a.ipAddress??null});if(c)throw Error(c.message)}catch(a){console.error("[writeAuditLog] Non-fatal: audit log write failed on both RPC and fallback paths:",b,a)}}}},69799:(a,b,c)=>{function d(a){return"string"==typeof a?a.trim():""}function e(a,b){let c=a&&"object"==typeof a?a:{},e=c.form&&"object"==typeof c.form?c.form:c,f=Array.isArray(b)&&b.length>0?b:Array.isArray(c.goodsEntries)?c.goodsEntries:[],g=(...a)=>a.map(d).find(Boolean)||"",h=[{fieldName:"purchase_account_name",value:g(e.purchaseAccountName),mode:"transliterate"},{fieldName:"sales_account_name",value:g(e.salesAccountName),mode:"transliterate"},{fieldName:"supplier_name",value:g(e.supplierName,e.purchaseCompanyName),mode:"transliterate"},{fieldName:"buyer_name",value:g(e.customerName,e.buyerName),mode:"transliterate"},{fieldName:"remarks",value:g(e.orderReportRemarks,e.remarks),mode:"translate"},{fieldName:"country_name",value:g(e.branchCountry,e.countryName,e.destinationCountry),mode:"transliterate"},{fieldName:"branch_name",value:g(e.branchName,e.purchaseAccountBranch,e.salesAccountBranch),mode:"transliterate"}],i=f.map(a=>g(a.goodsName,a.productName)).filter(Boolean),j=f.map(a=>g(a.description,a.goodsDescription)).filter(Boolean);return h.push({fieldName:"product_name",value:i.join(", "),mode:"transliterate"},{fieldName:"goods_description",value:j.join("; "),mode:"translate"}),f.forEach((a,b)=>{let c=`items.${b}`;h.push({fieldName:`${c}.goods_name`,value:g(a.goodsName,a.productName),mode:"transliterate"},{fieldName:`${c}.description`,value:g(a.description,a.goodsDescription),mode:"translate"},{fieldName:`${c}.brand`,value:g(a.brand),mode:"transliterate"},{fieldName:`${c}.size`,value:g(a.size),mode:"transliterate"},{fieldName:`${c}.origin`,value:g(a.origin),mode:"transliterate"},{fieldName:`${c}.unit_name`,value:g(a.unitName,a.qtyName),mode:"translate"})}),h.filter(a=>a.value.length>0)}c.d(b,{iQ:()=>e}),c(99765)},70151:(a,b,c)=>{c.d(b,{Di:()=>e,bF:()=>i,f$:()=>g,ge:()=>h,yM:()=>f}),c(39588);var d=c(42464);function e(a){return{countryId:a.nextUrl.searchParams.get("countryId"),countryBranchId:a.nextUrl.searchParams.get("countryBranchId"),cityBranchId:a.nextUrl.searchParams.get("cityBranchId")}}function f(a,b){(0,d.Gq)(a,{resource:b.resource,action:b.action,countryId:b.countryId,countryBranchId:b.countryBranchId,cityBranchId:b.cityBranchId})}function g(a,b){if(!(0,d.eE)(a,b.resource,b.action))throw new d.fL(`Missing permission: ${b.resource}:${b.action}`);if(a.isSuperAdmin)return;let c=b=>b.cityBranchId?(0,d.is)(a,b.cityBranchId):b.countryBranchId?(0,d.Nh)(a,b.countryBranchId):!!b.countryId&&(0,d.Fx)(a,b.countryId),e=c(b.source),f=!!b.destination&&c(b.destination);if(!e&&!f)throw new d.fL("Neither the source nor destination scope of this record is allowed for this user.")}function h(a,b){return!!a.isSuperAdmin||!!b&&(!!b.cityBranchId||!!b.countryBranchId||!!b.countryId)&&(b.cityBranchId?(0,d.is)(a,b.cityBranchId):b.countryBranchId?(0,d.Nh)(a,b.countryBranchId):!!b.countryId&&(0,d.Fx)(a,b.countryId))}function i(a,b,c){let d=a;return c?.cityBranchId?d=d.eq("city_branch_id",c.cityBranchId):c?.countryBranchId?d=d.eq("country_branch_id",c.countryBranchId):c?.countryId&&(d=d.eq("country_id",c.countryId)),!b.isSuperAdmin&&(b.cityBranchIds.length>0?(d=d.or(`city_branch_id.in.(${b.cityBranchIds.join(",")}),city_branch_id.is.null`),b.countryIds.length>0&&(d=d.in("country_id",b.countryIds))):d=b.countryBranchIds.length>0?d.in("country_branch_id",b.countryBranchIds):b.countryIds.length>0?d.in("country_id",b.countryIds):d.eq("id","00000000-0000-0000-0000-000000000000")),d}}};