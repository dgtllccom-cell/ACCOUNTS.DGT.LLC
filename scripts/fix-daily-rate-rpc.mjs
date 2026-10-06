import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  console.log("Dropping and recreating get_daily_rate functions...");

  await sql`DROP FUNCTION IF EXISTS public.get_daily_rate(uuid, uuid, date) CASCADE;`;
  await sql`DROP FUNCTION IF EXISTS public.get_daily_rate(uuid, uuid, text) CASCADE;`;

  // Create unified get_daily_rate(uuid, uuid, text)
  await sql`
    CREATE OR REPLACE FUNCTION public.get_daily_rate(
      p_country_id uuid,
      p_country_branch_id uuid DEFAULT NULL::uuid,
      p_date text DEFAULT NULL::text
    )
    RETURNS TABLE(
      rate_date text,
      buying_rate numeric,
      selling_rate numeric,
      credit_rate numeric,
      debit_rate numeric,
      is_exact_date boolean,
      is_branch_specific boolean
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
      v_target_date date := COALESCE(NULLIF(p_date, '')::date, CURRENT_DATE);
    BEGIN
      RETURN QUERY
      SELECT
        r.rate_date::text,
        r.buying_rate::numeric,
        r.selling_rate::numeric,
        r.credit_rate::numeric,
        r.debit_rate::numeric,
        (r.rate_date = v_target_date) AS is_exact_date,
        (r.country_branch_id IS NOT NULL) AS is_branch_specific
      FROM public.daily_usd_rates r
      WHERE r.deleted_at IS NULL
        AND r.country_id = p_country_id
        AND (p_country_branch_id IS NULL OR r.country_branch_id = p_country_branch_id OR r.country_branch_id IS NULL)
        AND r.rate_date <= v_target_date
      ORDER BY
        (r.country_branch_id IS NOT NULL) DESC,
        r.rate_date DESC
      LIMIT 1;
    END;
    $$;
  `;

  // Create overloaded get_daily_rate(uuid, uuid, date)
  await sql`
    CREATE OR REPLACE FUNCTION public.get_daily_rate(
      p_country_id uuid,
      p_country_branch_id uuid,
      p_date date
    )
    RETURNS TABLE(
      rate_date text,
      buying_rate numeric,
      selling_rate numeric,
      credit_rate numeric,
      debit_rate numeric,
      is_exact_date boolean,
      is_branch_specific boolean
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    BEGIN
      RETURN QUERY
      SELECT * FROM public.get_daily_rate(p_country_id, p_country_branch_id, p_date::text);
    END;
    $$;
  `;

  console.log("Successfully created unified get_daily_rate functions!");

  // Test
  const countries = await sql`SELECT id, name FROM countries WHERE deleted_at IS NULL;`;
  for (const c of countries) {
    const [rateText] = await sql`SELECT * FROM get_daily_rate(${c.id}, null, ${'2026-08-21'}::text);`;
    const [rateDate] = await sql`SELECT * FROM get_daily_rate(${c.id}, null, ${'2026-08-21'}::date);`;
    console.log(`Rate for ${c.name} (text arg):`, rateText);
    console.log(`Rate for ${c.name} (date arg):`, rateDate);
  }

  await sql.end();
}

main().catch(console.error);
