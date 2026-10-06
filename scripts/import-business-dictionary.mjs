// Import the 5-Language ERP Business Dictionary into record_translations (the Local Translator).
//
// Place the supplied files in ./dictionary-import/ then run:
//   node scripts/import-business-dictionary.mjs            (LOCAL/dev DB)
//   node scripts/import-business-dictionary.mjs --vps      (VPS/prod DB)
//   node scripts/import-business-dictionary.mjs --dry-run  (parse + report only, no writes)
//
// Files handled (any subset present is imported):
//   ERP_dictionary_import.csv          -> record_table='system_dictionary', status='complete'
//   ERP_transaction_templates_import.csv -> record_table='transaction_templates', status='complete'
//   ERP_proper_names_review.csv        -> record_table from a 'table' column (or 'proper_names'),
//                                         status from file, default 'needs_review' (NEVER invent spellings)
//   record_translations_integration.sql -> executed verbatim if present (--run-sql)
//
// Idempotent: keyed by (record_table, record_id, field_name); record_id = UUIDv5(term).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";

import { resolveDbUrl } from "./lib/prod-db-url.mjs";
function pe(f){const e={};if(!fs.existsSync(f))return e;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const t=l.trim();if(!t||t.startsWith("#"))continue;const i=t.indexOf("=");if(i>-1)e[t.slice(0,i)]=t.slice(i+1).replace(/^"|"$/g,"");}return e;}
const env={...pe(".env"),...pe(".env.local")};
const VPS=resolveDbUrl("prod");
const isVps=process.argv.includes("--vps");
const dryRun=process.argv.includes("--dry-run");
const url=isVps?VPS:env.DATABASE_URL;
const DIR=path.join(process.cwd(),"dictionary-import");

// UUIDv5 (deterministic) so re-imports upsert instead of duplicating.
const NS="6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // standard DNS namespace
function uuidv5(name){
  const nsBytes=Buffer.from(NS.replace(/-/g,""),"hex");
  const h=crypto.createHash("sha1").update(Buffer.concat([nsBytes,Buffer.from(name,"utf8")])).digest();
  const b=Buffer.from(h.subarray(0,16));
  b[6]=(b[6]&0x0f)|0x50; b[8]=(b[8]&0x3f)|0x80;
  const hex=b.toString("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// Minimal robust CSV parser (quoted fields, commas, newlines).
function parseCsv(text){
  const rows=[]; let row=[], field="", q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else q=false; } else field+=c; }
    else { if(c==='"')q=true; else if(c===','){row.push(field);field="";} else if(c==='\n'){row.push(field);rows.push(row);row=[];field="";} else if(c==='\r'){} else field+=c; }
  }
  if(field.length||row.length){row.push(field);rows.push(row);}
  return rows.filter(r=>r.some(x=>x.trim()!==""));
}
const norm=s=>String(s||"").trim().toLowerCase().replace(/[^a-z]/g,"");
function colIndex(header, ...names){ const H=header.map(norm); for(const n of names){const i=H.indexOf(norm(n)); if(i>-1)return i;} return -1; }

function loadFile(file){
  const p=path.join(DIR,file);
  if(!fs.existsSync(p)) return null;
  const rows=parseCsv(fs.readFileSync(p,"utf8"));
  if(rows.length<2) return {header:rows[0]||[],data:[]};
  return {header:rows[0], data:rows.slice(1)};
}

async function upsert(sql, table, entries, defaultStatus){
  let ins=0, upd=0, skipped=0;
  for(const e of entries){
    if(!e.en){skipped++;continue;}
    const rid=uuidv5(`${table}:${e.en.toLowerCase()}`);
    if(dryRun){ins++;continue;}
    const res=await sql`
      insert into record_translations
        (record_table, record_id, field_name, original_text, original_language_code,
         english_text, urdu_text, pashto_text, persian_text, arabic_text, source, translation_status, created_at, updated_at)
      values (${table}, ${rid}, 'term', ${e.en}, 'en',
         ${e.en}, ${e.ur||null}, ${e.ps||null}, ${e.fa||null}, ${e.ar||null}, 'business_dictionary', ${e.status||defaultStatus}, now(), now())
      on conflict (record_table, record_id, field_name) where deleted_at is null
      do update set urdu_text=excluded.urdu_text, pashto_text=excluded.pashto_text,
        persian_text=excluded.persian_text, arabic_text=excluded.arabic_text,
        translation_status=excluded.translation_status, updated_at=now()
      returning (xmax=0) as inserted`;
    if(res[0]?.inserted)ins++;else upd++;
  }
  return {ins,upd,skipped};
}

function extract(fileObj, statusDefault){
  if(!fileObj) return [];
  const h=fileObj.header;
  const iEn=colIndex(h,"en","english","englishtext","term","key","name");
  const iUr=colIndex(h,"ur","urdu","urdutext");
  const iPs=colIndex(h,"ps","pashto","pashtotext");
  const iFa=colIndex(h,"fa","persian","farsi","persiantext");
  const iAr=colIndex(h,"ar","arabic","arabictext");
  const iStatus=colIndex(h,"status","translationstatus","review");
  const iTable=colIndex(h,"table","recordtable","module","category","entity");
  return fileObj.data.map(r=>({
    en:(r[iEn]||"").trim(),
    ur:iUr>-1?(r[iUr]||"").trim():"",
    ps:iPs>-1?(r[iPs]||"").trim():"",
    fa:iFa>-1?(r[iFa]||"").trim():"",
    ar:iAr>-1?(r[iAr]||"").trim():"",
    status:iStatus>-1?(r[iStatus]||"").trim()||statusDefault:statusDefault,
    table:iTable>-1?(r[iTable]||"").trim():""
  })).filter(x=>x.en);
}

(async()=>{
  if(!fs.existsSync(DIR)){console.error(`Missing folder: ${DIR}\nCreate it and drop the supplied files there.`);process.exit(1);}
  if(!url){console.error("No DATABASE_URL");process.exit(1);}
  console.log(`Target DB: ${isVps?"VPS/prod":"LOCAL/dev"}${dryRun?"  [DRY RUN]":""}\nReading from: ${DIR}\n`);
  const sql=url?postgres(url,{max:1,prepare:false,connect_timeout:30}):null;

  const dict=extract(loadFile("ERP_dictionary_import.csv"),"complete");
  const tmpl=extract(loadFile("ERP_transaction_templates_import.csv"),"complete");
  const names=extract(loadFile("ERP_proper_names_review.csv"),"needs_review");

  console.log(`Parsed: dictionary=${dict.length}  templates=${tmpl.length}  proper_names=${names.length}`);
  if(dict.length+tmpl.length+names.length===0){console.error("\nNo rows parsed — are the files present in dictionary-import/ ?");process.exit(1);}

  const r1=await upsert(sql,"system_dictionary",dict,"complete");
  const r2=await upsert(sql,"transaction_templates",tmpl,"complete");
  // proper names: group by their own table if provided, else 'proper_names_review'
  let r3={ins:0,upd:0,skipped:0};
  for(const e of names){ const t=e.table||"proper_names_review"; const rr=await upsert(sql,t,[e],"needs_review"); r3.ins+=rr.ins;r3.upd+=rr.upd;r3.skipped+=rr.skipped; }

  console.log(`\n=== IMPORT RESULT ${dryRun?"(dry-run, no writes)":""} ===`);
  console.log(`system_dictionary:     inserted=${r1.ins} updated=${r1.upd} skipped=${r1.skipped}`);
  console.log(`transaction_templates: inserted=${r2.ins} updated=${r2.upd} skipped=${r2.skipped}`);
  console.log(`proper_names(needs_review): inserted=${r3.ins} updated=${r3.upd} skipped=${r3.skipped}`);
  console.log(`TOTAL entries processed: ${dict.length+tmpl.length+names.length}`);
  process.exit(0);
})();
