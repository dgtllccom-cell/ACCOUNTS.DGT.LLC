import postgres from "postgres";
import fs from "fs";

function parseEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnv(".env"), ...parseEnv(".env.local") };
const sql = postgres(env.DATABASE_URL, { max: 1 });

const ports = await sql`
  select p.id, p.port_name, p.transport_type, p.port_code, c.name as country_name 
  from public.ports p 
  join public.countries c on p.country_id = c.id
  where p.is_active = true and (
    c.name ilike '%pakistan%' or c.name ilike '%afghanistan%' or c.name ilike '%emirates%' or c.name ilike '%iran%' or c.name ilike '%uzbekistan%' or c.name ilike '%india%'
  )
  order by c.name, p.port_name
`;
for (const p of ports) {
  console.log(`${p.country_name} | ${p.transport_type} | ${p.port_name} (${p.port_code}) -> ${p.id}`);
}

await sql.end();
