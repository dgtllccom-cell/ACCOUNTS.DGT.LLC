import postgres from "postgres";
import fs from "fs";

// Only these 4 countries are legitimate business operating countries:
const ALLOWED_COUNTRY_CODES = ["PK", "AE", "AF", "IN"];
const ALLOWED_COUNTRY_NAMES = ["Pakistan", "United Arab Emirates", "Afghanistan", "India"];

async function main() {
  const isApply = process.argv.includes("--apply");

  let dbUrl = "";
  const envPath = fs.existsSync(".env.local") 
    ? ".env.local" 
    : (fs.existsSync("/var/www/dgt-nextjs/.env.local") ? "/var/www/dgt-nextjs/.env.local" : ".env");

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        dbUrl = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }

  console.log(`[Target Database]: ${dbUrl ? dbUrl.replace(/:[^:@]+@/, ":***@") : "NONE"}`);
  console.log(`[Execution Mode]: ${isApply ? "APPLY CHANGES" : "DRY RUN (pass --apply to execute)"}\n`);

  if (!dbUrl) {
    console.error("Error: No DATABASE_URL found!");
    process.exit(1);
  }

  const sql = postgres(dbUrl, { max: 1 });

  // 1. Identify unauthorized country_accounts
  const unauthorizedCountryAccounts = await sql`
    SELECT ca.id, c.name as country_name, c.iso2, 
           ca.main_account_ledger_id, ca.inter_country_ledger_id, ca.investment_ledger_id
    FROM public.country_accounts ca
    JOIN public.countries c ON c.id = ca.country_id
    WHERE c.iso2 NOT IN ('PK', 'AE', 'AF', 'IN')
      AND ca.deleted_at IS NULL;
  `;

  console.log(`=== 1. UNAUTHORIZED COUNTRY ACCOUNTS (${unauthorizedCountryAccounts.length}) ===`);
  console.table(unauthorizedCountryAccounts);

  // Collect all ledger IDs linked directly to unauthorized country_accounts
  const linkedLedgerIds = unauthorizedCountryAccounts.flatMap(ca => [
    ca.main_account_ledger_id,
    ca.inter_country_ledger_id,
    ca.investment_ledger_id
  ]).filter(Boolean);

  // 2. Identify unauthorized ledgers (country, main_branch or any ledger referencing non-4-country or named China/Uzbekistan/etc.)
  const unauthorizedLedgers = await sql`
    SELECT l.id, l.code, l.name, l.currency, l.scope, c.name as country_name, c.iso2
    FROM public.ledgers l
    LEFT JOIN public.countries c ON c.id = l.country_id
    WHERE l.deleted_at IS NULL
      AND (
        l.id = ANY(${linkedLedgerIds}::uuid[])
        OR (l.country_id IS NOT NULL AND c.iso2 NOT IN ('PK', 'AE', 'AF', 'IN'))
        OR (l.scope IN ('country', 'main_branch') AND (c.iso2 IS NULL OR c.iso2 NOT IN ('PK', 'AE', 'AF', 'IN')))
        OR l.code ILIKE '%CHN%' OR l.code ILIKE '%UZB%' OR l.code ILIKE '%IRN%' OR l.code ILIKE '%TJK%' OR l.code ILIKE '%KAZ%' OR l.code ILIKE '%RUS%' OR l.code ILIKE '%TUR%' OR l.code ILIKE '%TKM%' OR l.code ILIKE '%SAU%' 
        OR l.code ILIKE '%-CN' OR l.code ILIKE '%-UZ' OR l.code ILIKE '%-IR' OR l.code ILIKE '%-TJ' OR l.code ILIKE '%-KZ' OR l.code ILIKE '%-RU' OR l.code ILIKE '%-TR' OR l.code ILIKE '%-TM' OR l.code ILIKE '%-SA' OR l.code ILIKE '%-CH' OR l.code ILIKE '%-86' OR l.code ILIKE '%-92'
        OR l.code ILIKE '%CT-%-86%' OR l.code ILIKE '%CT-%-92%' OR l.code ILIKE '%CT-%-CH%'
        OR l.name ILIKE '%China%' OR l.name ILIKE '%Uzbekistan%' OR l.name ILIKE '%Tajikistan%' OR l.name ILIKE '%Kazakhstan%' OR l.name ILIKE '%Russia%' OR l.name ILIKE '%Turkmenistan%' OR l.name ILIKE '%Saudi Arabia%' OR l.name ILIKE '%chian%'
      );
  `;

  console.log(`=== 2. UNAUTHORIZED LEDGERS (${unauthorizedLedgers.length}) ===`);
  console.table(unauthorizedLedgers);

  // 3. Verify that zero transactions exist on these ledgers
  if (unauthorizedLedgers.length > 0) {
    const ledgerIds = unauthorizedLedgers.map(l => l.id);
    let jlCount = 0, rlCount = 0;
    try {
      const q = await sql`SELECT count(*) FROM public.journal_lines WHERE account_id = ANY(${ledgerIds}::uuid[]);`;
      jlCount = Number(q[0].count);
    } catch {}
    try {
      const q = await sql`SELECT count(*) FROM public.roznamcha_lines WHERE ledger_id = ANY(${ledgerIds}::uuid[]);`;
      rlCount = Number(q[0].count);
    } catch {}

    console.log(`[Safety Check]: journal_lines=${jlCount}, roznamcha_lines=${rlCount}`);
    if (jlCount > 0 || rlCount > 0) {
      console.error("ABORT: Some ledgers have transactions! Cannot automatically remove.");
      await sql.end();
      process.exit(1);
    }
  }

  // 4. Identify countries that should be marked is_active = false
  const countriesToDeactivate = await sql`
    SELECT id, name, iso2, is_active
    FROM public.countries
    WHERE iso2 NOT IN ('PK', 'AE', 'AF', 'IN')
      AND is_active = true;
  `;
  console.log(`=== 3. COUNTRIES TO DEACTIVATE (${countriesToDeactivate.length}) ===`);
  console.table(countriesToDeactivate);

  // 5. Apply if requested
  if (isApply) {
    console.log("\n>>> APPLYING CLEANUP...");

    // 0. Update the trigger function so it never auto-creates for other countries again
    await sql`
      create or replace function public.auto_create_country_account()
      returns trigger
      language plpgsql
      security definer
      set search_path = 'public'
      as $$
      declare
        v_main_ledger_id uuid;
        v_inter_ledger_id uuid;
        v_invest_ledger_id uuid;
        v_currency text;
      begin
        if coalesce(NEW.iso2, '') NOT IN ('PK', 'AE', 'AF', 'IN') then
          return NEW;
        end if;

        if exists (select 1 from public.country_accounts where country_id = NEW.id and deleted_at is null) then
          return NEW;
        end if;

        v_currency := coalesce(NEW.currency_code, 'USD');

        insert into public.ledgers (scope, country_id, code, name, currency, normal_balance)
        values ('country', NEW.id, 'CT-MAIN-' || coalesce(NEW.iso2, left(NEW.name, 3)),
                NEW.name || ' Main Account', v_currency, 'debit')
        returning id into v_main_ledger_id;

        insert into public.ledgers (scope, country_id, code, name, currency, normal_balance)
        values ('country', NEW.id, 'CT-INTER-' || coalesce(NEW.iso2, left(NEW.name, 3)),
                NEW.name || ' Inter-Country Account', v_currency, 'debit')
        returning id into v_inter_ledger_id;

        insert into public.ledgers (scope, country_id, code, name, currency, normal_balance)
        values ('country', NEW.id, 'CT-INVEST-' || coalesce(NEW.iso2, left(NEW.name, 3)),
                NEW.name || ' Investment Account', 'USD', 'credit')
        returning id into v_invest_ledger_id;

        insert into public.country_accounts (country_id, main_account_ledger_id, inter_country_ledger_id, investment_ledger_id)
        values (NEW.id, v_main_ledger_id, v_inter_ledger_id, v_invest_ledger_id);

        return NEW;
      end;
      $$;
    `;
    console.log("✔ Restricted public.auto_create_country_account() to PK, AE, AF, IN");

    // A. Soft-delete unauthorized country_accounts
    if (unauthorizedCountryAccounts.length > 0) {
      const caIds = unauthorizedCountryAccounts.map(ca => ca.id);
      await sql`
        UPDATE public.country_accounts 
        SET deleted_at = NOW(), status = 'closed', updated_at = NOW()
        WHERE id = ANY(${caIds}::uuid[]);
      `;
      console.log(`✔ Soft-deleted ${caIds.length} country_accounts`);
    }

    // B. Soft-delete and deactivate unauthorized ledgers
    if (unauthorizedLedgers.length > 0) {
      const lIds = unauthorizedLedgers.map(l => l.id);
      await sql`
        UPDATE public.ledgers
        SET deleted_at = NOW(), is_active = false, updated_at = NOW()
        WHERE id = ANY(${lIds}::uuid[]);
      `;
      console.log(`✔ Soft-deleted and deactivated ${lIds.length} ledgers`);
    }

    // C. Deactivate non-4-country records in public.countries
    if (countriesToDeactivate.length > 0) {
      const cIds = countriesToDeactivate.map(c => c.id);
      await sql`
        UPDATE public.countries
        SET is_active = false, updated_at = NOW()
        WHERE id = ANY(${cIds}::uuid[]);
      `;
      console.log(`✔ Deactivated ${cIds.length} countries (only PK, AE, AF, IN remain active)`);
    }

    // D. Check country_branches for China or non-4 countries
    const badBranches = await sql`
      SELECT cb.id, cb.name, cb.code, c.name as country_name
      FROM public.country_branches cb
      JOIN public.countries c ON c.id = cb.country_id
      WHERE c.iso2 NOT IN ('PK', 'AE', 'AF', 'IN')
        AND cb.deleted_at IS NULL;
    `;
    if (badBranches.length > 0) {
      const bIds = badBranches.map(b => b.id);
      await sql`
        UPDATE public.country_branches
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = ANY(${bIds}::uuid[]);
      `;
      console.log(`✔ Soft-deleted ${bIds.length} unauthorized country_branches`);
    }

    // E. Remove duplicate typo country records like 'AFGHISTAN' or 'پاکستان'
    const typoCountries = await sql`
      SELECT id, name FROM public.countries 
      WHERE name IN ('AFGHISTAN', 'پاکستان', 'chian') AND deleted_at IS NULL;
    `;
    if (typoCountries.length > 0) {
      const tcIds = typoCountries.map(c => c.id);
      await sql`UPDATE public.country_accounts SET deleted_at = NOW(), status = 'closed', updated_at = NOW() WHERE country_id = ANY(${tcIds}::uuid[]);`;
      await sql`UPDATE public.ledgers SET deleted_at = NOW(), is_active = false, updated_at = NOW() WHERE country_id = ANY(${tcIds}::uuid[]);`;
      await sql`UPDATE public.countries SET deleted_at = NOW(), is_active = false, updated_at = NOW() WHERE id = ANY(${tcIds}::uuid[]);`;
      console.log(`✔ Soft-deleted ${tcIds.length} duplicate typo countries and their accounts/ledgers`);
    }

    console.log("\n>>> CLEANUP COMPLETE SUCCESSFULLY! ✔");
  } else {
    console.log("\n[Notice]: Re-run with --apply to commit these changes.");
  }

  await sql.end();
}

main().catch(console.error);
