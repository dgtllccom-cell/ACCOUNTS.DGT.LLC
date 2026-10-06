import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching countries...");
  const { data: countries, error: countryError } = await supabase.from("countries").select("id, name, currency_code");

  if (countryError || !countries) {
    console.error("Error fetching countries:", countryError);
    return;
  }

  for (const country of countries) {
    if (!country.currency_code) continue;

    console.log(`Fixing currency to ${country.currency_code} for ${country.name}...`);

    // Fix enterprise accounts
    const { error: accError, count: accCount } = await supabase
      .from("enterprise_accounts")
      .update({ currency: country.currency_code.toUpperCase() })
      .eq("country_id", country.id);

    if (accError) {
      console.error(`Failed to update accounts for ${country.name}:`, accError);
    } else {
      console.log(`Updated accounts for ${country.name}`);
    }

    // Fix ledgers
    const { error: ledgError } = await supabase
      .from("ledgers")
      .update({ currency: country.currency_code.toUpperCase() })
      .eq("country_id", country.id);

    if (ledgError) {
      console.error(`Failed to update ledgers for ${country.name}:`, ledgError);
    } else {
      console.log(`Updated ledgers for ${country.name}`);
    }
  }

  console.log("Done fixing currencies.");
}

run();
