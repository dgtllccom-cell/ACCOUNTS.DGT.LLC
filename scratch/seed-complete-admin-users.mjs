import postgres from 'postgres';
import crypto from 'crypto';

import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
const devUrl = resolveDbUrl("dev");
const prodUrl = resolveDbUrl("prod");

async function seedDatabaseUsers(envName, dbUrl) {
  const sql = postgres(dbUrl, { ssl: 'require' });
  console.log(`\n========================================`);
  console.log(`  Seeding Users for [${envName}] Database`);
  console.log(`========================================`);

  try {
    // 1. Get Countries
    const countries = await sql`SELECT id, name, iso2, currency_code FROM public.countries WHERE deleted_at IS NULL ORDER BY name;`;
    console.log(`Found ${countries.length} countries.`);

    // 2. Get Main Branches
    const mainBranches = await sql`SELECT id, country_id, name, code FROM public.country_branches WHERE deleted_at IS NULL ORDER BY name;`;
    console.log(`Found ${mainBranches.length} main branches.`);

    // 3. Get City Branches
    const cityBranches = await sql`SELECT id, country_id, country_branch_id, city_name, name, code FROM public.city_branches WHERE deleted_at IS NULL ORDER BY city_name;`;
    console.log(`Found ${cityBranches.length} city branches.`);

    // Standard permissions list
    const adminPermissions = [
      'dashboard.view', 'accounts.view', 'accounts.create', 'accounts.edit',
      'purchases.view', 'purchases.create', 'purchases.edit',
      'sales.view', 'sales.create', 'sales.edit',
      'roznamcha.view', 'roznamcha.create', 'roznamcha.edit',
      'reports.view', 'reports.export', 'locations.view', 'settings.view'
    ];

    const branchPermissions = [
      'dashboard.view', 'accounts.view', 'accounts.create',
      'purchases.view', 'purchases.create',
      'sales.view', 'sales.create',
      'roznamcha.view', 'roznamcha.create',
      'reports.view'
    ];

    const agentPermissions = [
      'dashboard.view', 'shipping.view', 'shipping.create', 'shipping.edit',
      'purchases.view', 'reports.view'
    ];

    // Helper to upsert user profile + assignment + permissions
    async function upsertUser({
      id = null,
      email,
      fullName,
      userCode,
      password,
      role,
      countryId = null,
      countryBranchId = null,
      cityBranchId = null,
      permissions = branchPermissions
    }) {
      let finalUserId = id;
      const existingProfile = await sql`
        SELECT id FROM public.profiles WHERE user_code = ${userCode} OR (${id ? sql`id = ${id}` : sql`false`}) LIMIT 1;
      `;
      if (existingProfile.length > 0) {
        finalUserId = existingProfile[0].id;
      } else {
        const existingAuth = await sql`SELECT id FROM auth.users WHERE email = ${email} LIMIT 1;`;
        if (existingAuth.length > 0) {
          finalUserId = existingAuth[0].id;
        } else {
          finalUserId = id || crypto.randomUUID();
          await sql`
            INSERT INTO auth.users (
              id, email, raw_user_meta_data, created_at, updated_at, role, aud
            ) VALUES (
              ${finalUserId}, ${email}, ${JSON.stringify({ full_name: fullName, user_code: userCode })}, NOW(), NOW(), 'authenticated', 'authenticated'
            ) ON CONFLICT (id) DO NOTHING;
          `;
        }
      }

      // Upsert profiles
      await sql`
        INSERT INTO public.profiles (
          id, full_name, user_code, raw_password, created_at, updated_at
        ) VALUES (
          ${finalUserId}, ${fullName}, ${userCode}, ${password}, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          user_code = EXCLUDED.user_code,
          raw_password = EXCLUDED.raw_password,
          updated_at = NOW(),
          deleted_at = NULL;
      `;

      // Upsert user_role_assignments
      const existingAssignment = await sql`
        SELECT id FROM public.user_role_assignments 
        WHERE user_id = ${finalUserId} AND role = ${role} LIMIT 1;
      `;
      if (existingAssignment.length > 0) {
        await sql`
          UPDATE public.user_role_assignments
          SET country_id = ${countryId},
              country_branch_id = ${countryBranchId},
              city_branch_id = ${cityBranchId},
              is_active = true,
              updated_at = NOW(),
              deleted_at = NULL
          WHERE id = ${existingAssignment[0].id};
        `;
      } else {
        await sql`
          INSERT INTO public.user_role_assignments (
            user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at, updated_at
          ) VALUES (
            ${finalUserId}, ${role}, ${countryId}, ${countryBranchId}, ${cityBranchId}, true, NOW(), NOW()
          );
        `;
      }

      // Upsert user_permission_sets
      await sql`
        INSERT INTO public.user_permission_sets (
          user_id, permissions, created_at, updated_at
        ) VALUES (
          ${finalUserId}, ${permissions}, NOW(), NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          permissions = EXCLUDED.permissions,
          updated_at = NOW(),
          deleted_at = NULL;
      `;

      console.log(`  -> User Upserted: [${userCode}] ${fullName} (${role})`);
      return finalUserId;
    }

    // 1. Super Admin
    await upsertUser({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'superadmin@dgt.llc',
      fullName: 'Super Admin',
      userCode: 'SUPERADMIN',
      password: 'Admin@123',
      role: 'super_admin',
      permissions: adminPermissions
    });

    // 2. Country Admins for all Countries
    for (const c of countries) {
      const code = (c.iso2 || c.name.slice(0, 3)).toUpperCase();
      await upsertUser({
        email: `${code.toLowerCase()}-admin@dgt.llc`,
        fullName: `${c.name} Country Admin`,
        userCode: `${code}-ADMIN`,
        password: 'Admin@123',
        role: 'country_admin',
        countryId: c.id,
        permissions: adminPermissions
      });
    }

    // 3. Main Branch Admins
    for (const mb of mainBranches) {
      const cleanCode = mb.code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      await upsertUser({
        email: `main-${cleanCode.toLowerCase()}@dgt.llc`,
        fullName: `${mb.name} Main Branch Admin`,
        userCode: `${cleanCode}-MAIN-ADMIN`,
        password: 'Branch@123',
        role: 'main_branch_admin',
        countryId: mb.country_id,
        countryBranchId: mb.id,
        permissions: branchPermissions
      });
    }

    // 4. City Branch Admins
    for (const cb of cityBranches) {
      const cleanCode = cb.code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      await upsertUser({
        email: `city-${cleanCode.toLowerCase()}@dgt.llc`,
        fullName: `${cb.city_name} - ${cb.name} Admin`,
        userCode: `${cleanCode}-ADMIN`,
        password: 'Branch@123',
        role: 'city_branch_admin',
        countryId: cb.country_id,
        countryBranchId: cb.country_branch_id,
        cityBranchId: cb.id,
        permissions: branchPermissions
      });
    }

    // 5. Clearing Agent Users (assigned to city branches)
    for (const cb of cityBranches) {
      const cleanCode = cb.code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      await upsertUser({
        email: `clearing-${cleanCode.toLowerCase()}@dgt.llc`,
        fullName: `${cb.city_name} Clearing Agent`,
        userCode: `CLEARING-${cleanCode}`,
        password: 'Clearing@123',
        role: 'agent_user',
        countryId: cb.country_id,
        countryBranchId: cb.country_branch_id,
        cityBranchId: cb.id,
        permissions: agentPermissions
      });
    }

    console.log(`✅ Seeding successfully completed for [${envName}] Database!`);
  } catch (err) {
    console.error(`❌ Seeding error on [${envName}]:`, err);
  } finally {
    await sql.end();
  }
}

async function main() {
  await seedDatabaseUsers("DEV", devUrl);
  await seedDatabaseUsers("PROD", prodUrl);
}

main();
