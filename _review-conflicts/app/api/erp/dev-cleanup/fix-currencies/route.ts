import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient() as any;

    const { data: countries, error: countryError } = await supabase.from("countries").select("id, name, currency_code");

    if (countryError || !countries) {
      return NextResponse.json({ error: "Error fetching countries", details: countryError });
    }

    const results = [];

    for (const country of countries) {
      if (!country.currency_code) continue;

      const currency = country.currency_code.toUpperCase();

      const { error: accError, count: accCount } = await supabase
        .from("enterprise_accounts")
        .update({ currency })
        .eq("country_id", country.id);

      const { error: ledgError } = await supabase
        .from("ledgers")
        .update({ currency })
        .eq("country_id", country.id);

      results.push({
        country: country.name,
        currency,
        accError: accError ? accError.message : null,
        ledgError: ledgError ? ledgError.message : null
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
