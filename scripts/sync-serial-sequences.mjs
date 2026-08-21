import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  console.log("=== SYNCHRONIZING TRANSACTION SERIAL SEQUENCES ===");

  // 1. For each branch in roznamcha_entries, find max numerical serial
  const branchSerials = await sql`
    SELECT 
      city_branch_id,
      country_branch_id,
      country_id,
      branch_transaction_serial_number,
      country_transaction_serial_number,
      super_admin_serial_number
    FROM roznamcha_entries
    WHERE deleted_at IS NULL;
  `;

  const maxCityBranch = {};
  const maxCountryBranch = {};
  const maxCountry = {};
  let maxGlobal = 0;

  for (const row of branchSerials) {
    if (row.super_admin_serial_number) {
      const n = parseInt(row.super_admin_serial_number.replace(/\D/g, ''), 10);
      if (n > maxGlobal) maxGlobal = n;
    }
    if (row.country_id && row.country_transaction_serial_number) {
      const n = parseInt(row.country_transaction_serial_number.replace(/\D/g, ''), 10);
      if (!maxCountry[row.country_id] || n > maxCountry[row.country_id]) {
        maxCountry[row.country_id] = n;
      }
    }
    if (row.country_branch_id && row.branch_transaction_serial_number) {
      const n = parseInt(row.branch_transaction_serial_number.replace(/\D/g, ''), 10);
      if (!maxCountryBranch[row.country_branch_id] || n > maxCountryBranch[row.country_branch_id]) {
        maxCountryBranch[row.country_branch_id] = n;
      }
    }
    if (row.city_branch_id && row.branch_transaction_serial_number) {
      const n = parseInt(row.branch_transaction_serial_number.replace(/\D/g, ''), 10);
      if (!maxCityBranch[row.city_branch_id] || n > maxCityBranch[row.city_branch_id]) {
        maxCityBranch[row.city_branch_id] = n;
      }
    }
  }

  console.log("Max Global:", maxGlobal);
  console.log("Max Country:", maxCountry);
  console.log("Max Country Branch:", maxCountryBranch);
  console.log("Max City Branch:", maxCityBranch);

  // Update Global
  if (maxGlobal > 0) {
    await sql`
      UPDATE transaction_serial_sequences 
      SET next_value = GREATEST(next_value, ${maxGlobal + 1})
      WHERE scope_type = 'global';
    `;
  }

  // Update Countries
  for (const [cId, maxN] of Object.entries(maxCountry)) {
    await sql`
      UPDATE transaction_serial_sequences 
      SET next_value = GREATEST(next_value, ${maxN + 1})
      WHERE scope_type = 'country' AND scope_key = ${cId};
    `;
  }

  // Update Country Branches
  for (const [cbId, maxN] of Object.entries(maxCountryBranch)) {
    await sql`
      UPDATE transaction_serial_sequences 
      SET next_value = GREATEST(next_value, ${maxN + 1})
      WHERE scope_key = ${cbId};
    `;
  }

  // Update City Branches
  for (const [cityId, maxN] of Object.entries(maxCityBranch)) {
    await sql`
      UPDATE transaction_serial_sequences 
      SET next_value = GREATEST(next_value, ${maxN + 1})
      WHERE scope_key = ${cityId};
    `;
  }

  // Also enhance next_entity_serial to avoid collisions if table has higher number
  await sql`
    CREATE OR REPLACE FUNCTION public.next_entity_serial(
      p_scope_type text,
      p_scope_key text,
      p_entity_type text,
      p_prefix text
    )
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_current bigint;
      v_candidate text;
      v_exists boolean;
      v_pad_len int := 6;
      v_prefix text := UPPER(TRIM(COALESCE(p_prefix, '')));
    BEGIN
      -- Format prefix with trailing hyphen
      IF v_prefix <> '' AND NOT v_prefix LIKE '%-' THEN
        v_prefix := v_prefix || '-';
      END IF;

      -- Lock sequence row or insert if missing
      INSERT INTO transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
      VALUES (p_scope_type, p_scope_key, p_entity_type, COALESCE(NULLIF(p_prefix, ''), 'SEQ'), 1)
      ON CONFLICT (scope_type, scope_key, entity_type)
      DO NOTHING;

      LOOP
        UPDATE transaction_serial_sequences
        SET next_value = next_value + 1,
            updated_at = NOW()
        WHERE scope_type = p_scope_type
          AND scope_key = p_scope_key
          AND entity_type = p_entity_type
        RETURNING next_value - 1 INTO v_current;

        v_candidate := v_prefix || LPAD(v_current::text, v_pad_len, '0');

        -- Verify candidate does not collide with existing roznamcha entry
        IF p_entity_type = 'roznamcha' THEN
          IF p_scope_type = 'global' THEN
            SELECT EXISTS (SELECT 1 FROM roznamcha_entries WHERE super_admin_serial_number = v_candidate) INTO v_exists;
          ELSIF p_scope_type = 'country' THEN
            SELECT EXISTS (SELECT 1 FROM roznamcha_entries WHERE country_id = p_scope_key::uuid AND country_transaction_serial_number = v_candidate) INTO v_exists;
          ELSIF p_scope_type IN ('branch', 'city_branch', 'main_branch') THEN
            SELECT EXISTS (SELECT 1 FROM roznamcha_entries WHERE (city_branch_id = p_scope_key::uuid OR country_branch_id = p_scope_key::uuid) AND branch_transaction_serial_number = v_candidate) INTO v_exists;
          ELSE
            v_exists := false;
          END IF;
        ELSE
          v_exists := false;
        END IF;

        IF NOT v_exists THEN
          EXIT;
        END IF;
      END LOOP;

      RETURN v_candidate;
    END;
    $$;
  `;

  console.log("✅ Serial sequences synchronized and collision-proof loop installed!");

  await sql.end();
}

main().catch(console.error);
