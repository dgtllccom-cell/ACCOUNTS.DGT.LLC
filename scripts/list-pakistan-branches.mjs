import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false }
});

const { data: country, error: countryError } = await supabase
  .from("countries")
  .select("id,name,iso2,currency_code")
  .ilike("name", "%Pakistan%")
  .single();
if (countryError) throw new Error(countryError.message);

const [{ data: branches, error: branchError }, { data: cityBranches, error: cityError }] = await Promise.all([
  supabase.from("country_branches").select("id,name,code,country_id").eq("country_id", country.id),
  supabase
    .from("city_branches")
    .select("id,name,code,city_name,country_branch_id,country_id")
    .eq("country_id", country.id)
    .order("created_at", { ascending: true })
]);

if (branchError) throw new Error(branchError.message);
if (cityError) throw new Error(cityError.message);

console.log(JSON.stringify({ country, branches, cityBranches }, null, 2));
