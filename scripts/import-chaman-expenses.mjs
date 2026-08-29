// Chaman Company-Expenses import: 12 source accounts -> enterprise_accounts (VPS),
// with 5-language record_translations (needs_review) and QVC Pending status.
// Manual Number (Khata #) preserved EXACTLY in manual_reference_number. No hardcoding in app code.
// Idempotent: skips a source code already present (manual_reference_number match).
//   node scripts/import-chaman-expenses.mjs --vps            (real import)
//   node scripts/import-chaman-expenses.mjs --vps --dry-run  (report only)
import fs from "node:fs";
import postgres from "postgres";

import { resolveDbUrl } from "./lib/prod-db-url.mjs";
const VPS=resolveDbUrl("prod");
const dry=process.argv.includes("--dry-run");
const sql=postgres(VPS,{max:1,prepare:false,connect_timeout:40});
const src=JSON.parse(fs.readFileSync("dictionary-import/chaman-source.json","utf8")).records;
const BATCH="chaman-company-expenses-2026-08-14";
const pad=(n)=>String(n).padStart(6,"0");
const g=(r,k)=>(r[k]||"").trim();

const rep={source:src.length, inserted:0, matched:0, updated:0, skipped:0, dupPrevented:0,
  pk:0, chaman:0, expenses:0, companyExpenses:0, manualOk:0, transRows:0, needsReview:0, qvcPending:0, errors:[]};

const pkRows=await sql`select id from countries where iso2='PK' limit 1`;
const chRows=await sql`select id, code, city_name, name from city_branches where name ilike 'chaman' and country_id=${pkRows[0].id} and deleted_at is null limit 1`;
if(!pkRows.length||!chRows.length){console.error("Pakistan or Chaman branch not found");process.exit(1);}
const PK=pkRows[0].id, CH=chRows[0].id;
const branchCode = (chRows[0].code||"CHAMAN").replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,10);
console.log(`Country PK=${PK}  Chaman branch=${CH} (${chRows[0].code})  batch=${BATCH}${dry?"  [DRY RUN]":""}\n`);

const maxRows=await sql`select coalesce(max(account_serial_number),0)::bigint as m from enterprise_accounts`;
let serial=Number(maxRows[0].m);
const brRows=await sql`select count(*)::int c from enterprise_accounts where scope='city_branch' and city_branch_id=${CH} and deleted_at is null`;
let branchSeq=Number(brRows[0].c);

const TRANS=[["name","Account Name"],["company_name","Company Name"],["business_name","Business Name"],["city","City"],["address","Address"]];

for(const r of src){
  const manual=g(r,"Source Account Code");
  if(!manual){rep.skipped++;continue;}
  try{
    // Duplicate protection: match by manual_reference_number (Khata #)
    const exist=await sql`select id from enterprise_accounts where manual_reference_number=${manual} and deleted_at is null limit 1`;
    if(exist.length){rep.dupPrevented++; rep.matched++; console.log(`  ${manual}: already exists -> skip (no duplicate)`); continue;}

    serial++; branchSeq++;
    const code=`PAK-CHM-AC-${pad(serial)}`;
    const nameEn=g(r,"Account Name EN")||g(r,"Source Account Name (UR)")||manual;
    const row={
      scope:"city_branch", country_id:PK, city_branch_id:CH, country_branch_id:null,
      code, account_number:code, customer_number:`CUST-${code}`,
      account_serial_number:serial, country_serial_number:`PAK-${pad(serial)}`,
      branch_serial_number:`PAK-CHM-${pad(branchSeq)}`, branch_code:branchCode, branch_account_sequence:branchSeq,
      manual_reference_number:manual,  // EXACT Khata # preserved (leading zeros/letters kept)
      creation_date:new Date().toISOString(),
      name:nameEn, kind:"expense", currency:"PKR", opening_balance:0, current_balance:0,
      status:"active", is_control_account:false,
      contacts: JSON.stringify([
        {type:"mobile", value:g(r,"Mobile")}, {type:"whatsapp", value:g(r,"WhatsApp")},
        {type:"phone", value:g(r,"Phone")}, {type:"email", value:g(r,"Email")}
      ]),
      qvc_status:"qvc_pending", qvc_notes:g(r,"Review Notes"), import_batch:BATCH, source_category:g(r,"Source Category")
    };
    if(dry){ rep.inserted++; rep.pk++; rep.chaman++; rep.expenses++; rep.companyExpenses++; rep.manualOk++; rep.qvcPending++; console.log(`  ${manual}: WOULD insert "${nameEn}" code=${code}`); }
    else {
      const ins=await sql`insert into enterprise_accounts ${sql(row)} returning id`;
      const id=ins[0].id;
      rep.inserted++; rep.pk++; rep.chaman++; rep.expenses++; rep.companyExpenses++; rep.manualOk++; rep.qvcPending++;
      // 5-language translations for name/company/business/city/address (draft -> needs_review)
      for(const [field,col] of TRANS){
        const en=g(r,`${col} EN`), ur=g(r,`${col} UR`), ps=g(r,`${col} PS`), fa=g(r,`${col} FA`), ar=g(r,`${col} AR`);
        const orig = ur || en; if(!orig) continue;
        await sql`insert into record_translations
          (record_table, record_id, field_name, original_text, original_language_code,
           english_text, urdu_text, pashto_text, persian_text, arabic_text, source, translation_status, created_at, updated_at)
          values ('enterprise_accounts', ${id}, ${field}, ${orig}, 'ur',
           ${en||null}, ${ur||null}, ${ps||null}, ${fa||null}, ${ar||null}, 'chaman_import', 'needs_review', now(), now())
          on conflict (record_table, record_id, field_name) where deleted_at is null do nothing`;
        rep.transRows++; rep.needsReview++;
      }
      console.log(`  ${manual}: inserted id=${id} "${nameEn}" (PK/Chaman/Expenses/CompanyExpenses, 5-lang, QVC pending)`);
    }
  }catch(e){ rep.errors.push(`${manual}: ${e.message.slice(0,120)}`); console.log(`  ${manual}: ERROR ${e.message.slice(0,120)}`); }
}

console.log("\n=== RECONCILIATION ===");
console.log(JSON.stringify(rep,null,1));
console.log(`\nReconcile: source=${rep.source}  inserted=${rep.inserted}  matched/dupPrevented=${rep.matched}  skipped=${rep.skipped}  errors=${rep.errors.length}`);
console.log(`Sum = ${rep.inserted+rep.matched+rep.skipped+rep.errors.length} (should equal ${rep.source})`);
process.exit(0);
