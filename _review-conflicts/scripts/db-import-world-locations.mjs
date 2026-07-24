import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const ROOT = process.cwd();
const DEFAULT_SOURCE = path.join("C:", "tmp", "geonames-world");
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) { args.set(a, next); i++; }
    else args.set(a, true);
  }
}

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function clean(value) {
  const v = String(value ?? "").trim();
  return v || null;
}
function lowerKey(value) { return String(value ?? "").trim().toLowerCase(); }
function moneyCurrency(code) { return /^[A-Z]{3}$/.test(code || "") ? code : "USD"; }
function splitTsv(line) { return line.split("\t"); }
function requireFile(sourceDir, name) {
  const file = path.join(sourceDir, name);
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return file;
}
function readLines(file) {
  return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
}
async function batch(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size), i);
  }
}

async function ensureMigration(sql) {
  const migration = fs.readFileSync(path.join(ROOT, "supabase", "migrations", "0064_world_location_master.sql"), "utf8");
  await sql.unsafe(migration);
}

async function importCountries(sql, sourceDir) {
  const file = requireFile(sourceDir, "countryInfo.txt");
  const rows = [];
  for (const line of readLines(file)) {
    if (!line || line.startsWith("#")) continue;
    const c = splitTsv(line);
    const iso2 = clean(c[0])?.toUpperCase();
    const iso3 = clean(c[1])?.toUpperCase();
    const name = clean(c[4]);
    if (!iso2 || !name) continue;
    rows.push({
      name,
      iso2,
      iso3,
      currency_code: moneyCurrency(clean(c[10])?.toUpperCase()),
      phone_code: clean(c[12]),
      official_email: `${iso2.toLowerCase()}@dgt.llc`,
      admin_email: `${iso2.toLowerCase()}-admin@dgt.llc`,
      email_domain: "dgt.llc",
    });
  }
  let inserted = 0, updated = 0;
  for (const row of rows) {
    const existing = await sql`select id from countries where upper(iso2) = ${row.iso2} and deleted_at is null limit 1`;
    if (existing.length) {
      await sql`update countries set name=${row.name}, iso3=${row.iso3}, currency_code=${row.currency_code}, phone_code=${row.phone_code}, official_email=coalesce(nullif(official_email,''), ${row.official_email}), admin_email=coalesce(nullif(admin_email,''), ${row.admin_email}), email_domain=coalesce(email_domain, ${row.email_domain}), is_active=true, updated_at=now() where id=${existing[0].id}`;
      updated++;
    } else {
      await sql`insert into countries (name, iso2, iso3, currency_code, reporting_currency, phone_code, official_email, admin_email, email_domain, is_active) values (${row.name}, ${row.iso2}, ${row.iso3}, ${row.currency_code}, 'USD', ${row.phone_code}, ${row.official_email}, ${row.admin_email}, ${row.email_domain}, true)`;
      inserted++;
    }
  }
  return { total: rows.length, inserted, updated };
}

async function loadCountryMap(sql) {
  const rows = await sql`select id, iso2, name from countries where deleted_at is null`;
  const map = new Map();
  for (const r of rows) if (r.iso2) map.set(r.iso2.toUpperCase(), r.id);
  return map;
}
async function loadStateMap(sql) {
  const rows = await sql`select id, country_id, code, name from states_provinces where deleted_at is null`;
  const byCode = new Map(), byName = new Map();
  for (const r of rows) {
    if (r.code) byCode.set(`${r.country_id}|${r.code}`, r.id);
    byName.set(`${r.country_id}|${lowerKey(r.name)}`, r.id);
  }
  return { byCode, byName };
}
async function loadDistrictMap(sql) {
  const rows = await sql`select id, country_id, state_province_id, code, name from districts where deleted_at is null`;
  const byCode = new Map(), byName = new Map();
  for (const r of rows) {
    if (r.code) byCode.set(`${r.state_province_id}|${r.code}`, r.id);
    byName.set(`${r.state_province_id}|${lowerKey(r.name)}`, r.id);
  }
  return { byCode, byName };
}
async function loadCityMap(sql) {
  const rows = await sql`select id, country_id, state_province_id, district_id, code, name from cities where deleted_at is null`;
  const byName = new Map();
  for (const r of rows) byName.set(`${r.country_id}|${r.state_province_id ?? ""}|${r.district_id ?? ""}|${lowerKey(r.name)}`, r.id);
  return { byName };
}

async function importStates(sql, sourceDir, countryMap) {
  const file = requireFile(sourceDir, "admin1CodesASCII.txt");
  const rows = [];
  for (const line of readLines(file)) {
    const c = splitTsv(line);
    const [iso2, code] = String(c[0] || "").split(".");
    const country_id = countryMap.get((iso2 || "").toUpperCase());
    const name = clean(c[1]) || clean(c[2]);
    if (!country_id || !code || !name || code === "00") continue;
    rows.push({ country_id, code, name });
  }
  let inserted = 0;
  await batch(rows, 1000, async chunk => {
    const res = await sql`
      with input as (
        select * from jsonb_to_recordset(${sql.json(chunk)}::jsonb) as x(country_id uuid, code text, name text)
      ), ins as (
        insert into states_provinces (country_id, code, name, is_active)
        select i.country_id, i.code, i.name, true from input i
        where not exists (
          select 1 from states_provinces s where s.country_id=i.country_id and lower(s.name)=lower(i.name) and s.deleted_at is null
        )
        returning 1
      ) select count(*)::int as count from ins`;
    inserted += res[0].count;
  });
  return { total: rows.length, inserted, updatedOrExisting: rows.length - inserted };
}

async function importDistricts(sql, sourceDir, countryMap, stateMap) {
  const file = requireFile(sourceDir, "admin2Codes.txt");
  const rows = [];
  for (const line of readLines(file)) {
    const c = splitTsv(line);
    const parts = String(c[0] || "").split(".");
    if (parts.length < 3) continue;
    const [iso2, admin1, admin2] = parts;
    const country_id = countryMap.get(iso2.toUpperCase());
    const state_province_id = country_id ? stateMap.byCode.get(`${country_id}|${admin1}`) : null;
    const name = clean(c[1]) || clean(c[2]);
    if (!country_id || !state_province_id || !admin2 || !name) continue;
    rows.push({ country_id, state_province_id, code: admin2, name });
  }
  let inserted = 0;
  await batch(rows, 1000, async chunk => {
    const res = await sql`
      with input as (
        select * from jsonb_to_recordset(${sql.json(chunk)}::jsonb) as x(country_id uuid, state_province_id uuid, code text, name text)
      ), ins as (
        insert into districts (country_id, state_province_id, code, name, is_active)
        select i.country_id, i.state_province_id, i.code, i.name, true from (select distinct on (state_province_id, lower(name)) * from input order by state_province_id, lower(name), code) i
        where not exists (
          select 1 from districts d where d.state_province_id=i.state_province_id and lower(d.name)=lower(i.name) and d.deleted_at is null
        )
        returning 1
      ) select count(*)::int as count from ins`;
    inserted += res[0].count;
  });
  return { total: rows.length, inserted, updatedOrExisting: rows.length - inserted };
}

async function importCities(sql, sourceDir, countryMap, stateMap, districtMap) {
  const candidates = ["cities500.txt", "cities1000.txt", "cities15000.txt", "allCountries.txt"];
  const file = candidates.map(n => path.join(sourceDir, n)).find(fs.existsSync);
  if (!file) throw new Error(`Missing city dump. Put one of ${candidates.join(", ")} in ${sourceDir}`);
  const rows = [];
  let skipped = 0;
  for (const line of readLines(file)) {
    const c = splitTsv(line);
    if (c[6] !== "P") { skipped++; continue; }
    const iso2 = clean(c[8])?.toUpperCase();
    const country_id = iso2 ? countryMap.get(iso2) : null;
    if (!country_id) { skipped++; continue; }
    const admin1 = clean(c[10]);
    const admin2 = clean(c[11]);
    const state_province_id = admin1 ? stateMap.byCode.get(`${country_id}|${admin1}`) ?? null : null;
    const district_id = state_province_id && admin2 ? districtMap.byCode.get(`${state_province_id}|${admin2}`) ?? null : null;
    const name = clean(c[1]);
    if (!name) { skipped++; continue; }
    rows.push({ country_id, state_province_id, district_id, name, code: clean(c[0]) });
  }
  let inserted = 0;
  await batch(rows, 2000, async chunk => {
    const res = await sql`
      with input as (
        select * from jsonb_to_recordset(${sql.json(chunk)}::jsonb) as x(country_id uuid, state_province_id uuid, district_id uuid, name text, code text)
      ), dedup as (
        select distinct on (country_id, state_province_id, district_id, lower(name)) * from input
      ), ins as (
        insert into cities (country_id, state_province_id, district_id, name, code, is_active)
        select i.country_id, i.state_province_id, i.district_id, i.name, i.code, true from dedup i
        where not exists (
          select 1 from cities c where c.country_id=i.country_id and coalesce(c.state_province_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(i.state_province_id,'00000000-0000-0000-0000-000000000000'::uuid) and coalesce(c.district_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(i.district_id,'00000000-0000-0000-0000-000000000000'::uuid) and lower(c.name)=lower(i.name) and c.deleted_at is null
        )
        returning 1
      ) select count(*)::int as count from ins`;
    inserted += res[0].count;
  });
  return { file: path.basename(file), total: rows.length, inserted, updatedOrExisting: rows.length - inserted, skipped };
}

async function importPostalCodes(sql, sourceDir, countryMap, stateMap, districtMap, cityMap) {
  const file = path.join(sourceDir, "allCountriesPostal.txt");
  if (!fs.existsSync(file)) return { skipped: true, reason: `Missing ${file}` };
  const rows = [];
  let skipped = 0;
  for (const line of readLines(file)) {
    const c = splitTsv(line);
    const iso2 = clean(c[0])?.toUpperCase();
    const country_id = iso2 ? countryMap.get(iso2) : null;
    const postal_code = clean(c[1]);
    const place_name = clean(c[2]);
    if (!country_id || !postal_code || !place_name) { skipped++; continue; }
    const admin1_code = clean(c[4]);
    const admin2_code = clean(c[6]);
    const state_province_id = admin1_code ? stateMap.byCode.get(`${country_id}|${admin1_code}`) ?? null : null;
    const district_id = state_province_id && admin2_code ? districtMap.byCode.get(`${state_province_id}|${admin2_code}`) ?? null : null;
    const city_id = cityMap.byName.get(`${country_id}|${state_province_id ?? ""}|${district_id ?? ""}|${lowerKey(place_name)}`) ?? null;
    rows.push({
      country_id, state_province_id, district_id, city_id, country_code: iso2, postal_code, place_name,
      admin1_name: clean(c[3]), admin1_code, admin2_name: clean(c[5]), admin2_code, admin3_name: clean(c[7]), admin3_code: clean(c[8]),
      latitude: clean(c[9]), longitude: clean(c[10]), accuracy: clean(c[11])
    });
  }
  let inserted = 0;
  await batch(rows, 3000, async chunk => {
    const res = await sql`
      with input as (
        select * from jsonb_to_recordset(${sql.json(chunk)}::jsonb) as x(
          country_id uuid, state_province_id uuid, district_id uuid, city_id uuid, country_code text, postal_code text, place_name text,
          admin1_name text, admin1_code text, admin2_name text, admin2_code text, admin3_name text, admin3_code text,
          latitude numeric, longitude numeric, accuracy text
        )
      ), dedup as (
        select distinct on (country_id, postal_code, lower(place_name), coalesce(admin1_code,''), coalesce(admin2_code,''), coalesce(admin3_code,'')) *
        from input
        order by country_id, postal_code, lower(place_name), coalesce(admin1_code,''), coalesce(admin2_code,''), coalesce(admin3_code,''), place_name
      ), ins as (
        insert into postal_codes (country_id, state_province_id, district_id, city_id, country_code, postal_code, place_name, admin1_name, admin1_code, admin2_name, admin2_code, admin3_name, admin3_code, latitude, longitude, accuracy)
        select i.country_id, i.state_province_id, i.district_id, i.city_id, i.country_code, i.postal_code, i.place_name, i.admin1_name, i.admin1_code, i.admin2_name, i.admin2_code, i.admin3_name, i.admin3_code, i.latitude, i.longitude, i.accuracy from dedup i
        where not exists (
          select 1 from postal_codes p where p.country_id=i.country_id and p.postal_code=i.postal_code and lower(p.place_name)=lower(i.place_name) and coalesce(p.admin1_code,'')=coalesce(i.admin1_code,'') and coalesce(p.admin2_code,'')=coalesce(i.admin2_code,'') and coalesce(p.admin3_code,'')=coalesce(i.admin3_code,'') and p.deleted_at is null
        )
        returning 1
      ) select count(*)::int as count from ins`;
    inserted += res[0].count;
  });
  await sql`
    update cities c set zip_code = p.postal_code, updated_at = now()
    from (
      select distinct on (city_id) city_id, postal_code from postal_codes where city_id is not null and deleted_at is null order by city_id, postal_code
    ) p
    where c.id = p.city_id and (c.zip_code is null or c.zip_code = '')`;
  return { total: rows.length, inserted, updatedOrExisting: rows.length - inserted, skipped };
}

async function verify(sql) {
  const [row] = await sql`
    select
      (select count(*)::int from countries where deleted_at is null) as countries,
      (select count(*)::int from states_provinces where deleted_at is null) as states,
      (select count(*)::int from districts where deleted_at is null) as districts,
      (select count(*)::int from cities where deleted_at is null) as cities,
      (select count(*)::int from areas_locations where deleted_at is null) as areas,
      (select count(*)::int from postal_codes where deleted_at is null) as postal_codes`;
  return row;
}

function printDownloadHelp(sourceDir) {
  console.log(`\nGeoNames source files are missing in ${sourceDir}.`);
  console.log("Download/extract these files into that folder:");
  console.log("  https://download.geonames.org/export/dump/countryInfo.txt");
  console.log("  https://download.geonames.org/export/dump/admin1CodesASCII.txt");
  console.log("  https://download.geonames.org/export/dump/admin2Codes.txt");
  console.log("  https://download.geonames.org/export/dump/cities500.zip -> extract cities500.txt");
  console.log("  https://download.geonames.org/export/zip/allCountries.zip -> extract and rename allCountries.txt to allCountriesPostal.txt");
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing in .env.local");
  const sourceDir = path.resolve(String(args.get("--source") || DEFAULT_SOURCE));
  const confirm = args.has("--confirm-import-world-locations");
  if (!confirm) throw new Error("Refusing to import without --confirm-import-world-locations");
  const required = ["countryInfo.txt", "admin1CodesASCII.txt", "admin2Codes.txt"];
  if (required.some(n => !fs.existsSync(path.join(sourceDir, n)))) { printDownloadHelp(sourceDir); process.exit(2); }
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 30 });
  try {
    console.log("Applying location migration...");
    await ensureMigration(sql);
    console.log("Importing countries...");
    const countries = await importCountries(sql, sourceDir);
    const countryMap = await loadCountryMap(sql);
    console.log("Importing states/provinces...");
    const states = await importStates(sql, sourceDir, countryMap);
    const stateMap = await loadStateMap(sql);
    console.log("Importing districts/admin2...");
    const districts = await importDistricts(sql, sourceDir, countryMap, stateMap);
    const districtMap = await loadDistrictMap(sql);
    console.log("Importing cities...");
    const cities = await importCities(sql, sourceDir, countryMap, stateMap, districtMap);
    const cityMap = await loadCityMap(sql);
    console.log("Importing postal codes if present...");
    const postal = await importPostalCodes(sql, sourceDir, countryMap, stateMap, districtMap, cityMap);
    const totals = await verify(sql);
    console.log(JSON.stringify({ countries, states, districts, cities, postal, totals }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(err => { console.error(err); process.exit(1); });

