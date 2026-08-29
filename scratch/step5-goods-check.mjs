import fs from "node:fs"; import postgres from "postgres";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const sql = postgres(PROD,{max:1,prepare:false,ssl:{rejectUnauthorized:false}});
console.log("=== all goods rows on production (was 2, now 3) ===");
const g = await sql`SELECT id, goods_name, product_code, category, created_at, created_by, updated_at FROM goods ORDER BY created_at`;
for (const r of g) console.log(JSON.stringify(r));
console.log("\n=== compare to backup ===");
const backupDir = fs.readFileSync("scratch/step5-backup-path.txt","utf8").trim();
const backedUp = JSON.parse(fs.readFileSync(`${backupDir}/goods.json`,"utf8"));
console.log("backup goods:", backedUp.map(r=>`${r.id} ${r.goods_name}`).join(" | "));
console.log("\nNEW row not in backup:");
const backupIds = new Set(backedUp.map(r=>r.id));
for (const r of g) if (!backupIds.has(r.id)) console.log("  →", JSON.stringify(r));
// which migration seeds goods?
console.log("\n=== migrations mentioning INSERT INTO goods ===");
