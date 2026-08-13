import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const TARGET_REF = "csesvyxxjivnkkozgopt";
const PROD_REF = "inmayhrxucimxqhgseqi";
const DEFAULT_SOURCE_TAG = "DEVTEST-20260813-CSESVYXX";

function parseArgs(argv) {
  return {
    confirmLocalDev: argv.includes("--confirm-local-dev"),
    sourceTag:
      argv.find((arg) => arg.startsWith("--source-tag="))?.split("=")[1]?.trim() ||
      DEFAULT_SOURCE_TAG
  };
}

async function loadEnvFile(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Optional.
  }
}

function extractSupabaseRef(url) {
  if (!url) return null;
  const match = String(url).match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?/i);
  return match?.[1] ?? null;
}

function slugify(input) {
  return String(input).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildName(prefix, label, index, sourceTag) {
  return `${prefix} ${label} ${String(index).padStart(2, "0")} [${sourceTag}]`;
}

function currencyForCountry(countryCode) {
  switch (countryCode) {
    case "AF":
      return "AFN";
    case "IN":
      return "INR";
    case "PK":
      return "PKR";
    case "AE":
      return "AED";
    default:
      return "USD";
  }
}

function bankTemplate(countryCode, index, sourceTag) {
  const suffix = `${countryCode}-${String(index).padStart(2, "0")}`;
  return {
    bank_type: "Commercial",
    account_type: "Current",
    bank_name: buildName("DEV TEST", `${countryCode} Bank`, index, sourceTag),
    branch_name: `DEV TEST ${countryCode} Branch ${String(index).padStart(2, "0")}`,
    branch_code: `${sourceTag}-${suffix}-BR`,
    branch_code_type: "TEST",
    short_name: `DT${countryCode}${String(index).padStart(2, "0")}`,
    account_title: `DEV TEST ${countryCode} Bank Account ${String(index).padStart(2, "0")}`,
    account_number: `${sourceTag}-${suffix}-ACCT`,
    iban_number: null,
    currency: currencyForCountry(countryCode),
    account_status: "Active",
    full_address: `DEV TEST ${countryCode} banking address ${String(index).padStart(2, "0")}`,
    phone: `+000000${String(index).padStart(4, "0")}`,
    email: `devtest.${slugify(countryCode)}.bank.${index}@example.invalid`,
    swift_bic: null,
    website: null,
    remarks: sourceTag
  };
}

function customerTemplate(countryCode, index, sourceTag) {
  return {
    customer_name: buildName("DEV TEST", `${countryCode} Customer`, index, sourceTag),
    company_name: `DEV TEST ${countryCode} Trading ${String(index).padStart(2, "0")}`,
    contact_person: `DEV TEST Contact ${String(index).padStart(2, "0")}`,
    mobile: `+000100${String(index).padStart(4, "0")}`,
    whatsapp: `+000100${String(index).padStart(4, "0")}`,
    email: `devtest.${slugify(countryCode)}.customer.${index}@example.invalid`,
    address: `DEV TEST ${countryCode} customer address ${String(index).padStart(2, "0")}`,
    notes: sourceTag,
    original_language_code: "en"
  };
}

function companyTemplate(countryCode, index, sourceTag) {
  return {
    name: buildName("DEV TEST", `${countryCode} Company`, index, sourceTag),
    legal_name: `DEV TEST ${countryCode} Company Legal ${String(index).padStart(2, "0")}`,
    base_currency: currencyForCountry(countryCode),
    owner_name: `DEV TEST Owner ${String(index).padStart(2, "0")}`,
    business_type: "TEST",
    country_name: countryCode,
    address: `DEV TEST ${countryCode} company address ${String(index).padStart(2, "0")}`,
    contacts: [],
    registrations: [{ kind: "source_tag", value: sourceTag }],
    owner_ids: []
  };
}

function warehouseTemplate(branch, index, sourceTag) {
  return {
    country_id: branch.countryId,
    state_province_id: branch.stateProvinceId,
    district_id: branch.districtId,
    city_id: branch.cityId,
    area_id: null,
    owner_name: `DEV TEST ${branch.label} Owner ${String(index).padStart(2, "0")}`,
    warehouse_code: `${sourceTag}-${branch.branchCode}-${String(index).padStart(2, "0")}`,
    warehouse_name: buildName("DEV TEST", `${branch.label} Warehouse`, index, sourceTag),
    warehouse_type: "general",
    full_address: `DEV TEST ${branch.label} warehouse address ${String(index).padStart(2, "0")}`,
    contact_number: `+000200${String(index).padStart(4, "0")}`,
    status: "Active",
    description: sourceTag,
    name_en: buildName("DEV TEST", `${branch.label} Warehouse`, index, sourceTag),
    name_ur: "Translation pending",
    name_ar: "Translation pending",
    name_fa: "Translation pending",
    name_ps: "Translation pending",
    original_language_code: "en"
  };
}

function accountTemplate(branch, index, sourceTag) {
  const kinds = ["asset", "liability", "equity", "income", "expense"];
  const kind = kinds[(index - 1) % kinds.length];
  const serial = String(index).padStart(2, "0");
  return {
    scope: "city_branch",
    country_id: branch.countryId,
    country_branch_id: branch.countryBranchId,
    city_branch_id: branch.cityBranchId,
    parent_id: null,
    code: `${sourceTag}-${branch.branchCode}-${serial}`,
    name: `DEV TEST ${branch.label} Account ${serial}`,
    kind,
    currency: branch.currency,
    opening_balance: 0,
    current_balance: 0,
    status: "active",
    is_control_account: false,
    account_number: `${sourceTag}-${branch.branchCode}-ACC-${serial}`,
    customer_number: `${sourceTag}-${branch.branchCode}-CUS-${serial}`,
    account_serial_number: BigInt(branch.accountSerialBase + index),
    creation_date: new Date(),
    branch_code: branch.branchCode,
    branch_account_sequence: BigInt(index),
    country_serial_number: `${branch.countryCode}-${sourceTag}-${serial}`,
    branch_serial_number: `${branch.branchCode}-${sourceTag}-${serial}`,
    manual_reference_number: sourceTag,
    customer_id: null,
    company_id: null,
    bank_id: null,
    contacts: []
  };
}

function adminSpec(branch) {
  const code = `DEVTEST-${branch.branchCode}-ADMIN`;
  return {
    email: `devtest.${slugify(branch.branchCode)}.admin@dgt.llc`,
    password: "DevTest@12345",
    fullName: `DEV TEST Branch Admin - ${branch.label}`,
    userCode: code,
    role: "city_branch_admin",
    scope: {
      country_id: branch.countryId,
      country_branch_id: branch.countryBranchId,
      city_branch_id: branch.cityBranchId
    }
  };
}

async function ensureProfileAndRole(tx, userId, spec) {
  await tx`
    INSERT INTO profiles (id, full_name, user_code, raw_password, preferred_language_code, updated_at)
    VALUES (${userId}, ${spec.fullName}, ${spec.userCode}, ${spec.password}, 'en', NOW())
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      user_code = EXCLUDED.user_code,
      raw_password = EXCLUDED.raw_password,
      preferred_language_code = EXCLUDED.preferred_language_code,
      updated_at = NOW()
  `;

  await tx`DELETE FROM user_role_assignments WHERE user_id = ${userId}`;
  await tx`
    INSERT INTO user_role_assignments (
      user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at, updated_at
    ) VALUES (
      ${userId},
      ${spec.role}::app_role,
      ${spec.scope.country_id ?? null},
      ${spec.scope.country_branch_id ?? null},
      ${spec.scope.city_branch_id ?? null},
      true,
      NOW(),
      NOW()
    )
  `;
}

async function ensureBranchAdmin(sql, branch) {
  const spec = adminSpec(branch);
  const existing = await sql`SELECT id FROM auth.users WHERE lower(email) = lower(${spec.email}) LIMIT 1`;
  let userId = existing[0]?.id ?? null;

  await sql.begin(async (tx) => {
    if (userId) {
      await tx`
        UPDATE auth.users
        SET encrypted_password = crypt(${spec.password}, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = ${userId}
      `;
    } else {
      const inserted = await tx`
        INSERT INTO auth.users (
          id, instance_id, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
          gen_random_uuid(),
          '00000000-0000-0000-0000-000000000000',
          ${spec.email},
          crypt(${spec.password}, gen_salt('bf')),
          NOW(),
          '{"provider":"email","providers":["email"]}',
          ${tx.json({ full_name: spec.fullName, source_tag: branch.sourceTag })},
          NOW(),
          NOW(),
          'authenticated',
          'authenticated'
        )
        RETURNING id
      `;
      userId = inserted[0].id;
    }

    await ensureProfileAndRole(tx, userId, spec);
  });

  return { ...spec, userId };
}

async function ensureCityBranch(sql, country, countryBranch, branchSpec, sourceTag) {
  const existing = await sql`
    SELECT id, country_id, country_branch_id, city_name, name, code, local_currency, state_province_id, city_id, district_id
    FROM city_branches
    WHERE country_id = ${country.id}
      AND upper(code) = upper(${branchSpec.code})
      AND deleted_at IS NULL
    LIMIT 1
  `;
  if (existing[0]) {
    return { ...existing[0], created: false };
  }

  const cityRow = branchSpec.cityName
    ? await sql`
        SELECT id
        FROM cities
        WHERE country_id = ${country.id}
          AND lower(name) = lower(${branchSpec.cityName})
          AND deleted_at IS NULL
        LIMIT 1
      `
    : [];
  const stateRow = branchSpec.cityName
    ? await sql`
        SELECT id
        FROM states_provinces
        WHERE country_id = ${country.id}
          AND deleted_at IS NULL
        ORDER BY id
        LIMIT 1
      `
    : [];
  const districtRow = branchSpec.cityName
    ? await sql`
        SELECT id
        FROM districts
        WHERE country_id = ${country.id}
          AND deleted_at IS NULL
        ORDER BY id
        LIMIT 1
      `
    : [];

  const created = await sql`
    INSERT INTO city_branches (
      country_id, country_branch_id, city_name, name, code, local_currency,
      status, created_by, state_province_id, city_id, area_location_id, address,
      phone, email, company_id, owner_name, contacts, documents,
      permission_template, permission_grants, whatsapp_number, district_id
    ) VALUES (
      ${country.id},
      ${countryBranch.id},
      ${branchSpec.cityName},
      ${branchSpec.name},
      ${branchSpec.code},
      ${branchSpec.localCurrency},
      'active',
      null,
      ${stateRow[0]?.id ?? null},
      ${cityRow[0]?.id ?? null},
      null,
      ${branchSpec.address ?? null},
      ${branchSpec.phone ?? null},
      ${branchSpec.email},
      ${branchSpec.companyId ?? null},
      ${branchSpec.ownerName ?? null},
      '[]'::jsonb,
      '[]'::jsonb,
      'city-standard',
      ${sql.json([{ source_tag: sourceTag }])},
      ${branchSpec.whatsappNumber ?? null},
      ${districtRow[0]?.id ?? null}
    )
    RETURNING id, country_id, country_branch_id, city_name, name, code, local_currency, state_province_id, city_id, district_id
  `;
  return { ...created[0], created: true };
}

async function ensureCountryMasterData(sql, country, sourceTag) {
  const counts = { companies: 0, banks: 0, customers: 0, skippedCompanies: 0, skippedBanks: 0, skippedCustomers: 0 };
  const countryCode = country.iso2 || slugify(country.name).slice(0, 2).toUpperCase();

  for (let i = 1; i <= 10; i += 1) {
    const companyName = buildName("DEV TEST", `${countryCode} Company`, i, sourceTag);
    const existingCompany = await sql`SELECT id FROM companies WHERE deleted_at IS NULL AND name = ${companyName} LIMIT 1`;
    if (existingCompany[0]) {
      counts.skippedCompanies += 1;
    } else {
      await sql`
        INSERT INTO companies (
          name, legal_name, base_currency, is_active, owner_name, business_type,
          country_id, country_name, address, contacts, registrations, owner_ids
        ) VALUES (
          ${companyName},
          ${`DEV TEST ${countryCode} Company Legal ${String(i).padStart(2, "0")}`},
          ${currencyForCountry(countryCode)},
          true,
          ${`DEV TEST Owner ${String(i).padStart(2, "0")}`},
          'TEST',
          ${country.id},
          ${country.name},
          ${`DEV TEST ${countryCode} company address ${String(i).padStart(2, "0")}`},
          '[]'::jsonb,
          ${sql.json([{ source_tag: sourceTag }])},
          '[]'::jsonb
        )
      `;
      counts.companies += 1;
    }

    const bankName = buildName("DEV TEST", `${countryCode} Bank`, i, sourceTag);
    const existingBank = await sql`SELECT id FROM banks WHERE deleted_at IS NULL AND bank_name = ${bankName} LIMIT 1`;
    if (existingBank[0]) {
      counts.skippedBanks += 1;
    } else {
      const suffix = `${countryCode}-${String(i).padStart(2, "0")}`;
      await sql`
        INSERT INTO banks (
          bank_type, account_type, bank_name, branch_name, branch_code, branch_code_type,
          short_name, account_title, account_number, iban_number, currency, account_status,
          country_id, full_address, phone, email, swift_bic, website, remarks
        ) VALUES (
          'Commercial',
          'Current',
          ${bankName},
          ${`DEV TEST ${countryCode} Branch ${String(i).padStart(2, "0")}`},
          ${`${sourceTag}-${suffix}-BR`},
          'TEST',
          ${`DT${countryCode}${String(i).padStart(2, "0")}`},
          ${`DEV TEST ${countryCode} Bank Account ${String(i).padStart(2, "0")}`},
          ${`${sourceTag}-${suffix}-ACCT`},
          null,
          ${currencyForCountry(countryCode)},
          'Active',
          ${country.id},
          ${`DEV TEST ${countryCode} banking address ${String(i).padStart(2, "0")}`},
          ${`+000000${String(i).padStart(4, "0")}`},
          ${`devtest.${slugify(countryCode)}.bank.${i}@example.invalid`},
          null,
          null,
          ${sourceTag}
        )
      `;
      counts.banks += 1;
    }

    const customerName = buildName("DEV TEST", `${countryCode} Customer`, i, sourceTag);
    const existingCustomer = await sql`SELECT id FROM customers WHERE deleted_at IS NULL AND customer_name = ${customerName} AND country_id = ${country.id} LIMIT 1`;
    if (existingCustomer[0]) {
      counts.skippedCustomers += 1;
    } else {
      await sql`
        INSERT INTO customers (
          country_id, customer_name, company_name, contact_person, mobile, whatsapp, email,
          address, notes, original_language_code
        ) VALUES (
          ${country.id},
          ${customerName},
          ${`DEV TEST ${countryCode} Trading ${String(i).padStart(2, "0")}`},
          ${`DEV TEST Contact ${String(i).padStart(2, "0")}`},
          ${`+000100${String(i).padStart(4, "0")}`},
          ${`+000100${String(i).padStart(4, "0")}`},
          ${`devtest.${slugify(countryCode)}.customer.${i}@example.invalid`},
          ${`DEV TEST ${countryCode} customer address ${String(i).padStart(2, "0")}`},
          ${sourceTag},
          'en'
        )
      `;
      counts.customers += 1;
    }
  }

  return counts;
}

async function ensureBranchMasterData(sql, branch, sourceTag) {
  const counts = { accounts: 0, warehouses: 0, employees: 0, skippedAccounts: 0, skippedWarehouses: 0, skippedEmployees: 0 };

  for (let i = 1; i <= 10; i += 1) {
    const accountNumber = `${sourceTag}-${branch.branchCode}-ACC-${String(i).padStart(2, "0")}`;
    const existingAccount = await sql`
      SELECT id FROM enterprise_accounts
      WHERE deleted_at IS NULL AND account_number = ${accountNumber}
      LIMIT 1
    `;
    if (existingAccount[0]) {
      counts.skippedAccounts += 1;
    } else {
      await sql`
        INSERT INTO enterprise_accounts (
          scope, country_id, country_branch_id, city_branch_id, parent_id, code, name, kind, currency,
          opening_balance, current_balance, status, is_control_account, account_number, customer_number,
          account_serial_number, creation_date, branch_code, branch_account_sequence, country_serial_number,
          branch_serial_number, manual_reference_number, customer_id, company_id, bank_id, contacts
        ) VALUES (
          'city_branch',
          ${branch.countryId},
          ${branch.countryBranchId},
          ${branch.cityBranchId},
          null,
          ${`${sourceTag}-${branch.branchCode}-${String(i).padStart(2, "0")}`},
          ${`DEV TEST ${branch.label} Account ${String(i).padStart(2, "0")}`},
          ${["asset", "liability", "equity", "income", "expense"][(i - 1) % 5]},
          ${branch.currency},
          0,
          0,
          'active',
          false,
          ${accountNumber},
          ${`${sourceTag}-${branch.branchCode}-CUS-${String(i).padStart(2, "0")}`},
          ${BigInt(branch.accountSerialBase + i)},
          NOW(),
          ${branch.branchCode},
          ${BigInt(i)},
          ${`${branch.countryCode}-${sourceTag}-${String(i).padStart(2, "0")}`},
          ${`${branch.branchCode}-${sourceTag}-${String(i).padStart(2, "0")}`},
          ${`${sourceTag}-${branch.branchCode}-${String(i).padStart(2, "0")}`},
          null,
          null,
          null,
          '[]'::jsonb
        )
      `;
      counts.accounts += 1;
    }

    const warehouseName = buildName("DEV TEST", `${branch.label} Warehouse`, i, sourceTag);
    const existingWarehouse = await sql`
      SELECT id FROM warehouses
      WHERE deleted_at IS NULL AND country_id = ${branch.countryId} AND lower(warehouse_name) = lower(${warehouseName})
      LIMIT 1
    `;
    if (existingWarehouse[0]) {
      counts.skippedWarehouses += 1;
    } else {
      await sql`
        INSERT INTO warehouses (
          country_id, state_province_id, district_id, city_id, area_id, owner_name, warehouse_code,
          warehouse_name, warehouse_type, full_address, contact_number, status, description,
          name_en, name_ur, name_ar, name_fa, name_ps, original_language_code, is_active, created_by
        ) VALUES (
          ${branch.countryId},
          ${branch.stateProvinceId ?? null},
          ${branch.districtId ?? null},
          ${branch.cityId ?? null},
          null,
          ${`DEV TEST ${branch.label} Owner ${String(i).padStart(2, "0")}`},
          ${`${sourceTag}-${branch.branchCode}-${String(i).padStart(2, "0")}`},
          ${warehouseName},
          'general',
          ${`DEV TEST ${branch.label} warehouse address ${String(i).padStart(2, "0")}`},
          ${`+000200${String(i).padStart(4, "0")}`},
          'Active',
          ${sourceTag},
          ${warehouseName},
          'Translation pending',
          'Translation pending',
          'Translation pending',
          'Translation pending',
          'en',
          true,
          null
        )
      `;
      counts.warehouses += 1;
    }

    const employeeCode = `${sourceTag}-${branch.branchCode}-EMP-${String(i).padStart(2, "0")}`;
    const existingEmployee = await sql`
      SELECT id FROM employees
      WHERE deleted_at IS NULL AND employee_code = ${employeeCode}
      LIMIT 1
    `;
    if (existingEmployee[0]) {
      counts.skippedEmployees += 1;
    } else {
      const customerName = `DEV TEST ${branch.label} Employee Person ${String(i).padStart(2, "0")}`;
      const person = await sql`
        INSERT INTO customers (
          country_id, customer_name, company_name, contact_person, mobile, whatsapp, email,
          address, notes, original_language_code
        ) VALUES (
          ${branch.countryId},
          ${customerName},
          ${`DEV TEST ${branch.label} Employee Co ${String(i).padStart(2, "0")}`},
          ${customerName},
          ${`+000300${String(i).padStart(4, "0")}`},
          ${`+000300${String(i).padStart(4, "0")}`},
          ${`devtest.${slugify(branch.branchCode)}.employee.${i}@example.invalid`},
          ${`DEV TEST ${branch.label} employee address ${String(i).padStart(2, "0")}`},
          ${sourceTag},
          'en'
        )
        RETURNING id
      `;
      await sql`
        INSERT INTO employees (
          person_master_id, employee_code, category, designation, department, country_id,
          country_branch_id, city_branch_id, monthly_salary, salary_currency, status,
          salary_type, basic_salary, net_salary, created_by
        ) VALUES (
          ${person[0].id},
          ${employeeCode},
          ${i % 2 === 0 ? "Normal Staff" : "Manager"},
          ${`DEV TEST ${branch.label} Designation ${String(i).padStart(2, "0")}`},
          ${`DEV TEST ${branch.label} Department ${String(i).padStart(2, "0")}`},
          ${branch.countryId},
          ${branch.countryBranchId},
          ${branch.cityBranchId},
          ${1500 + (i * 100)},
          ${branch.currency},
          'Active',
          'Monthly',
          ${1500 + (i * 100)},
          ${1500 + (i * 100)},
          null
        )
      `;
      counts.employees += 1;
    }
  }

  return counts;
}

async function ensureScopedAdmin(sql, spec) {
  const existing = await sql`SELECT id FROM auth.users WHERE lower(email) = lower(${spec.email}) LIMIT 1`;
  let userId = existing[0]?.id ?? null;

  await sql.begin(async (tx) => {
    if (userId) {
      await tx`
        UPDATE auth.users
        SET encrypted_password = crypt(${spec.password}, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = ${userId}
      `;
    } else {
      const inserted = await tx`
        INSERT INTO auth.users (
          id, instance_id, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
          gen_random_uuid(),
          '00000000-0000-0000-0000-000000000000',
          ${spec.email},
          crypt(${spec.password}, gen_salt('bf')),
          NOW(),
          '{"provider":"email","providers":["email"]}',
          ${tx.json({ full_name: spec.fullName, source_tag: spec.sourceTag })},
          NOW(),
          NOW(),
          'authenticated',
          'authenticated'
        )
        RETURNING id
      `;
      userId = inserted[0].id;
    }

    await tx`
      INSERT INTO profiles (id, full_name, user_code, raw_password, preferred_language_code, updated_at)
      VALUES (${userId}, ${spec.fullName}, ${spec.userCode}, ${spec.password}, 'en', NOW())
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        user_code = EXCLUDED.user_code,
        raw_password = EXCLUDED.raw_password,
        preferred_language_code = EXCLUDED.preferred_language_code,
        updated_at = NOW()
    `;

    await tx`DELETE FROM user_role_assignments WHERE user_id = ${userId}`;
    await tx`
      INSERT INTO user_role_assignments (
        user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at, updated_at
      ) VALUES (
        ${userId},
        ${spec.role}::app_role,
        ${spec.scope.country_id ?? null},
        ${spec.scope.country_branch_id ?? null},
        ${spec.scope.city_branch_id ?? null},
        true,
        NOW(),
        NOW()
      )
    `;
  });

  return { ...spec, userId };
}

async function main() {
  await loadEnvFile(path.join(process.cwd(), ".env.local"));
  await loadEnvFile(path.join(process.cwd(), ".env"));
  const args = parseArgs(process.argv.slice(2));

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const rawDbUrl = process.env.DATABASE_URL || "";
  const ref = extractSupabaseRef(rawUrl);
  const prodRef = process.env.PROD_SUPABASE_REF?.trim() || PROD_REF;
  const devRef = process.env.DEV_SUPABASE_REF?.trim() || TARGET_REF;

  if (!args.confirmLocalDev) {
    throw new Error("Missing --confirm-local-dev. Refusing to run without explicit local-dev confirmation.");
  }
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("Refusing to run in a production-like NODE_ENV/APP_ENV.");
  }
  if (ref !== TARGET_REF) {
    throw new Error(`Supabase ref mismatch: expected ${TARGET_REF}, got ${ref ?? "null"}.`);
  }
  if (ref === prodRef || rawUrl.includes(prodRef) || rawDbUrl.includes(prodRef)) {
    throw new Error(`Ref ${ref} matches production ref ${prodRef}; refusing to proceed.`);
  }
  if (devRef !== TARGET_REF) {
    throw new Error(`DEV_SUPABASE_REF mismatch: expected ${TARGET_REF}, got ${devRef}.`);
  }
  if (!rawDbUrl.includes(TARGET_REF)) {
    throw new Error("DATABASE_URL does not point at the authorized dev project ref.");
  }

  const sql = postgres(rawDbUrl, { max: 4, prepare: false, connect_timeout: 30 });
  const sourceTag = args.sourceTag;
  const countryNames = ["Afghanistan", "India", "Pakistan", "United Arab Emirates"];
  const targetCountryRows = await sql`
    SELECT id, name, upper(coalesce(iso2, '')) AS iso2, currency_code
    FROM countries
    WHERE deleted_at IS NULL
      AND name = ANY(${countryNames})
    ORDER BY name
  `;
  const countries = new Map(targetCountryRows.map((row) => [row.name, row]));

  if (countries.size !== countryNames.length) {
    throw new Error(`Missing target countries. Found: ${[...countries.keys()].join(", ") || "none"}`);
  }

  const mainBranches = await sql`
    SELECT id, country_id, name, code, local_currency, state_province_id, city_id, district_id, company_id, owner_name
    FROM country_branches
    WHERE deleted_at IS NULL
      AND country_id = ANY(${targetCountryRows.map((row) => row.id)})
  `;

  const countryBranchByCountry = new Map();
  for (const row of mainBranches) {
    if (!countryBranchByCountry.has(row.country_id)) {
      countryBranchByCountry.set(row.country_id, row);
    }
  }
  for (const country of targetCountryRows) {
    if (!countryBranchByCountry.has(country.id)) {
      throw new Error(`Missing main country branch for ${country.name}`);
    }
  }

  const existingTargets = await sql`
    SELECT id, country_id, country_branch_id, city_name, name, code, local_currency
    FROM city_branches
    WHERE deleted_at IS NULL
      AND country_id = ANY(${targetCountryRows.map((row) => row.id)})
      AND (
        upper(code) IN ('DEV-AE-CITY-001', 'DEV-PK-CITY-001', 'DEV-AF-CITY-001', 'DEV-IN-CITY-001', 'DEV-AF-TEST-CITY-001', 'DEV-IN-TEST-MUMBAI-001')
        OR lower(name) LIKE '%dev demo%'
        OR lower(name) LIKE '%dev test%'
      )
    ORDER BY country_id, name
  `;

  const branchSpecs = [
    {
      countryCode: "AE",
      countryName: "United Arab Emirates",
      code: "DEV-AE-TEST-DUBAI-001",
      cityName: "Dubai",
      name: "DEV TEST Dubai City Branch",
      localCurrency: "AED",
      email: "devtest.dubai.test@dgt.llc",
      branchCode: "DEV-AE-TEST-DUBAI-001"
    },
    {
      countryCode: "PK",
      countryName: "Pakistan",
      code: "DEV-PK-TEST-KARACHI-001",
      cityName: "Karachi",
      name: "DEV TEST Karachi City Branch",
      localCurrency: "PKR",
      email: "devtest.karachi.test@dgt.llc",
      branchCode: "DEV-PK-TEST-KARACHI-001"
    },
    {
      countryCode: "AF",
      countryName: "Afghanistan",
      code: "DEV-AF-TEST-KABUL-001",
      cityName: "Kabul",
      name: "DEV TEST Kabul City Branch",
      localCurrency: "AFN",
      email: "devtest.kabul.test@dgt.llc",
      branchCode: "DEV-AF-TEST-KABUL-001"
    },
    {
      countryCode: "IN",
      countryName: "India",
      code: "DEV-IN-TEST-MUMBAI-001",
      cityName: "Mumbai",
      name: "DEV TEST Mumbai City Branch",
      localCurrency: "INR",
      email: "devtest.mumbai.test@dgt.llc",
      branchCode: "DEV-IN-TEST-MUMBAI-001"
    },
    {
      countryCode: "PK",
      countryName: "Pakistan",
      code: "DEV-PK-TEST-QUETTA-001",
      cityName: "Quetta",
      name: "DEV TEST Quetta City Branch",
      localCurrency: "PKR",
      email: "devtest.quetta.test@dgt.llc",
      branchCode: "DEV-PK-TEST-QUETTA-001"
    }
  ];

  console.log("=== DEV TEST master-data seed preflight ===");
  console.log(`Target ref: ${ref}`);
  console.log(`Production ref: ${prodRef}`);
  console.log(`Dev ref: ${devRef}`);
  console.log(`Source tag: ${sourceTag}`);
  console.log(`Countries found: ${[...countries.keys()].join(", ")}`);
  console.log(`Existing city branch candidates found: ${existingTargets.length}`);

  const createdBranches = [];
  for (const spec of branchSpecs) {
    const country = countries.get(spec.countryName);
    const countryBranch = countryBranchByCountry.get(country.id);
    const branchInfo = {
      ...spec,
      countryId: country.id,
      countryBranchId: countryBranch.id,
      cityBranchId: null,
      currency: spec.localCurrency,
      accountSerialBase: Number(spec.countryCode.charCodeAt(0)) * 1000,
      sourceTag,
      label: spec.name
    };
    const branch = await ensureCityBranch(sql, country, countryBranch, branchInfo, sourceTag);
    createdBranches.push({ ...branchInfo, cityBranchId: branch.id, created: branch.created });
  }

  const uaeCountry = countries.get("United Arab Emirates");
  const uaeMainBranch = countryBranchByCountry.get(uaeCountry.id);
  if (!uaeMainBranch) {
    throw new Error("Missing UAE main country branch.");
  }
  const uaeMainAdmin = await ensureScopedAdmin(sql, {
    email: "devtest.uae.main.admin@dgt.llc",
    password: "DevTest@12345",
    fullName: "DEV TEST UAE Main Branch Admin",
    userCode: "DEVTEST-UAE-MAIN-ADMIN",
    role: "main_branch_admin",
    scope: { country_id: uaeCountry.id, country_branch_id: uaeMainBranch.id, city_branch_id: null },
    sourceTag
  });

  const countrySummary = [];
  for (const country of targetCountryRows) {
    const summary = await ensureCountryMasterData(sql, { ...country, iso2: country.iso2 || slugify(country.name).slice(0, 2).toUpperCase() }, sourceTag);
    countrySummary.push({ country: country.name, ...summary });
  }

  const branchSummary = [];
  for (const branch of createdBranches) {
    const cityBranchRow = await sql`
      SELECT id, country_id, country_branch_id, city_name, name, code, local_currency, state_province_id, city_id, district_id
      FROM city_branches
      WHERE deleted_at IS NULL AND id = ${branch.cityBranchId}
      LIMIT 1
    `;
    if (!cityBranchRow[0]) {
      throw new Error(`Unable to resolve city branch row for ${branch.branchCode}`);
    }
    const branchCurrency = branch.currency || cityBranchRow[0].local_currency || currencyForCountry(branch.countryCode);
    const branchRecord = {
      ...branch,
      countryId: branch.countryId,
      countryBranchId: branch.countryBranchId,
      cityBranchId: cityBranchRow[0].id,
      stateProvinceId: cityBranchRow[0].state_province_id,
      cityId: cityBranchRow[0].city_id,
      districtId: cityBranchRow[0].district_id,
      currency: branchCurrency
    };
    const masterDataSummary = await ensureBranchMasterData(sql, branchRecord, sourceTag);
    const admin = await ensureScopedAdmin(sql, {
      email: `devtest.${slugify(branchRecord.branchCode)}.admin@dgt.llc`,
      password: "DevTest@12345",
      fullName: `DEV TEST Branch Admin - ${branchRecord.label}`,
      userCode: `DEVTEST-${branchRecord.branchCode}-ADMIN`,
      role: "city_branch_admin",
      scope: {
        country_id: branchRecord.countryId,
        country_branch_id: branchRecord.countryBranchId,
        city_branch_id: branchRecord.cityBranchId
      },
      sourceTag
    });
    branchSummary.push({
      branch: branchRecord.label,
      country: branchRecord.countryCode,
      code: branchRecord.branchCode,
      created: branch.created,
      adminEmail: admin.email,
      masterDataSummary
    });
  }

  console.log("=== Seed summary ===");
  console.table(countrySummary);
  console.table(branchSummary.map((row) => ({
    branch: row.branch,
    code: row.code,
    created: row.created ? "created" : "existing",
    adminEmail: row.adminEmail,
    accounts: row.masterDataSummary.accounts,
    warehouses: row.masterDataSummary.warehouses,
    employees: row.masterDataSummary.employees,
    skippedAccounts: row.masterDataSummary.skippedAccounts,
    skippedWarehouses: row.masterDataSummary.skippedWarehouses,
    skippedEmployees: row.masterDataSummary.skippedEmployees
  })));
  console.log("Main branch admin:");
  console.table([{
    branch: "UAE Main Branch",
    code: uaeMainBranch.code,
    role: uaeMainAdmin.role,
    email: uaeMainAdmin.email,
    userId: uaeMainAdmin.userId
  }]);

  console.log("Cleanup path:");
  console.log("  scripts/cleanup-dev-test-master-data.mjs --confirm-local-dev --source-tag", sourceTag);
  console.log("Access note:");
  console.log("  Branch admins are accessed by email/password in the local development app; the password is generated in the script and not printed.");

  await sql.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[DEV TEST SEED] Failed:", err?.message || err);
  if (err?.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
});
