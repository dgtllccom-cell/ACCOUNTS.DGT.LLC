import postgres from "postgres";
import fs from "fs";

function loadEnv() {
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }
}
loadEnv();

const sql = postgres(process.env.DATABASE_URL, { max: 5 });
const DEFAULT_PASSWORD = ["DgtAdmin", "@", "2026", "!"].join("");

async function main() {
  console.log("==========================================================================");
  console.log("🎯 STANDARDIZING DATABASE TO EXACT 2 COUNTRIES, 3 BRANCHES, 8 USERS");
  console.log("==========================================================================\n");

  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;

  // 1. Ensure Pakistan & UAE Countries
  const [pkCountry] = await sql`SELECT id, name, iso2 FROM public.countries WHERE upper(iso2) = 'PK' LIMIT 1;`;
  const [aeCountry] = await sql`SELECT id, name, iso2 FROM public.countries WHERE upper(iso2) = 'AE' LIMIT 1;`;

  if (!pkCountry || !aeCountry) {
    throw new Error("Missing PK or AE country in database!");
  }

  console.log(`✓ Pakistan Country ID: ${pkCountry.id}`);
  console.log(`✓ UAE Country ID: ${aeCountry.id}`);

  // Activate only PK and AE, deactivate all other countries
  await sql`
    UPDATE public.countries
    SET is_active = true, deleted_at = NULL
    WHERE id IN (${pkCountry.id}, ${aeCountry.id});
  `;
  const deactivatedCountries = await sql`
    UPDATE public.countries
    SET is_active = false, deleted_at = NOW()
    WHERE id NOT IN (${pkCountry.id}, ${aeCountry.id}) AND deleted_at IS NULL
    RETURNING name;
  `;
  console.log(`✓ Deactivated other countries (${deactivatedCountries.length}):`, deactivatedCountries.map(c => c.name));

  // 2. Main Country Branches: keep only PK Main and UAE Main
  const [pkMainBranch] = await sql`
    SELECT id, name FROM public.country_branches 
    WHERE country_id = ${pkCountry.id} AND (is_main = true OR code = 'PAK-MAIN-001')
    LIMIT 1;
  `;
  const [aeMainBranch] = await sql`
    SELECT id, name FROM public.country_branches 
    WHERE country_id = ${aeCountry.id} AND (is_main = true OR code = 'ARE-MAIN-001')
    LIMIT 1;
  `;

  await sql`
    UPDATE public.country_branches
    SET deleted_at = NULL, is_main = true
    WHERE id IN (${pkMainBranch.id}, ${aeMainBranch.id});
  `;
  const deactivatedMainBranches = await sql`
    UPDATE public.country_branches
    SET deleted_at = NOW()
    WHERE id NOT IN (${pkMainBranch.id}, ${aeMainBranch.id}) AND deleted_at IS NULL
    RETURNING name;
  `;
  console.log(`✓ Deactivated other main branches (${deactivatedMainBranches.length}):`, deactivatedMainBranches.map(b => b.name));

  // 3. City Branches: keep only Quetta, Chaman (under PK), Deira Dubai (under AE)
  const [quettaBranch] = await sql`
    SELECT id, name FROM public.city_branches 
    WHERE code = 'PAK-QUE-001'
    LIMIT 1;
  `;
  const [chamanBranch] = await sql`
    SELECT id, name FROM public.city_branches 
    WHERE code = 'PAK-CHM-001'
    LIMIT 1;
  `;
  const [deiraBranch] = await sql`
    SELECT id, name FROM public.city_branches 
    WHERE code = 'UAE-DEI-001'
    LIMIT 1;
  `;

  if (!quettaBranch || !chamanBranch || !deiraBranch) {
    throw new Error("Missing Quetta, Chaman, or Deira city branch!");
  }

  console.log(`✓ Quetta City Branch ID: ${quettaBranch.id} (${quettaBranch.name})`);
  console.log(`✓ Chaman City Branch ID: ${chamanBranch.id} (${chamanBranch.name})`);
  console.log(`✓ Deira Dubai City Branch ID: ${deiraBranch.id} (${deiraBranch.name})`);

  // Activate the 3 exact branches
  await sql`
    UPDATE public.city_branches
    SET status = 'active', deleted_at = NULL,
        country_id = ${pkCountry.id}, country_branch_id = ${pkMainBranch.id}
    WHERE id = ${quettaBranch.id};
  `;
  await sql`
    UPDATE public.city_branches
    SET status = 'active', deleted_at = NULL,
        country_id = ${pkCountry.id}, country_branch_id = ${pkMainBranch.id}
    WHERE id = ${chamanBranch.id};
  `;
  await sql`
    UPDATE public.city_branches
    SET status = 'active', deleted_at = NULL,
        country_id = ${aeCountry.id}, country_branch_id = ${aeMainBranch.id}
    WHERE id = ${deiraBranch.id};
  `;

  // Deactivate all other city branches
  const deactivatedCityBranches = await sql`
    UPDATE public.city_branches
    SET status = 'inactive', deleted_at = NOW()
    WHERE id NOT IN (${quettaBranch.id}, ${chamanBranch.id}, ${deiraBranch.id})
      AND deleted_at IS NULL
    RETURNING name, code;
  `;
  console.log(`✓ Deactivated other city branches (${deactivatedCityBranches.length})`);

  // 4. Clearing Agent Branches: deactivate foreign ones
  await sql`
    UPDATE public.clearing_agent_branches
    SET deleted_at = NOW()
    WHERE code IN ('CA-AF-NMR-01', 'CA-IR-BND-01');
  `;
  console.log("✓ Deactivated foreign clearing agent branches.");

  // 5. Standardize EXACT 8 Users
  // In user_role_scope_chk:
  // - super_admin: country_id IS NULL, country_branch_id IS NULL, city_branch_id IS NULL
  // - country_admin: country_id IS NOT NULL, country_branch_id IS NULL, city_branch_id IS NULL
  // - city_branch_admin: country_id IS NOT NULL, country_branch_id IS NOT NULL, city_branch_id IS NOT NULL
  const targetUsers = [
    // 3 Global Users
    {
      email: "superadmin@dgt.llc",
      fullName: "Super Admin (Global Group)",
      userCode: "SUPERADMIN",
      role: "super_admin",
      countryId: null,
      countryBranchId: null,
      cityBranchId: null
    },
    {
      email: "all.superadmin@dgt.llc",
      fullName: "All SuperAdmin (Global Group)",
      userCode: "ALL.SUPERADMIN",
      role: "super_admin",
      countryId: null,
      countryBranchId: null,
      cityBranchId: null
    },
    {
      email: "audit.superadmin@dgt.llc",
      fullName: "Audit SuperAdmin (Global Group)",
      userCode: "AUDIT.SUPERADMIN",
      role: "super_admin",
      countryId: null,
      countryBranchId: null,
      cityBranchId: null
    },
    // 2 Country Admin Users
    {
      email: "pakistan.admin@dgt.llc",
      fullName: "Pakistan Country Admin",
      userCode: "PAKISTAN.ADMIN",
      role: "country_admin",
      countryId: pkCountry.id,
      countryBranchId: null,
      cityBranchId: null
    },
    {
      email: "uae.admin@dgt.llc",
      fullName: "UAE Country Admin",
      userCode: "UAE.ADMIN",
      role: "country_admin",
      countryId: aeCountry.id,
      countryBranchId: null,
      cityBranchId: null
    },
    // 3 City Admin Users
    {
      email: "quetta.branch@dgt.llc",
      fullName: "Quetta City Admin",
      userCode: "QUETTA.ADMIN",
      role: "city_branch_admin",
      countryId: pkCountry.id,
      countryBranchId: pkMainBranch.id,
      cityBranchId: quettaBranch.id
    },
    {
      email: "chaman.branch@dgt.llc",
      fullName: "Chaman City Admin",
      userCode: "CHAMAN.ADMIN",
      role: "city_branch_admin",
      countryId: pkCountry.id,
      countryBranchId: pkMainBranch.id,
      cityBranchId: chamanBranch.id
    },
    {
      email: "dubai.branch@dgt.llc",
      fullName: "Deira Dubai City Admin",
      userCode: "DUBAI.ADMIN",
      role: "city_branch_admin",
      countryId: aeCountry.id,
      countryBranchId: aeMainBranch.id,
      cityBranchId: deiraBranch.id
    }
  ];

  const targetUserIds = [];

  for (const tu of targetUsers) {
    // 1. Check or insert in auth.users
    let [authUser] = await sql`SELECT id FROM auth.users WHERE email = ${tu.email};`;
    if (!authUser) {
      [authUser] = await sql`
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
          created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(),
          'authenticated',
          'authenticated',
          ${tu.email},
          crypt(${DEFAULT_PASSWORD}, gen_salt('bf', 10)),
          NOW(), NOW(), NOW(),
          '{"provider":"email","providers":["email"]}',
          ${JSON.stringify({ role: tu.role, full_name: tu.fullName })},
          ${tu.role === "super_admin"}
        ) RETURNING id;
      `;
    } else {
      await sql`
        UPDATE auth.users
        SET encrypted_password = crypt(${DEFAULT_PASSWORD}, gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_user_meta_data = ${JSON.stringify({ role: tu.role, full_name: tu.fullName })},
            updated_at = NOW()
        WHERE id = ${authUser.id};
      `;
    }

    const userId = authUser.id;
    targetUserIds.push(userId);

    // 2. Ensure profile
    const [profile] = await sql`SELECT id FROM public.profiles WHERE id = ${userId};`;
    if (!profile) {
      await sql`
        INSERT INTO public.profiles (
          id, full_name, user_code, raw_password, created_at, updated_at
        ) VALUES (
          ${userId}, ${tu.fullName}, ${tu.userCode}, ${DEFAULT_PASSWORD}, NOW(), NOW()
        );
      `;
    } else {
      await sql`
        UPDATE public.profiles
        SET full_name = ${tu.fullName},
            user_code = ${tu.userCode},
            raw_password = ${DEFAULT_PASSWORD},
            deleted_at = NULL,
            updated_at = NOW()
        WHERE id = ${userId};
      `;
    }

    // 3. Ensure active user_role_assignment
    await sql`
      DELETE FROM public.user_role_assignments WHERE user_id = ${userId};
    `;
    await sql`
      INSERT INTO public.user_role_assignments (
        user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at, updated_at
      ) VALUES (
        ${userId}, ${tu.role}, ${tu.countryId}, ${tu.countryBranchId}, ${tu.cityBranchId}, true, NOW(), NOW()
      );
    `;

    console.log(`✓ User active: ${tu.email} (${tu.role}) -> ID: ${userId}`);
  }

  // 6. Deactivate all OTHER user role assignments so they do not show up anywhere
  const deactivatedAssignments = await sql`
    UPDATE public.user_role_assignments
    SET is_active = false, deleted_at = NOW()
    WHERE user_id NOT IN ${sql(targetUserIds)} AND (is_active = true OR deleted_at IS NULL)
    RETURNING id, user_id, role;
  `;
  console.log(`✓ Deactivated other user role assignments (${deactivatedAssignments.length})`);

  console.log("\n==========================================================================");
  console.log("✅ STANDARDIZATION COMPLETE: EXACT 2 COUNTRIES, 3 CITY BRANCHES, 8 USERS");
  console.log("==========================================================================");

  await sql.end();
}

main().catch(err => {
  console.error("Error standardizing:", err);
  process.exit(1);
});
