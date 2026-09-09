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
  console.log("🎯 DYNAMIC CLEANUP & STANDARDIZATION FOR VPS / LOCAL DATABASE");
  console.log("==========================================================================\n");

  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;

  // 1. Countries
  const countries = await sql`SELECT id, name, iso2 FROM public.countries;`;
  const pkCountry = countries.find(c => (c.iso2 && c.iso2.toUpperCase() === 'PK') || c.name.toLowerCase().includes('pakistan'));
  const aeCountry = countries.find(c => (c.iso2 && c.iso2.toUpperCase() === 'AE') || c.name.toLowerCase().includes('emirates'));

  if (!pkCountry || !aeCountry) {
    throw new Error("Could not find Pakistan or UAE in countries table!");
  }

  console.log(`✓ Pakistan Country: ${pkCountry.name} (${pkCountry.id})`);
  console.log(`✓ UAE Country: ${aeCountry.name} (${aeCountry.id})`);

  await sql`
    UPDATE public.countries
    SET is_active = true, deleted_at = NULL
    WHERE id IN (${pkCountry.id}, ${aeCountry.id});
  `;
  const deactivatedCountries = await sql`
    UPDATE public.countries
    SET is_active = false, deleted_at = NOW()
    WHERE id NOT IN (${pkCountry.id}, ${aeCountry.id}) AND (is_active = true OR deleted_at IS NULL)
    RETURNING name;
  `;
  console.log(`✓ Deactivated other countries (${deactivatedCountries.length})`);

  // 2. Main Branches
  const allMainBranches = await sql`SELECT id, name, code, country_id, is_main FROM public.country_branches;`;
  const pkMain = allMainBranches.find(b => b.country_id === pkCountry.id && (b.is_main || b.code === 'PAK-MAIN-001'));
  const aeMain = allMainBranches.find(b => b.country_id === aeCountry.id && (b.is_main || b.code === 'ARE-MAIN-001'));

  if (!pkMain || !aeMain) {
    throw new Error("Could not find PK or UAE main branch!");
  }

  console.log(`✓ Pakistan Main Branch: ${pkMain.name} (${pkMain.id})`);
  console.log(`✓ UAE Main Branch: ${aeMain.name} (${aeMain.id})`);

  await sql`
    UPDATE public.country_branches
    SET is_main = true, deleted_at = NULL
    WHERE id IN (${pkMain.id}, ${aeMain.id});
  `;
  const deactivatedMain = await sql`
    UPDATE public.country_branches
    SET deleted_at = NOW()
    WHERE id NOT IN (${pkMain.id}, ${aeMain.id}) AND deleted_at IS NULL
    RETURNING name;
  `;
  console.log(`✓ Deactivated other main branches (${deactivatedMain.length})`);

  // 3. City Branches
  const allCityBranches = await sql`SELECT id, name, code, city_name, country_id FROM public.city_branches;`;
  
  // Find Quetta
  const quetta = allCityBranches.find(b => 
    (b.city_name && b.city_name.toLowerCase() === 'quetta') ||
    (b.name && b.name.toLowerCase().includes('quetta'))
  );

  // Find Chaman
  const chaman = allCityBranches.find(b => b.code === 'PAK-CHM-001') ||
                 allCityBranches.find(b => b.name && b.name.toLowerCase() === 'chaman city branch');

  // Find Deira
  const deira = allCityBranches.find(b => 
    (b.city_name && b.city_name.toLowerCase() === 'deira') ||
    (b.name && b.name.toLowerCase().includes('deira'))
  );

  if (!quetta || !chaman || !deira) {
    throw new Error(`Could not find Quetta (${!!quetta}), Chaman (${!!chaman}), or Deira (${!!deira})!`);
  }

  console.log(`✓ Quetta City Branch: ${quetta.name} (${quetta.code}) -> ID: ${quetta.id}`);
  console.log(`✓ Chaman City Branch: ${chaman.name} (${chaman.code}) -> ID: ${chaman.id}`);
  console.log(`✓ Deira City Branch: ${deira.name} (${deira.code}) -> ID: ${deira.id}`);

  await sql`
    UPDATE public.city_branches
    SET status = 'active', deleted_at = NULL,
        country_id = ${pkCountry.id}, country_branch_id = ${pkMain.id}
    WHERE id = ${quetta.id};
  `;
  await sql`
    UPDATE public.city_branches
    SET status = 'active', deleted_at = NULL,
        country_id = ${pkCountry.id}, country_branch_id = ${pkMain.id}
    WHERE id = ${chaman.id};
  `;
  await sql`
    UPDATE public.city_branches
    SET status = 'active', deleted_at = NULL,
        country_id = ${aeCountry.id}, country_branch_id = ${aeMain.id}
    WHERE id = ${deira.id};
  `;

  const deactivatedCity = await sql`
    UPDATE public.city_branches
    SET status = 'inactive', deleted_at = NOW()
    WHERE id NOT IN (${quetta.id}, ${chaman.id}, ${deira.id}) AND (status = 'active' OR deleted_at IS NULL)
    RETURNING name, code;
  `;
  console.log(`✓ Deactivated other city branches (${deactivatedCity.length})`);

  // 4. Clearing agent branches
  const hasClearing = await sql`
    SELECT table_name FROM information_schema.tables WHERE table_name = 'clearing_agent_branches';
  `;
  if (hasClearing.length > 0) {
    await sql`
      UPDATE public.clearing_agent_branches
      SET deleted_at = NOW()
      WHERE code IN ('CA-AF-NMR-01', 'CA-IR-BND-01')
         OR name ILIKE '%nimruz%' OR name ILIKE '%bandar%';
    `;
    console.log("✓ Deactivated foreign clearing agent branches.");
  }

  // 5. Target 8 Users
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
      userCode: "QUETTA.BRANCH",
      role: "city_branch_admin",
      countryId: pkCountry.id,
      countryBranchId: pkMain.id,
      cityBranchId: quetta.id
    },
    {
      email: "chaman.branch@dgt.llc",
      fullName: "Chaman City Admin",
      userCode: "CHAMAN.BRANCH",
      role: "city_branch_admin",
      countryId: pkCountry.id,
      countryBranchId: pkMain.id,
      cityBranchId: chaman.id
    },
    {
      email: "dubai.branch@dgt.llc",
      fullName: "Deira Dubai City Admin",
      userCode: "DUBAI.BRANCH",
      role: "city_branch_admin",
      countryId: aeCountry.id,
      countryBranchId: aeMain.id,
      cityBranchId: deira.id
    }
  ];

  const targetUserIds = [];

  for (const tu of targetUsers) {
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

    // Clear user_code from any other profile to satisfy unique constraint
    await sql`UPDATE public.profiles SET user_code = NULL WHERE user_code = ${tu.userCode} AND id != ${userId};`;

    await sql`
      INSERT INTO public.profiles (
        id, full_name, user_code, raw_password, created_at, updated_at
      ) VALUES (
        ${userId}, ${tu.fullName}, ${tu.userCode}, ${DEFAULT_PASSWORD}, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          user_code = EXCLUDED.user_code,
          raw_password = EXCLUDED.raw_password,
          deleted_at = NULL,
          updated_at = NOW();
    `;

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

  // Deactivate all OTHER user role assignments
  const deactivatedAssignments = await sql`
    UPDATE public.user_role_assignments
    SET is_active = false, deleted_at = NOW()
    WHERE user_id NOT IN ${sql(targetUserIds)} AND (is_active = true OR deleted_at IS NULL)
    RETURNING id, user_id, role;
  `;
  console.log(`✓ Deactivated other user role assignments (${deactivatedAssignments.length})`);

  // Soft-delete all OTHER profiles and unset their user_code
  const deactivatedProfiles = await sql`
    UPDATE public.profiles
    SET deleted_at = NOW(), user_code = NULL
    WHERE id NOT IN ${sql(targetUserIds)} AND deleted_at IS NULL
    RETURNING id, full_name;
  `;
  console.log(`✓ Deactivated other profiles (${deactivatedProfiles.length})`);

  console.log("\n==========================================================================");
  console.log("✅ STANDARDIZATION COMPLETE: EXACT 2 COUNTRIES, 3 CITY BRANCHES, 8 USERS");
  console.log("==========================================================================");

  await sql.end();
}

main().catch(err => {
  console.error("Error standardizing:", err);
  process.exit(1);
});
