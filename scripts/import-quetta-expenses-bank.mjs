import { resolveDbUrl } from "./lib/prod-db-url.mjs";
// Quetta Office import: 38 accounts (13 Expenses 'U' + 25 Bank 'B') -> enterprise_accounts (VPS)
// + per-account 5-language record_translations (needs_review) + QVC Pending.
// Manual Number (Khata #) preserved EXACTLY. Source category authoritative (U->expense, B->asset/bank).
// Idempotent: skips a source code already present. Backup taken separately before running.
//   node scripts/import-quetta-expenses-bank.mjs --vps [--dry-run]
import fs from "node:fs";
import postgres from "postgres";

const VPS=resolveDbUrl("prod");
const dry=process.argv.includes("--dry-run");
const sql=postgres(VPS,{max:1,prepare:false,connect_timeout:40});
const src=JSON.parse(fs.readFileSync("dictionary-import/quetta-source.json","utf8")).records;
const BATCH="quetta-office-expenses-bank-2026-08-15";
const pad=(n)=>String(n).padStart(6,"0");
const g=(r,k)=>(r[k]||"").trim();
const manualOf=(r)=>g(r,"ERP Manual Number")||g(r,"Source Khata #");

const rep={source:src.length, expenseSrc:0, bankSrc:0, inserted:0, matched:0, updated:0, skipped:0, dupPrevented:0,
  pk:0, quetta:0, expensesLinked:0, bankLinked:0, manualOk:0, transRows:0, needsReview:0, qvcPending:0, errors:[]};

const PK=(await sql`select id from countries where iso2='PK' limit 1`)[0].id;
const QB=(await sql`select id, code from city_branches where country_id=${PK} and name ilike 'quetta' and deleted_at is null limit 1`)[0];
const branchCode=(QB.code||"QUETTA").replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,10);
console.log(`Country PK=${PK}  Quetta branch=${QB.id} (${QB.code})  batch=${BATCH}${dry?"  [DRY RUN]":""}\n`);

let serial=Number((await sql`select coalesce(max(account_serial_number),0)::bigint m from enterprise_accounts`)[0].m);
let branchSeq=Number((await sql`select count(*)::int c from enterprise_accounts where scope='city_branch' and city_branch_id=${QB.id} and deleted_at is null`)[0].c);

const TRANS=[["name","Account Name"],["company_name","Company Name"],["business_name","Business Name"],["city","City"],["address","Address"]];

for(const r of src){
  const manual=manualOf(r);
  const cat=g(r,"Source Category").toUpperCase(); // U or B
  if(cat==="U")rep.expenseSrc++; else if(cat==="B")rep.bankSrc++;
  if(!manual){rep.skipped++;continue;}
  try{
    const exist=await sql`select id from enterprise_accounts where manual_reference_number=${manual} and deleted_at is null limit 1`;
    if(exist.length){rep.dupPrevented++; rep.matched++; console.log(`  ${manual}: exists -> skip`); continue;}
    serial++; branchSeq++;
    const code=`PAK-QTA-AC-${pad(serial)}`;
    const nameEn=g(r,"Account Name EN")||g(r,"Account Name UR")||manual;
    const kind = cat==="B" ? "asset" : "expense";   // Bank accounts = asset; U = expense
    const row={
      scope:"city_branch", country_id:PK, city_branch_id:QB.id, country_branch_id:null,
      code, account_number:code, customer_number:`CUST-${code}`,
      account_serial_number:serial, country_serial_number:`PAK-${pad(serial)}`,
      branch_serial_number:`PAK-QTA-${pad(branchSeq)}`, branch_code:branchCode, branch_account_sequence:branchSeq,
      manual_reference_number:manual, creation_date:new Date().toISOString(),
      name:nameEn, kind, currency:"PKR", opening_balance:0, current_balance:0,
      status:"active", is_control_account:false,
      contacts: JSON.stringify([
        {type:"mobile", value:g(r,"Mobile")}, {type:"whatsapp", value:g(r,"WhatsApp")},
        {type:"phone", value:g(r,"Phone")}, {type:"email", value:g(r,"Email")}
      ]),
      qvc_status:"qvc_pending", qvc_notes:g(r,"Source Notes"), import_batch:BATCH,
      source_category:`${cat} -> ${g(r,"ERP Category")}/${g(r,"ERP Subcategory")}`
    };
    if(dry){ rep.inserted++; rep.pk++; rep.quetta++; if(cat==="B")rep.bankLinked++; else rep.expensesLinked++; rep.manualOk++; rep.qvcPending++; console.log(`  ${manual} [${cat}->${kind}]: WOULD insert "${nameEn}"`); }
    else{
      const id=(await sql`insert into enterprise_accounts ${sql(row)} returning id`)[0].id;
      rep.inserted++; rep.pk++; rep.quetta++; if(cat==="B")rep.bankLinked++; else rep.expensesLinked++; rep.manualOk++; rep.qvcPending++;
      for(const [field,col] of TRANS){
        const en=g(r,`${col} EN`),ur=g(r,`${col} UR`),ps=g(r,`${col} PS`),fa=g(r,`${col} FA`),ar=g(r,`${col} AR`);
        const orig=ur||en; if(!orig)continue;
        await sql`insert into record_translations (record_table, record_id, field_name, original_text, original_language_code, english_text, urdu_text, pashto_text, persian_text, arabic_text, source, translation_status, created_at, updated_at)
          values ('enterprise_accounts', ${id}, ${field}, ${orig}, 'ur', ${en||null}, ${ur||null}, ${ps||null}, ${fa||null}, ${ar||null}, 'imported', 'needs_review', now(), now())
          on conflict (record_table, record_id, field_name) where deleted_at is null do nothing`;
        rep.transRows++; rep.needsReview++;
      }
      console.log(`  ${manual} [${cat}->${kind}]: inserted "${nameEn}"`);
    }
  }catch(e){ rep.errors.push(`${manual}: ${e.message.slice(0,110)}`); console.log(`  ${manual}: ERROR ${e.message.slice(0,110)}`); }
}
console.log("\n=== RECONCILIATION ===\n"+JSON.stringify(rep,null,1));
console.log(`Sum check: inserted(${rep.inserted})+matched(${rep.matched})+skipped(${rep.skipped})+errors(${rep.errors.length}) = ${rep.inserted+rep.matched+rep.skipped+rep.errors.length} (expect ${rep.source})`);
process.exit(0);
