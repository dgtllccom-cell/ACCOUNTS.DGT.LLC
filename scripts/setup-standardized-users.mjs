import postgres from 'postgres';
import fs from 'fs';

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

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const sql = postgres(dbUrl, { max: 5, prepare: false });

// Exact Standardized User Definitions
const STANDARDIZED_USERS = [
  // 1. Super Admins (2 Super Admins)
  {
    category: "Super Admin",
    email: "all.superadmin@dgt.llc",
    fullName: "Haji Asmatullah (All Super Admin)",
    userCode: "SUPER-ADMIN-01",
    role: "super_admin",
    countryIso: null,
    branchCode: null,
    caCode: null,
    ledgerVisibility: "full",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit", "accounts.delete",
      "purchases.view", "purchases.create", "purchases.edit", "purchases.delete",
      "sales.view", "sales.create", "sales.edit", "sales.delete",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit", "roznamcha.delete",
      "reports.view", "reports.export", "locations.view", "locations.edit",
      "settings.view", "settings.edit", "users.view", "users.edit", "audit.view"
    ]
  },
  {
    category: "Audit & Report Super Admin",
    email: "audit.superadmin@dgt.llc",
    fullName: "Audit & Reports Super Admin",
    userCode: "AUDIT-SUPER-01",
    role: "super_admin",
    countryIso: null,
    branchCode: null,
    caCode: null,
    ledgerVisibility: "full",
    permissions: [
      "dashboard.view", "reports.view", "reports.export", "audit.view", "audit.logs",
      "accounts.view", "purchases.view", "sales.view", "roznamcha.view",
      "locations.view", "settings.view", "edits.view", "deletions.view"
    ]
  },

  // 2. Country Admins (5 Country Admins)
  {
    category: "Country Admin",
    email: "uae.admin@dgt.llc",
    fullName: "United Arab Emirates Country Admin",
    userCode: "AE-ADMIN-001",
    role: "country_admin",
    countryIso: "AE",
    branchCode: null,
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export", "locations.view"
    ]
  },
  {
    category: "Country Admin",
    email: "pakistan.admin@dgt.llc",
    fullName: "Pakistan Country Admin",
    userCode: "PK-ADMIN-001",
    role: "country_admin",
    countryIso: "PK",
    branchCode: null,
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export", "locations.view"
    ]
  },
  {
    category: "Country Admin",
    email: "afghanistan.admin@dgt.llc",
    fullName: "Afghanistan Country Admin",
    userCode: "AF-ADMIN-001",
    role: "country_admin",
    countryIso: "AF",
    branchCode: null,
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export", "locations.view"
    ]
  },
  {
    category: "Country Admin",
    email: "india.admin@dgt.llc",
    fullName: "India Country Admin",
    userCode: "IN-ADMIN-001",
    role: "country_admin",
    countryIso: "IN",
    branchCode: null,
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export", "locations.view"
    ]
  },
  {
    category: "Country Admin",
    email: "iran.admin@dgt.llc",
    fullName: "Iran Country Admin",
    userCode: "IR-ADMIN-001",
    role: "country_admin",
    countryIso: "IR",
    branchCode: null,
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export", "locations.view"
    ]
  },

  // 3. City (Business) Branch Admins (6 City Branch Admins)
  {
    category: "City Branch Admin",
    email: "dubai.branch@dgt.llc",
    fullName: "Deira Dubai Branch Admin",
    userCode: "UAE-DEI-ADMIN",
    role: "city_branch_admin",
    countryIso: "AE",
    branchCode: "UAE-DEI-001",
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export"
    ]
  },
  {
    category: "City Branch Admin",
    email: "quetta.branch@dgt.llc",
    fullName: "Quetta City Branch Admin",
    userCode: "PAK-QUE-ADMIN",
    role: "city_branch_admin",
    countryIso: "PK",
    branchCode: "PAK-QUE-001",
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export"
    ]
  },
  {
    category: "City Branch Admin",
    email: "chaman.branch@dgt.llc",
    fullName: "Chaman City Branch Admin",
    userCode: "PAK-CHM-ADMIN",
    role: "city_branch_admin",
    countryIso: "PK",
    branchCode: "PAK-CHM-001",
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export"
    ]
  },
  {
    category: "City Branch Admin",
    email: "kabul.branch@dgt.llc",
    fullName: "Kabul City Branch Admin",
    userCode: "AFG-KBL-ADMIN",
    role: "city_branch_admin",
    countryIso: "AF",
    branchCode: "AFG-KBL-001",
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export"
    ]
  },
  {
    category: "City Branch Admin",
    email: "tehran.branch@dgt.llc",
    fullName: "Tehran City Branch Admin",
    userCode: "IRN-THR-ADMIN",
    role: "city_branch_admin",
    countryIso: "IR",
    branchCode: "IRN-THR-001",
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export"
    ]
  },
  {
    category: "City Branch Admin",
    email: "mumbai.branch@dgt.llc",
    fullName: "Mumbai Vashi Mandi Branch Admin",
    userCode: "IND-BOM-ADMIN",
    role: "city_branch_admin",
    countryIso: "IN",
    branchCode: "IND-BOM-001",
    caCode: null,
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "accounts.view", "accounts.create", "accounts.edit",
      "purchases.view", "purchases.create", "purchases.edit",
      "sales.view", "sales.create", "sales.edit",
      "roznamcha.view", "roznamcha.create", "roznamcha.edit",
      "reports.view", "reports.export"
    ]
  },

  // 4. Clearing Agent Branch Admins (4 CA Branch Admins)
  {
    category: "Clearing Agent Admin",
    email: "dubaiport.clearing@dgt.llc",
    fullName: "Dubai Port Clearing Agent Admin",
    userCode: "CA-AE-DXB-ADMIN",
    role: "agent_user",
    countryIso: "AE",
    branchCode: "UAE-DEI-001",
    caCode: "CA-AE-DXB-01",
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "clearing.view", "clearing.create", "clearing.edit",
      "reports.view", "reports.export"
    ]
  },
  {
    category: "Clearing Agent Admin",
    email: "chaman.clearing@dgt.llc",
    fullName: "Chaman Clearing Agent Admin",
    userCode: "CA-PK-CHM-ADMIN",
    role: "agent_user",
    countryIso: "PK",
    branchCode: "PAK-CHM-001",
    caCode: "CA-PK-CHM-01",
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "clearing.view", "clearing.create", "clearing.edit",
      "reports.view", "reports.export"
    ]
  },
  {
    category: "Clearing Agent Admin",
    email: "nimruz.clearing@dgt.llc",
    fullName: "Nimruz Clearing Agent Admin",
    userCode: "CA-AF-NMR-ADMIN",
    role: "agent_user",
    countryIso: "AF",
    branchCode: "AFG-KBL-001",
    caCode: "CA-AF-NMR-01",
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "clearing.view", "clearing.create", "clearing.edit",
      "reports.view", "reports.export"
    ]
  },
  {
    category: "Clearing Agent Admin",
    email: "bandarabbas.clearing@dgt.llc",
    fullName: "Bandar Abbas Clearing Agent Admin",
    userCode: "CA-IR-BND-ADMIN",
    role: "agent_user",
    countryIso: "IR",
    branchCode: "IRN-THR-001",
    caCode: "CA-IR-BND-01",
    ledgerVisibility: "scoped",
    permissions: [
      "dashboard.view", "clearing.view", "clearing.create", "clearing.edit",
      "reports.view", "reports.export"
    ]
  }
];

async function run() {
  console.log("=================================================================");
  console.log("   ERP USER STANDARDIZATION & CLEANUP ENGINE                     ");
  console.log("=================================================================\n");

  // Load locations references
  const countries = await sql`SELECT id, iso2, name FROM countries WHERE deleted_at IS NULL;`;
  const countryMap = {};
  countries.forEach(c => countryMap[c.iso2.toUpperCase()] = c.id);

  const countryBranches = await sql`SELECT id, country_id, code, name FROM country_branches WHERE deleted_at IS NULL;`;
  const countryBranchMap = {};
  countryBranches.forEach(cb => {
    // Map by country_id
    countryBranchMap[cb.country_id] = cb.id;
  });

  const cityBranches = await sql`SELECT id, code, country_id, country_branch_id, name FROM city_branches WHERE deleted_at IS NULL;`;
  const cityBranchMap = {};
  cityBranches.forEach(cb => cityBranchMap[cb.code.toUpperCase()] = cb);

  const caBranches = await sql`SELECT id, code, clearing_agent_id, country_id, city_branch_id FROM clearing_agent_branches WHERE deleted_at IS NULL;`;
  const caBranchMap = {};
  caBranches.forEach(cab => caBranchMap[cab.code.toUpperCase()] = cab);

  const configuredUserIds = [];

  // Enable pgcrypto extension for password hashing if available
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
  } catch (e) {}

  for (const u of STANDARDIZED_USERS) {
    const cId = u.countryIso ? countryMap[u.countryIso.toUpperCase()] : null;
    const cbId = (u.role === 'country_admin' || u.role === 'super_admin') ? null : (cId ? countryBranchMap[cId] : null);
    const cityBranch = u.branchCode ? cityBranchMap[u.branchCode.toUpperCase()] : null;
    const cityBId = cityBranch ? cityBranch.id : null;
    const caBranch = u.caCode ? caBranchMap[u.caCode.toUpperCase()] : null;
    const caId = caBranch ? caBranch.clearing_agent_id : null;

    // 1. Check or Insert in auth.users
    let [authUser] = await sql`
      SELECT id, email FROM auth.users 
      WHERE lower(email) = ${u.email.toLowerCase()}
      LIMIT 1;
    `;

    if (!authUser) {
      // Check if user exists by user_code in profiles
      const [existingProfile] = await sql`
        SELECT id FROM public.profiles 
        WHERE upper(user_code) = ${u.userCode.toUpperCase()}
        LIMIT 1;
      `;
      if (existingProfile) {
        authUser = { id: existingProfile.id, email: u.email };
        await sql`
          UPDATE auth.users 
          SET email = ${u.email.toLowerCase()}, 
              raw_user_meta_data = ${JSON.stringify({ full_name: u.fullName, user_code: u.userCode })},
              email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
              deleted_at = NULL,
              banned_until = NULL,
              updated_at = NOW()
          WHERE id = ${existingProfile.id};
        `;
      } else {
        const [newUser] = await sql`
          INSERT INTO auth.users (
            id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(), 'authenticated', 'authenticated', ${u.email.toLowerCase()},
            crypt('DgtLlc@2026!', gen_salt('bf')), NOW(),
            ${JSON.stringify({ full_name: u.fullName, user_code: u.userCode })},
            NOW(), NOW()
          )
          RETURNING id, email;
        `;
        authUser = newUser;
      }
    } else {
      await sql`
        UPDATE auth.users 
        SET email = ${u.email.toLowerCase()}, 
            raw_user_meta_data = ${JSON.stringify({ full_name: u.fullName, user_code: u.userCode })},
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            deleted_at = NULL,
            banned_until = NULL,
            updated_at = NOW()
        WHERE id = ${authUser.id};
      `;
    }

    const userId = authUser.id;
    configuredUserIds.push(userId);

    // 2. Upsert in public.profiles
    await sql`
      INSERT INTO public.profiles (id, full_name, user_code, created_at, updated_at, deleted_at)
      VALUES (${userId}, ${u.fullName}, ${u.userCode}, NOW(), NOW(), NULL)
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        user_code = EXCLUDED.user_code,
        deleted_at = NULL,
        updated_at = NOW();
    `;

    // 3. Upsert in public.user_role_assignments
    await sql`
      DELETE FROM public.user_role_assignments WHERE user_id = ${userId};
    `;
    await sql`
      INSERT INTO public.user_role_assignments (
        user_id, role, country_id, country_branch_id, city_branch_id, clearing_agent_id, ledger_visibility, is_active, created_at, updated_at
      )
      VALUES (
        ${userId}, ${u.role}, ${cId}, ${cbId}, ${cityBId}, ${caId}, ${u.ledgerVisibility}, true, NOW(), NOW()
      );
    `;

    // 4. Upsert in public.user_permission_sets
    await sql`
      DELETE FROM public.user_permission_sets WHERE user_id = ${userId};
    `;
    await sql`
      INSERT INTO public.user_permission_sets (
        user_id, permissions, source, created_at, updated_at
      )
      VALUES (
        ${userId}, ${u.permissions}, 'role_default', NOW(), NOW()
      );
    `;

    console.log(`✓ Configured [${u.category}] ${u.fullName} (${u.email}) -> Role: ${u.role}`);
  }

  // 5. Cleanup: Soft-delete/deactivate all other leftover users
  console.log("\n=== Deactivating all other extraneous/dummy users ===");
  const deactivatedRole = await sql`
    UPDATE public.user_role_assignments 
    SET is_active = false, deleted_at = NOW()
    WHERE user_id NOT IN ${sql(configuredUserIds)};
  `;
  console.log("Deactivated extraneous role assignments count:", deactivatedRole.count);

  const deactivatedProfiles = await sql`
    UPDATE public.profiles 
    SET deleted_at = NOW()
    WHERE id NOT IN ${sql(configuredUserIds)};
  `;
  console.log("Deactivated extraneous profiles count:", deactivatedProfiles.count);

  const deactivatedAuth = await sql`
    UPDATE auth.users 
    SET banned_until = '2099-01-01', deleted_at = NOW()
    WHERE id NOT IN ${sql(configuredUserIds)};
  `;
  console.log("Deactivated extraneous auth users count:", deactivatedAuth.count);

  // Print final active user report
  console.log("\n=================================================================");
  console.log("   FINAL ACTIVE STANDARDIZED USERS LIST                          ");
  console.log("=================================================================\n");

  const finalUsers = await sql`
    SELECT 
      u.email, 
      p.full_name, 
      p.user_code,
      r.role,
      c.name as country_name,
      cb.name as city_branch_name,
      r.ledger_visibility
    FROM auth.users u
    JOIN public.profiles p ON u.id = p.id
    JOIN public.user_role_assignments r ON u.id = r.user_id
    LEFT JOIN public.countries c ON r.country_id = c.id
    LEFT JOIN public.city_branches cb ON r.city_branch_id = cb.id
    WHERE u.deleted_at IS NULL AND p.deleted_at IS NULL AND r.deleted_at IS NULL AND r.is_active = true
    ORDER BY 
      CASE 
        WHEN r.role = 'super_admin' THEN 1 
        WHEN r.role = 'country_admin' THEN 2 
        WHEN r.role = 'city_branch_admin' THEN 3 
        ELSE 4 
      END, 
      c.name NULLS FIRST, 
      p.full_name;
  `;

  finalUsers.forEach((u, i) => {
    console.log(`${i+1}. [${u.email}] ${u.full_name} (${u.user_code}) | Role: ${u.role} | Country: ${u.country_name || 'Global'} | Branch: ${u.city_branch_name || 'N/A'}`);
  });

  console.log(`\nTOTAL ACTIVE STANDARDIZED USERS: ${finalUsers.length}`);
  console.log("All other extraneous test users have been deactivated/purged.\n");

  await sql.end();
}

run().catch(console.error);
