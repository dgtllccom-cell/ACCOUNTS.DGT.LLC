import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const localEnv = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const vpsEnv = {
  DATABASE_URL: "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
};

const localSql = postgres(localEnv.DATABASE_URL, { max: 1, prepare: false });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

async function reconcileTranslations() {
  console.log("=================================================================================");
  console.log("           RECORD TRANSLATIONS RECONCILIATION (LOCAL vs VPS)                     ");
  console.log("=================================================================================\n");

  const locCount = await localSql`SELECT COUNT(*)::int as count FROM public.record_translations WHERE deleted_at IS NULL`;
  const vpsCount = await vpsSql`SELECT COUNT(*)::int as count FROM public.record_translations WHERE deleted_at IS NULL`;

  console.log(`LOCAL Active record_translations: ${locCount[0].count}`);
  console.log(`VPS   Active record_translations: ${vpsCount[0].count}\n`);

  // Table by table breakdown
  const locByTable = await localSql`
    SELECT record_table, COUNT(*)::int as count
    FROM public.record_translations
    WHERE deleted_at IS NULL
    GROUP BY record_table
    ORDER BY record_table
  `;

  const vpsByTable = await vpsSql`
    SELECT record_table, COUNT(*)::int as count
    FROM public.record_translations
    WHERE deleted_at IS NULL
    GROUP BY record_table
    ORDER BY record_table
  `;

  const vpsTableMap = new Map(vpsByTable.map(r => [r.record_table, r.count]));
  const locTableMap = new Map(locByTable.map(r => [r.record_table, r.count]));

  const allTables = new Set([...locTableMap.keys(), ...vpsTableMap.keys()]);
  const tableBreakdown = [];

  for (const t of Array.from(allTables).sort()) {
    const locN = locTableMap.get(t) || 0;
    const vpsN = vpsTableMap.get(t) || 0;
    tableBreakdown.push({
      "Record Table": t,
      "LOCAL Count": locN,
      "VPS Count": vpsN,
      "Difference": vpsN - locN,
      "Status": vpsN === locN ? "MATCH" : (vpsN > locN ? "VPS HAS EXTRA" : "LOCAL HAS EXTRA")
    });
  }

  console.table(tableBreakdown);

  // Find exact records missing in VPS
  const locIds = await localSql`SELECT id, record_table, record_id, field_name FROM public.record_translations WHERE deleted_at IS NULL`;
  const vpsIds = await vpsSql`SELECT id, record_table, record_id, field_name FROM public.record_translations WHERE deleted_at IS NULL`;

  const vpsIdSet = new Set(vpsIds.map(r => r.id));
  const missingInVps = locIds.filter(r => !vpsIdSet.has(r.id));

  console.log(`\nExact Local Translation Records Missing on VPS: ${missingInVps.length}`);

  if (missingInVps.length > 0) {
    const missingByTable = {};
    for (const m of missingInVps) {
      missingByTable[m.record_table] = (missingByTable[m.record_table] || 0) + 1;
    }
    console.log("Missing Translations by Table:", missingByTable);

    // Check if missing parent records exist on VPS
    console.log("\nChecking Parent Record Existence on VPS for Missing Translations...");
    const orphanAnalysis = [];
    for (const [table, count] of Object.entries(missingByTable)) {
      const sampleMissing = missingInVps.filter(m => m.record_table === table);
      let parentExistsCount = 0;
      let parentMissingCount = 0;

      for (const sm of sampleMissing) {
        try {
          const parent = await vpsSql.unsafe(`SELECT id FROM public."${table}" WHERE id = $1`, [sm.record_id]);
          if (parent.length > 0) parentExistsCount++;
          else parentMissingCount++;
        } catch (e) {
          parentMissingCount++;
        }
      }
      orphanAnalysis.push({
        "Table": table,
        "Total Missing Translations": count,
        "Parent Exists on VPS": parentExistsCount,
        "Orphan (Parent Missing on VPS)": parentMissingCount
      });
    }
    console.table(orphanAnalysis);
  }

  await localSql.end();
  await vpsSql.end();
  process.exit(0);
}

reconcileTranslations().catch(err => {
  console.error("Reconciliation error:", err);
  process.exit(1);
});
