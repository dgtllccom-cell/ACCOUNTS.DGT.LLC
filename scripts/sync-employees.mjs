import { resolveDbUrl } from "./lib/prod-db-url.mjs";
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
  DATABASE_URL: resolveDbUrl("prod")
};

const localSql = postgres(localEnv.DATABASE_URL, { max: 1, prepare: false });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

async function syncPersonsAndEmployees() {
  console.log("▶ Syncing persons...");
  const localPersons = await localSql`SELECT * FROM public.persons`;
  const personColsInfo = await vpsSql`SELECT column_name, is_generated FROM information_schema.columns WHERE table_name = 'persons' AND table_schema = 'public'`;
  const writablePersonCols = personColsInfo.filter(c => c.is_generated !== 'ALWAYS').map(c => c.column_name);

  const cleanPersons = localPersons.map(p => {
    const res = {};
    for (const col of writablePersonCols) {
      res[col] = p[col] !== undefined ? p[col] : null;
    }
    res.created_by = null;
    return res;
  });

  try {
    await vpsSql`INSERT INTO public.persons ${vpsSql(cleanPersons)} ON CONFLICT DO NOTHING`;
    console.log(`✓ Persons synced: ${cleanPersons.length}`);
  } catch (err) {
    for (const p of cleanPersons) {
      try {
        await vpsSql`INSERT INTO public.persons ${vpsSql([p])} ON CONFLICT DO NOTHING`;
      } catch (e) {}
    }
  }

  console.log("▶ Syncing employees...");
  const localEmp = await localSql`SELECT * FROM public.employees`;
  const empColsInfo = await vpsSql`SELECT column_name, is_generated FROM information_schema.columns WHERE table_name = 'employees' AND table_schema = 'public'`;
  const writableEmpCols = empColsInfo.filter(c => c.is_generated !== 'ALWAYS').map(c => c.column_name);

  const cleanEmp = localEmp.map(e => {
    const res = {};
    for (const col of writableEmpCols) {
      res[col] = e[col] !== undefined ? e[col] : null;
    }
    res.created_by = null;
    res.reporting_manager_id = null;
    return res;
  });

  try {
    await vpsSql`INSERT INTO public.employees ${vpsSql(cleanEmp)} ON CONFLICT DO NOTHING`;
    console.log(`✓ Employees synced: ${cleanEmp.length}`);
  } catch (err) {
    for (const e of cleanEmp) {
      try {
        await vpsSql`INSERT INTO public.employees ${vpsSql([e])} ON CONFLICT DO NOTHING`;
      } catch (eErr) {
        console.error("Emp error:", eErr.message);
      }
    }
  }

  const vpsEmpCount = await vpsSql`SELECT COUNT(*)::int FROM public.employees`;
  console.log(`✓ VPS Employees Total: ${vpsEmpCount[0].count} / ${localEmp.length}`);

  await localSql.end();
  await vpsSql.end();
  process.exit(0);
}

syncPersonsAndEmployees();
