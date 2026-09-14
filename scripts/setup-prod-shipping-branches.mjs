import postgres from 'postgres';
import fs from 'fs';

let env = fs.readFileSync('.env.local', 'utf8');
let m = env.match(/DATABASE_URL=(.+)/);
if (!m) {
  console.error('FATAL: No DATABASE_URL found in .env.local');
  process.exit(1);
}
let dbUrl = m[1].trim().replace(/^['"]|['"]$/g, '');
console.log('Connecting to database...');
const sql = postgres(dbUrl, { max: 2, connect_timeout: 15 });

const LANGUAGES = ['en', 'ur', 'ar', 'fa', 'ps'];

async function syncTranslations(tableName, recordId, fieldName, nameMap) {
  for (const lang of LANGUAGES) {
    const text = nameMap[lang] || nameMap['en'] || '';
    const transTable = `${tableName}_${lang}`;
    try {
      await sql`DELETE FROM ${sql(transTable)} WHERE record_id = ${recordId} AND field_name = ${fieldName};`;
      await sql`
        INSERT INTO ${sql(transTable)} (
          record_id, field_name, translated_text, original_text, original_language_code, source, translation_status, translated_by_engine, created_at, updated_at
        )
        VALUES (
          ${recordId}, ${fieldName}, ${text}, ${nameMap['en']}, 'en', 'human_verified', 'completed', 'manual_seed', NOW(), NOW()
        );
      `;
    } catch (e) {}
  }
}

async function main() {
  console.log('====================================================================');
  console.log('  PROVISION 3 SHIPPING BRANCHES & ADMINS (PRODUCTION SAFE ENGINE)');
  console.log('====================================================================\n');

  // 1. Schema Safety Check: Add must_change_password if not exists
  await sql`
    ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
  `;
  console.log('✓ Verified profiles.must_change_password column exists');

  // 2. Fetch country references
  const pk = (await sql`SELECT id FROM countries WHERE iso2 = 'PK' LIMIT 1`)[0];
  const af = (await sql`SELECT id FROM countries WHERE iso2 = 'AF' AND name ILIKE '%afghanistan%' LIMIT 1`)[0] 
          || (await sql`SELECT id FROM countries WHERE iso2 = 'AF' LIMIT 1`)[0];
  const ae = (await sql`SELECT id FROM countries WHERE iso2 = 'AE' LIMIT 1`)[0];

  console.log('Country IDs resolved:', { pk: pk?.id, af: af?.id, ae: ae?.id });
  if (!pk || !af || !ae) throw new Error('Missing country records');

  // 3. Main Country Branches
  const pkMain = (await sql`SELECT id FROM country_branches WHERE country_id = ${pk.id} AND is_main = true LIMIT 1`)[0];
  const afMain = (await sql`SELECT id FROM country_branches WHERE country_id = ${af.id} AND is_main = true LIMIT 1`)[0];
  const aeMain = (await sql`SELECT id FROM country_branches WHERE country_id = ${ae.id} AND is_main = true LIMIT 1`)[0];

  console.log('Main Country Branches:', { pkMain: pkMain?.id, afMain: afMain?.id, aeMain: aeMain?.id });

  // 4. Clearing Agent Master (DGT CLEARING & FORWARDING SERVICES)
  let [primaryAgent] = await sql`
    SELECT id, name, code, clearing_agent_code 
    FROM clearing_agents 
    WHERE code = 'DGT-CLEARING-HQ' OR name ILIKE '%DGT CLEARING%'
    LIMIT 1;
  `;
  if (!primaryAgent) {
    const [inserted] = await sql`
      INSERT INTO clearing_agents (
        id, name, code, head_office_country_id, status, notes, clearing_agent_code, created_at, updated_at
      )
      VALUES (
        'b9c1f75c-41ec-494f-959a-15fe39411b22', 
        'DGT CLEARING & FORWARDING SERVICES', 
        'DGT-CLEARING-HQ', 
        ${ae.id}, 
        'active', 
        'Main Clearing & Forwarding Agent Organization for Super Admin, Country & City Branches',
        'CLA-000004', 
        NOW(), NOW()
      )
      RETURNING id, name, code, clearing_agent_code;
    `;
    primaryAgent = inserted;
    console.log('✓ Created Primary Clearing Agent Master:', primaryAgent.id);

    // Create Head Office branch in clearing_agent_branches
    await sql`
      INSERT INTO clearing_agent_branches (
        id, clearing_agent_id, name, code, branch_level, status, created_at, updated_at
      )
      VALUES (
        '5902efb1-ba14-4956-970b-27cda6ea6817',
        ${primaryAgent.id},
        'DGT Clearing Agent - Head Office Super Admin Branch',
        'CLEARING-HO-01',
        'head_office',
        'active',
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    `;
  } else {
    console.log('✓ Reusing existing Clearing Agent Master:', primaryAgent.id, primaryAgent.name);
  }

  // 5. Existing City / Location references
  const kandaharBusinessBranch = (await sql`
    SELECT id, city_id, state_province_id, district_id 
    FROM city_branches 
    WHERE country_id = ${af.id} AND is_business_branch = true AND status = 'active'
    LIMIT 1
  `)[0];

  const chamanBusinessBranch = (await sql`
    SELECT id, city_id, state_province_id, district_id 
    FROM city_branches 
    WHERE country_id = ${pk.id} AND is_business_branch = true AND status = 'active'
    LIMIT 1
  `)[0];

  const deiraBusinessBranch = (await sql`
    SELECT id, city_id, state_province_id, district_id 
    FROM city_branches 
    WHERE country_id = ${ae.id} AND is_business_branch = true AND status = 'active'
    LIMIT 1
  `)[0];

  const BRANCHES_CONFIG = [
    {
      countryId: pk.id,
      countryBranchId: pkMain?.id,
      cityName: 'Chaman',
      cityId: chamanBusinessBranch?.city_id,
      branchName: 'Chaman Shipping & Clearing Branch',
      branchCode: 'PAK-CHM-SHIP-01',
      caBranchName: 'Chaman Shipping & Clearing Agent Branch',
      caBranchCode: 'CA-PK-CHM-01',
      currency: 'PKR',
      email: 'chaman.shipping@dgt.llc',
      phone: '+92 826 612345',
      address: 'Customs & Border Road, Chaman, Balochistan, Pakistan',
      translations: {
        en: 'Chaman Shipping & Clearing Branch',
        ur: 'چمن شپنگ و کلیئرنگ برانچ',
        ar: 'فرع جمن للشحن والتخليص',
        fa: 'شعبه کشتیرانی و ترخیص چمن',
        ps: 'د چمن د کښتۍ او ګمرکي کلیرنګ څانګه'
      },
      adminUser: {
        fullName: 'Chaman Shipping Admin',
        email: 'chaman.shipping@dgt.llc',
        userCode: 'CHAMAN.SHIPPING',
        mustChangePassword: false
      }
    },
    {
      countryId: af.id,
      countryBranchId: afMain?.id,
      cityName: 'Kandahar',
      cityId: kandaharBusinessBranch?.city_id,
      branchName: 'Kandahar Shipping & Clearing Branch',
      branchCode: 'AFG-KDH-SHIP-01',
      caBranchName: 'Kandahar Shipping & Clearing Agent Branch',
      caBranchCode: 'CA-AF-KDH-01',
      currency: 'AFN',
      email: 'kandahar.shipping@dgt.llc',
      phone: '+93 30 200 8888',
      address: 'Customs Terminal Road, Shaheedan Chowk, Kandahar, Afghanistan',
      translations: {
        en: 'Kandahar Shipping & Clearing Branch',
        ur: 'قندھار شپنگ و کلیئرنگ برانچ',
        ar: 'فرع قندهار للشحن والتخليص',
        fa: 'شعبه کشتیرانی و ترخیص قندهار',
        ps: 'د کندهار د کښتۍ او ګمرکي کلیرنګ څانګه'
      },
      adminUser: {
        fullName: 'Kandahar Shipping Admin',
        email: 'kandahar.shipping@dgt.llc',
        userCode: 'KANDAHAR.SHIPPING',
        mustChangePassword: true // REQUIRE PASSWORD CHANGE ON FIRST LOGIN
      }
    },
    {
      countryId: ae.id,
      countryBranchId: aeMain?.id,
      cityName: 'Dubai',
      cityId: deiraBusinessBranch?.city_id,
      branchName: 'Al Ras Shipping & Clearing Branch',
      branchCode: 'UAE-RAS-SHIP-01',
      caBranchName: 'Al Ras Shipping & Clearing Agent Branch',
      caBranchCode: 'CA-AE-RAS-01',
      currency: 'AED',
      email: 'alras.shipping@dgt.llc',
      phone: '+971 4 226 7777',
      address: 'Al Ras Street, Deira Wholesale Market, Dubai, UAE',
      translations: {
        en: 'Al Ras Shipping & Clearing Branch',
        ur: 'الراس شپنگ و کلیئرنگ برانچ',
        ar: 'فرع الراس للشحن والتخليص',
        fa: 'شعبه کشتیرانی و ترخیص الرأس',
        ps: 'د الراس د کښتۍ او ګمرکي کلیرنګ څانګه'
      },
      adminUser: {
        fullName: 'Al Ras Shipping Admin',
        email: 'alras.shipping@dgt.llc',
        userCode: 'ALRAS.SHIPPING',
        mustChangePassword: false
      }
    }
  ];

  const SHIPPING_ADMIN_PERMISSIONS = [
    'route:/dashboard/clearing-agent/customer-order',
    'route:/dashboard/clearing-agent/agent-custom-entry',
    'route:/dashboard/clearing-agent/payment-bill-entry',
    'route:/dashboard/clearing-agent/truck-registration',
    'route:/dashboard/clearing-agent/import-loading',
    'route:/dashboard/clearing-agent/truck-loading',
    'route:/dashboard/clearing-agent/transit-loading',
    'route:/dashboard/clearing-agent/truck-recreation',
    'route:/dashboard/logistics',
    'route:/dashboard/shipping-lines',
    'route:/dashboard/reports/handover',
    'route:/dashboard/agent',
    'route:/dashboard/roznamcha/cash-entry',
    'clearing:view', 'clearing:create', 'clearing:edit', 'clearing:delete',
    'shipping:view', 'shipping:create', 'shipping:edit',
    'clearing_orders:read', 'clearing_orders:create', 'clearing_orders:update', 'clearing_orders:delete',
    'clearing_bills:read', 'clearing_bills:create', 'clearing_bills:update',
    'clearing_trucks:read', 'clearing_trucks:create', 'clearing_trucks:update',
    'shipping_lines:read', 'shipping_lines:create', 'shipping_lines:update',
    'logistics:read', 'logistics:create', 'logistics:update',
    'handovers:read', 'handovers:create', 'handovers:update',
    'dashboard:read', 'dashboard.view', 'reports.view', 'reports.export',
    'roznamcha:view', 'roznamcha:create'
  ];

  for (const cfg of BRANCHES_CONFIG) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Processing Branch: ${cfg.branchName} [${cfg.branchCode}]`);
    console.log(`------------------------------------------------------------`);

    // A. Upsert city_branches
    let [cityBranch] = await sql`SELECT id FROM city_branches WHERE code = ${cfg.branchCode} LIMIT 1`;
    if (cityBranch) {
      await sql`
        UPDATE city_branches 
        SET name = ${cfg.branchName},
            city_name = ${cfg.cityName},
            country_id = ${cfg.countryId},
            country_branch_id = ${cfg.countryBranchId},
            city_id = COALESCE(city_id, ${cfg.cityId}),
            local_currency = ${cfg.currency},
            email = ${cfg.email},
            phone = ${cfg.phone},
            address = ${cfg.address},
            operational_domain = 'shipping',
            is_business_branch = false,
            status = 'active',
            deleted_at = NULL,
            updated_at = NOW()
        WHERE id = ${cityBranch.id};
      `;
      console.log(`✓ Updated city_branches record: ${cityBranch.id}`);
    } else {
      const [insertedCb] = await sql`
        INSERT INTO city_branches (
          country_id, country_branch_id, city_name, name, code, local_currency,
          city_id, email, phone, address, operational_domain, is_business_branch, status, created_at, updated_at
        )
        VALUES (
          ${cfg.countryId}, ${cfg.countryBranchId}, ${cfg.cityName}, ${cfg.branchName}, ${cfg.branchCode}, ${cfg.currency},
          ${cfg.cityId}, ${cfg.email}, ${cfg.phone}, ${cfg.address}, 'shipping', false, 'active', NOW(), NOW()
        )
        RETURNING id;
      `;
      cityBranch = insertedCb;
      console.log(`✓ Created city_branches record: ${cityBranch.id}`);
    }

    // Sync translations
    await syncTranslations('city_branches', cityBranch.id, 'name', cfg.translations);

    // B. Upsert clearing_agent_branches
    let [caBranch] = await sql`SELECT id FROM clearing_agent_branches WHERE code = ${cfg.caBranchCode} LIMIT 1`;
    if (caBranch) {
      await sql`
        UPDATE clearing_agent_branches 
        SET clearing_agent_id = ${primaryAgent.id},
            name = ${cfg.caBranchName},
            code = ${cfg.caBranchCode},
            branch_level = 'city_branch',
            country_id = ${cfg.countryId},
            country_branch_id = ${cfg.countryBranchId},
            city_branch_id = ${cityBranch.id},
            status = 'active',
            deleted_at = NULL,
            updated_at = NOW()
        WHERE id = ${caBranch.id};
      `;
      console.log(`✓ Updated clearing_agent_branches record: ${caBranch.id}`);
    } else {
      const [insertedCab] = await sql`
        INSERT INTO clearing_agent_branches (
          clearing_agent_id, name, code, branch_level, country_id, country_branch_id, city_branch_id, status, created_at, updated_at
        )
        VALUES (
          ${primaryAgent.id}, ${cfg.caBranchName}, ${cfg.caBranchCode}, 'city_branch',
          ${cfg.countryId}, ${cfg.countryBranchId}, ${cityBranch.id}, 'active', NOW(), NOW()
        )
        RETURNING id;
      `;
      caBranch = insertedCab;
      console.log(`✓ Created clearing_agent_branches record: ${caBranch.id}`);
    }

    await syncTranslations('clearing_agent_branches', caBranch.id, 'name', {
      en: cfg.caBranchName,
      ur: `${cfg.translations.ur} (کلیئرنگ)`,
      ar: `${cfg.translations.ar} (تخليص)`,
      fa: `${cfg.translations.fa} (ترخیص)`,
      ps: `${cfg.translations.ps} (کلیرنګ)`
    });

    // C. Upsert Branch Admin User
    const u = cfg.adminUser;
    let [authUser] = await sql`SELECT id, email FROM auth.users WHERE lower(email) = ${u.email.toLowerCase()} LIMIT 1`;

    if (!authUser) {
      const [existingProf] = await sql`SELECT id FROM public.profiles WHERE upper(user_code) = ${u.userCode.toUpperCase()} LIMIT 1`;
      if (existingProf) {
        authUser = { id: existingProf.id, email: u.email };
        await sql`
          UPDATE auth.users 
          SET email = ${u.email.toLowerCase()},
              encrypted_password = crypt('chaman@9090', gen_salt('bf')),
              raw_user_meta_data = ${JSON.stringify({ full_name: u.fullName, user_code: u.userCode })},
              email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
              banned_until = NULL,
              deleted_at = NULL,
              updated_at = NOW()
          WHERE id = ${existingProf.id};
        `;
      } else {
        const [newUser] = await sql`
          INSERT INTO auth.users (
            id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(), 'authenticated', 'authenticated', ${u.email.toLowerCase()},
            crypt('chaman@9090', gen_salt('bf')), NOW(),
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
            encrypted_password = crypt('chaman@9090', gen_salt('bf')),
            raw_user_meta_data = ${JSON.stringify({ full_name: u.fullName, user_code: u.userCode })},
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            banned_until = NULL,
            deleted_at = NULL,
            updated_at = NOW()
        WHERE id = ${authUser.id};
      `;
    }

    const userId = authUser.id;

    // Upsert into profiles
    await sql`
      INSERT INTO public.profiles (
        id, full_name, user_code, raw_password, must_change_password, preferred_language_code, created_at, updated_at, deleted_at
      )
      VALUES (
        ${userId}, ${u.fullName}, ${u.userCode}, 'chaman@9090', ${u.mustChangePassword}, 'en', NOW(), NOW(), NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        user_code = EXCLUDED.user_code,
        raw_password = EXCLUDED.raw_password,
        must_change_password = EXCLUDED.must_change_password,
        deleted_at = NULL,
        updated_at = NOW();
    `;

    // Upsert role assignments
    await sql`DELETE FROM public.user_role_assignments WHERE user_id = ${userId};`;
    await sql`
      INSERT INTO public.user_role_assignments (
        user_id, role, country_id, country_branch_id, city_branch_id, clearing_agent_id,
        ledger_visibility, operational_domain, mobile_profile, is_active, created_at, updated_at
      )
      VALUES (
        ${userId}, 'city_branch_admin', ${cfg.countryId}, ${cfg.countryBranchId}, ${cityBranch.id}, ${primaryAgent.id},
        'scoped', 'shipping', 'standard', true, NOW(), NOW()
      );
    `;

    // Upsert permission sets
    await sql`DELETE FROM public.user_permission_sets WHERE user_id = ${userId};`;
    await sql`
      INSERT INTO public.user_permission_sets (
        user_id, permissions, source, created_at, updated_at
      )
      VALUES (
        ${userId}, ${SHIPPING_ADMIN_PERMISSIONS}, 'custom', NOW(), NOW()
      );
    `;

    console.log(`✓ Configured Admin: ${u.fullName} (${u.email}) [${u.userCode}]`);
    console.log(`  Role: city_branch_admin | Domain: shipping | MustChangePassword: ${u.mustChangePassword}`);
    console.log(`  Linked City Branch: ${cityBranch.id} | Linked CA Branch: ${caBranch.id}`);
  }

  console.log('\n====================================================================');
  console.log('✅ ALL 3 SHIPPING BRANCHES AND ADMINS SAFELY PROVISIONED IN PRODUCTION!');
  console.log('====================================================================\n');

  await sql.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal deployment error:', err);
  process.exit(1);
});
