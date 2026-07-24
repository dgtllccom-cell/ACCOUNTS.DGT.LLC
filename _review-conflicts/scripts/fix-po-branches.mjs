import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}

async function fixBranches() {
  loadEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, idle_timeout: 1, prepare: false });

  // Find Pakistan
  const [pakistan] = await sql`select id, name from countries where name ilike '%Pakistan%' and deleted_at is null limit 1`;
  if (!pakistan) throw new Error("Pakistan not found");

  // Find Main Branch
  const [mainBranch] = await sql`select id, name from country_branches where country_id=${pakistan.id} and deleted_at is null order by created_at asc limit 1`;
  
  // Find Quinajees (Quetta) City Branch
  const [quetta] = await sql`select id, name, code from city_branches where country_id=${pakistan.id} and deleted_at is null and (name ilike '%QUINAJEES%' or city_name ilike '%QUINAJEES%' or name ilike '%Quetta%') limit 1`;
  if (!quetta) throw new Error("Quetta/Quinajees branch not found");

  // Find POs missing branch
  const missing = await sql`select id, purchase_order_no, form_data from purchase_orders where city_branch_id is null and deleted_at is null order by created_at asc`;
  console.log(`Found ${missing.length} Purchase Orders missing branch/country.`);

  // Load all countries and branches
  const countries = await sql`select id, name from countries where deleted_at is null`;
  const mainBranches = await sql`select id, country_id, name from country_branches where deleted_at is null`;
  const cityBranches = await sql`select id, country_id, name, code from city_branches where deleted_at is null`;

  let updated = 0;

  await sql.begin(async (tx) => {
    for (const po of missing) {
      const form = po.form_data?.form || {};
      const destCountry = form.destinationCountry || form.receivedCountry || form.deliveryCountry || "Pakistan"; // Default to Pakistan if none

      // Find best matching country
      const country = countries.find(c => c.name.toLowerCase().includes(destCountry.toLowerCase().trim())) || countries.find(c => c.name.toLowerCase().includes("pakistan"));
      if (!country) continue;

      const mainBranch = mainBranches.find(b => b.country_id === country.id);
      const cityBranch = cityBranches.find(b => b.country_id === country.id);
      if (!mainBranch || !cityBranch) continue;

      // Get max sequences
      const [maxes] = await tx`
        select 
          coalesce(max((regexp_match(country_transaction_serial_number, '([0-9]+)$'))[1]::bigint), 0) as max_country,
          coalesce(max((regexp_match(branch_transaction_serial_number, '([0-9]+)$'))[1]::bigint), 0) as max_branch
        from purchase_orders
        where country_id=${country.id} and city_branch_id=${cityBranch.id}
      `;

      const countrySeq = Number(maxes.max_country || 0) + 1;
      const branchSeq = Number(maxes.max_branch || 0) + 1;

      const cCode = country.name.toLowerCase().includes("arab") ? "UAE" : "PAK";
      const bCode = cityBranch.code || "BR";

      const countrySerial = `${cCode}-${String(countrySeq).padStart(6, "0")}`;
      const branchSerial = `${cCode}-${bCode}-${String(branchSeq).padStart(6, "0")}`;

      await tx`
        update purchase_orders
        set 
          country_id = ${country.id},
          country_branch_id = ${mainBranch.id},
          city_branch_id = ${cityBranch.id},
          country_transaction_serial_number = ${countrySerial},
          branch_transaction_serial_number = ${branchSerial}
        where id = ${po.id}
      `;

      updated++;
    }
  });

  console.log(`Successfully completed ${updated} Purchase Orders with Country, Branch, and Serial Numbers!`);
  await sql.end();
}

fixBranches().catch(console.error);
