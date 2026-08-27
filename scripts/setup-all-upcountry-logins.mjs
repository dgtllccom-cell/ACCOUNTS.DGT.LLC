import postgres from "postgres";
import fs from "fs";

function loadEnv() {
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
      if (line.trim().startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
      if (line.trim().startsWith("SUPABASE_SECRET_KEY=")) {
        process.env.SUPABASE_SECRET_KEY = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const sql = postgres(dbUrl, { max: 10 });
const DEFAULT_PASSWORD = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD || "Admin@123";

async function main() {
  console.log("==========================================================================");
  console.log("🔐 COMPLETE UPCOUNTRY LOGIN & BRANCH STRUCTURE SETUP");
  console.log("==========================================================================\n");

  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;

  // 1. Ensure Standard Countries
  const stdCountries = [
    { name: "Pakistan", iso2: "PK", iso3: "PAK", currency: "PKR" },
    { name: "Afghanistan", iso2: "AF", iso3: "AFG", currency: "AFN" },
    { name: "United Arab Emirates", iso2: "AE", iso3: "ARE", currency: "AED" },
    { name: "India", iso2: "IN", iso3: "IND", currency: "INR" },
    { name: "China", iso2: "CN", iso3: "CHN", currency: "CNY" }
  ];

  for (const sc of stdCountries) {
    const [existing] = await sql`
      SELECT id FROM public.countries 
      WHERE name ILIKE ${sc.name} OR iso2 = ${sc.iso2} 
      LIMIT 1;
    `;
    if (!existing) {
      await sql`
        INSERT INTO public.countries (
          name, iso2, iso3, currency_code, is_active, official_email, admin_email, created_at, updated_at
        ) VALUES (
          ${sc.name}, ${sc.iso2}, ${sc.iso3}, ${sc.currency}, true,
          ${`info@${sc.iso2.toLowerCase()}.dgt.llc`}, ${`admin@${sc.iso2.toLowerCase()}.dgt.llc`},
          NOW(), NOW()
        );
      `;
    } else {
      await sql`
        UPDATE public.countries
        SET iso2 = ${sc.iso2},
            iso3 = ${sc.iso3},
            currency_code = ${sc.currency},
            is_active = true,
            updated_at = NOW()
        WHERE id = ${existing.id};
      `;
    }
  }

  const countries = await sql`
    SELECT id, name, iso2, iso3, currency_code FROM public.countries WHERE is_active = true;
  `;
  const countryMap = new Map();
  for (const c of countries) {
    if (c.iso2) countryMap.set(c.iso2.toUpperCase(), c);
    if (c.name) countryMap.set(c.name.toLowerCase(), c);
  }

  // 2. Ensure Country Main Branches
  const stdMainBranches = [
    { countryIso: "PK", name: "Pakistan Main Branch", code: "PAK-MAIN-001" },
    { countryIso: "AF", name: "Afghanistan Main Branch", code: "AFG-MAIN-001" },
    { countryIso: "AE", name: "United Arab Emirates Main Branch", code: "ARE-MAIN-001" },
    { countryIso: "IN", name: "India Main Branch", code: "IND-MAIN-001" },
    { countryIso: "CN", name: "China Main Branch", code: "CHN-MAIN-001" }
  ];

  for (const smb of stdMainBranches) {
    const country = countryMap.get(smb.countryIso);
    if (!country) continue;

    const [existing] = await sql`
      SELECT id FROM public.country_branches 
      WHERE country_id = ${country.id} AND (is_main = true OR code = ${smb.code})
      LIMIT 1;
    `;

    if (!existing) {
      await sql`
        INSERT INTO public.country_branches (
          country_id, name, code, local_currency, is_main, email, phone, created_at, updated_at
        ) VALUES (
          ${country.id}, ${smb.name}, ${smb.code}, ${country.currency_code}, true,
          ${`branch@${smb.countryIso.toLowerCase()}.dgt.llc`}, '+971-50-0000000',
          NOW(), NOW()
        );
      `;
    }
  }

  const countryBranches = await sql`
    SELECT id, country_id, name, code, is_main FROM public.country_branches WHERE deleted_at IS NULL;
  `;
  const cbMap = new Map();
  for (const cb of countryBranches) {
    cbMap.set(cb.country_id, cb);
  }

  // 3. Ensure Standard City Branches
  const stdCityBranches = [
    // Pakistan
    { countryIso: "PK", name: "Chaman City Branch", code: "PAK-CHM-001", cityName: "Chaman" },
    { countryIso: "PK", name: "Quetta City Branch", code: "PAK-QTA-001", cityName: "Quetta" },
    { countryIso: "PK", name: "Karachi City Branch", code: "PAK-KHI-001", cityName: "Karachi" },
    { countryIso: "PK", name: "Lahore City Branch", code: "PAK-LHE-001", cityName: "Lahore" },
    { countryIso: "PK", name: "Islamabad City Branch", code: "PAK-ISB-001", cityName: "Islamabad" },
    { countryIso: "PK", name: "Peshawar City Branch", code: "PAK-PEW-001", cityName: "Peshawar" },
    { countryIso: "PK", name: "Gwadar Port Branch", code: "PAK-GWD-001", cityName: "Gwadar" },
    { countryIso: "PK", name: "Torkham Border Branch", code: "PAK-TKM-001", cityName: "Torkham" },

    // Afghanistan
    { countryIso: "AF", name: "Kabul City Branch", code: "AFG-KBL-001", cityName: "Kabul" },
    { countryIso: "AF", name: "Kandahar City Branch", code: "AFG-KDH-001", cityName: "Kandahar" },
    { countryIso: "AF", name: "Herat City Branch", code: "AFG-HRT-001", cityName: "Herat" },
    { countryIso: "AF", name: "Spin Boldak Branch", code: "AFG-SBD-001", cityName: "Spin Boldak" },
    { countryIso: "AF", name: "Mazar-i-Sharif Branch", code: "AFG-MZR-001", cityName: "Mazar-i-Sharif" },

    // United Arab Emirates
    { countryIso: "AE", name: "Dubai City Branch", code: "ARE-DXB-001", cityName: "Dubai" },
    { countryIso: "AE", name: "Abu Dhabi City Branch", code: "ARE-AUH-001", cityName: "Abu Dhabi" },
    { countryIso: "AE", name: "Sharjah City Branch", code: "ARE-SHJ-001", cityName: "Sharjah" },
    { countryIso: "AE", name: "Jebel Ali Port Branch", code: "ARE-JAF-001", cityName: "Jebel Ali" },

    // India
    { countryIso: "IN", name: "New Delhi City Branch", code: "IND-DEL-001", cityName: "Delhi" },
    { countryIso: "IN", name: "Mumbai City Branch", code: "IND-BOM-001", cityName: "Mumbai" },
    { countryIso: "IN", name: "Attari Border Branch", code: "IND-ATR-001", cityName: "Attari" },

    // China
    { countryIso: "CN", name: "Shenzhen City Branch", code: "CHN-SZX-001", cityName: "Shenzhen" },
    { countryIso: "CN", name: "Dalian City Branch", code: "CHN-DLC-001", cityName: "Dalian" },
    { countryIso: "CN", name: "Guangzhou City Branch", code: "CHN-CAN-001", cityName: "Guangzhou" }
  ];

  for (const scb of stdCityBranches) {
    const country = countryMap.get(scb.countryIso);
    if (!country) continue;
    const countryBranch = cbMap.get(country.id);
    if (!countryBranch) continue;

    const [existing] = await sql`
      SELECT id FROM public.city_branches 
      WHERE country_id = ${country.id} AND (name ILIKE ${'%' + scb.cityName + '%'} OR code = ${scb.code})
      LIMIT 1;
    `;

    if (!existing) {
      const cleanCity = scb.cityName.toLowerCase().replace(/\s+/g, '');
      await sql`
        INSERT INTO public.city_branches (
          country_id, country_branch_id, city_name, name, code, local_currency, email, phone, created_at, updated_at
        ) VALUES (
          ${country.id}, ${countryBranch.id}, ${scb.cityName}, ${scb.name}, ${scb.code}, ${country.currency_code},
          ${`${cleanCity}@${scb.countryIso.toLowerCase()}.dgt.llc`}, '+971-50-0000000',
          NOW(), NOW()
        );
      `;
    }
  }

  // Reload City Branches
  const cityBranches = await sql`
    SELECT id, country_id, country_branch_id, name, code, city_name FROM public.city_branches WHERE deleted_at IS NULL;
  `;

  function resolveCityBranch(countryIso2, cityNamePattern) {
    const c = countryMap.get(countryIso2.toUpperCase());
    if (!c) return null;
    const pat = cityNamePattern.toLowerCase();
    return cityBranches.find(cb => 
      cb.country_id === c.id && 
      ((cb.city_name && cb.city_name.toLowerCase().includes(pat)) ||
       (cb.name && cb.name.toLowerCase().includes(pat)) || 
       (cb.code && cb.code.toLowerCase().includes(pat)))
    ) || null;
  }

  function resolveCountryBranch(countryIso2) {
    const c = countryMap.get(countryIso2.toUpperCase());
    if (!c) return null;
    return countryBranches.find(cb => cb.country_id === c.id && cb.is_main) ||
           countryBranches.find(cb => cb.country_id === c.id) || null;
  }

  // 4. Define All Target User Logins
  const userDefs = [
    // ── Global Super Admins ──
    {
      userCode: "SUPERADMIN@DGT.LLC",
      fullName: "Global Super Admin",
      role: "super_admin",
      countryIso: null,
      cityPattern: null,
      scopeType: "Global Super Admin (Full ERP Access)"
    },
    {
      userCode: "SUPERADMIN",
      fullName: "Super Admin",
      role: "super_admin",
      countryIso: null,
      cityPattern: null,
      scopeType: "Global Super Admin"
    },
    {
      userCode: "ASMATDGTLLC@USERS.DAMAAN.LOCAL",
      fullName: "Super Admin (Asmatullah)",
      role: "super_admin",
      countryIso: null,
      cityPattern: null,
      scopeType: "Global Super Admin"
    },

    // ── Country Admin Logins ──
    {
      userCode: "PAKISTAN@DGT.LLC",
      fullName: "Pakistan Country Admin",
      role: "country_admin",
      countryIso: "PK",
      cityPattern: null,
      scopeType: "Country Admin (Pakistan Full Scope)"
    },
    {
      userCode: "AFGHANISTAN@DGT.LLC",
      fullName: "Afghanistan Country Admin",
      role: "country_admin",
      countryIso: "AF",
      cityPattern: null,
      scopeType: "Country Admin (Afghanistan Full Scope)"
    },
    {
      userCode: "INDIA@DGT.LLC",
      fullName: "India Country Admin",
      role: "country_admin",
      countryIso: "IN",
      cityPattern: null,
      scopeType: "Country Admin (India Full Scope)"
    },
    {
      userCode: "UAE@DGT.DALNC",
      fullName: "United Arab Emirates Country Admin",
      role: "country_admin",
      countryIso: "AE",
      cityPattern: null,
      scopeType: "Country Admin (UAE Full Scope)"
    },
    {
      userCode: "UAE@DGT.LLC",
      fullName: "UAE Country Admin (Primary LLC)",
      role: "country_admin",
      countryIso: "AE",
      cityPattern: null,
      scopeType: "Country Admin (UAE Full Scope)"
    },
    {
      userCode: "CHINA@DGT.LLC",
      fullName: "China Country Admin",
      role: "country_admin",
      countryIso: "CN",
      cityPattern: null,
      scopeType: "Country Admin (China Full Scope)"
    },

    // ── City Branch Logins: Pakistan ──
    {
      userCode: "PK/CHAMAN@DGT.LLC",
      fullName: "Pakistan Chaman City Branch User",
      role: "city_branch_admin",
      countryIso: "PK",
      cityPattern: "chaman",
      scopeType: "City Branch User (Pakistan - Chaman)"
    },
    {
      userCode: "PK/QUETTA@DGT.LLC",
      fullName: "Pakistan Quetta City Branch User",
      role: "city_branch_admin",
      countryIso: "PK",
      cityPattern: "quetta",
      scopeType: "City Branch User (Pakistan - Quetta)"
    },
    {
      userCode: "PK/KARACHI@DGT.LLC",
      fullName: "Pakistan Karachi City Branch User",
      role: "city_branch_admin",
      countryIso: "PK",
      cityPattern: "karachi",
      scopeType: "City Branch User (Pakistan - Karachi)"
    },
    {
      userCode: "PK/LAHORE@DGT.LLC",
      fullName: "Pakistan Lahore City Branch User",
      role: "city_branch_admin",
      countryIso: "PK",
      cityPattern: "lahore",
      scopeType: "City Branch User (Pakistan - Lahore)"
    },
    {
      userCode: "PK/ISLAMABAD@DGT.LLC",
      fullName: "Pakistan Islamabad City Branch User",
      role: "city_branch_admin",
      countryIso: "PK",
      cityPattern: "islamabad",
      scopeType: "City Branch User (Pakistan - Islamabad)"
    },
    {
      userCode: "PK/PESHAWAR@DGT.LLC",
      fullName: "Pakistan Peshawar City Branch User",
      role: "city_branch_admin",
      countryIso: "PK",
      cityPattern: "peshawar",
      scopeType: "City Branch User (Pakistan - Peshawar)"
    },
    {
      userCode: "PK/GWADAR@DGT.LLC",
      fullName: "Pakistan Gwadar Port Branch User",
      role: "city_branch_admin",
      countryIso: "PK",
      cityPattern: "gwadar",
      scopeType: "City Branch User (Pakistan - Gwadar)"
    },
    {
      userCode: "PK/TORKHAM@DGT.LLC",
      fullName: "Pakistan Torkham Border Branch User",
      role: "city_branch_admin",
      countryIso: "PK",
      cityPattern: "torkham",
      scopeType: "City Branch User (Pakistan - Torkham)"
    },

    // ── City Branch Logins: Afghanistan ──
    {
      userCode: "AF/KABUL@DGT.DALNC",
      fullName: "Afghanistan Kabul City Branch User",
      role: "city_branch_admin",
      countryIso: "AF",
      cityPattern: "kabul",
      scopeType: "City Branch User (Afghanistan - Kabul)"
    },
    {
      userCode: "AF/KABUL@DGT.LLC",
      fullName: "Afghanistan Kabul Branch User (LLC)",
      role: "city_branch_admin",
      countryIso: "AF",
      cityPattern: "kabul",
      scopeType: "City Branch User (Afghanistan - Kabul)"
    },
    {
      userCode: "AF/KANDAHAR@DGT.LLC",
      fullName: "Afghanistan Kandahar City Branch User",
      role: "city_branch_admin",
      countryIso: "AF",
      cityPattern: "kandahar",
      scopeType: "City Branch User (Afghanistan - Kandahar)"
    },
    {
      userCode: "AF/HERAT@DGT.LLC",
      fullName: "Afghanistan Herat City Branch User",
      role: "city_branch_admin",
      countryIso: "AF",
      cityPattern: "herat",
      scopeType: "City Branch User (Afghanistan - Herat)"
    },
    {
      userCode: "AF/SPINBOLDAK@DGT.LLC",
      fullName: "Afghanistan Spin Boldak Branch User",
      role: "city_branch_admin",
      countryIso: "AF",
      cityPattern: "boldak",
      scopeType: "City Branch User (Afghanistan - Spin Boldak)"
    },
    {
      userCode: "AF/MAZAR@DGT.LLC",
      fullName: "Afghanistan Mazar-i-Sharif Branch User",
      role: "city_branch_admin",
      countryIso: "AF",
      cityPattern: "mazar",
      scopeType: "City Branch User (Afghanistan - Mazar-i-Sharif)"
    },

    // ── City Branch Logins: United Arab Emirates ──
    {
      userCode: "AE/DUBAI@DGT.LLC",
      fullName: "UAE Dubai City Branch User",
      role: "city_branch_admin",
      countryIso: "AE",
      cityPattern: "dubai",
      scopeType: "City Branch User (UAE - Dubai City Branch)"
    },
    {
      userCode: "AE/ABUDHABI@DGT.LLC",
      fullName: "UAE Abu Dhabi City Branch User",
      role: "city_branch_admin",
      countryIso: "AE",
      cityPattern: "abu dhabi",
      scopeType: "City Branch User (UAE - Abu Dhabi)"
    },
    {
      userCode: "AE/SHARJAH@DGT.LLC",
      fullName: "UAE Sharjah City Branch User",
      role: "city_branch_admin",
      countryIso: "AE",
      cityPattern: "sharjah",
      scopeType: "City Branch User (UAE - Sharjah)"
    },
    {
      userCode: "AE/JEBELALI@DGT.LLC",
      fullName: "UAE Jebel Ali Port Branch User",
      role: "city_branch_admin",
      countryIso: "AE",
      cityPattern: "jebel ali",
      scopeType: "City Branch User (UAE - Jebel Ali Port)"
    },

    // ── City Branch Logins: India ──
    {
      userCode: "IN/DELHI@DGT.LLC",
      fullName: "India New Delhi City Branch User",
      role: "city_branch_admin",
      countryIso: "IN",
      cityPattern: "delhi",
      scopeType: "City Branch User (India - New Delhi)"
    },
    {
      userCode: "IN/MUMBAI@DGT.LLC",
      fullName: "India Mumbai City Branch User",
      role: "city_branch_admin",
      countryIso: "IN",
      cityPattern: "mumbai",
      scopeType: "City Branch User (India - Mumbai)"
    },
    {
      userCode: "IN/ATTARI@DGT.LLC",
      fullName: "India Attari Border Branch User",
      role: "city_branch_admin",
      countryIso: "IN",
      cityPattern: "attari",
      scopeType: "City Branch User (India - Attari/Amritsar)"
    },

    // ── City Branch Logins: China ──
    {
      userCode: "CN/SHENZHEN@DGT.LLC",
      fullName: "China Shenzhen City Branch User",
      role: "city_branch_admin",
      countryIso: "CN",
      cityPattern: "shenzhen",
      scopeType: "City Branch User (China - Shenzhen)"
    },
    {
      userCode: "CN/DALIAN@DGT.LLC",
      fullName: "China Dalian City Branch User",
      role: "city_branch_admin",
      countryIso: "CN",
      cityPattern: "dalian",
      scopeType: "City Branch User (China - Dalian)"
    },
    {
      userCode: "CN/GUANGZHOU@DGT.LLC",
      fullName: "China Guangzhou City Branch User",
      role: "city_branch_admin",
      countryIso: "CN",
      cityPattern: "guangzhou",
      scopeType: "City Branch User (China - Guangzhou)"
    },

    // ── Shipping Line & Country-Level Clearing Agents ──
    {
      userCode: "PK/CLEARINGAGENT@DGT.LLC",
      fullName: "Pakistan National Clearing Agent",
      role: "main_branch_admin",
      countryIso: "PK",
      cityPattern: null,
      ledgerVisibility: "shipping_only",
      scopeType: "Country Clearing Agent (Pakistan Shipping Only)"
    },
    {
      userCode: "AE/CLEARINGAGENT@DGT.LLC",
      fullName: "UAE National Clearing Agent",
      role: "main_branch_admin",
      countryIso: "AE",
      cityPattern: null,
      ledgerVisibility: "shipping_only",
      scopeType: "Country Clearing Agent (UAE Shipping Only)"
    },
    {
      userCode: "AF/CLEARINGAGENT@DGT.LLC",
      fullName: "Afghanistan National Clearing Agent",
      role: "main_branch_admin",
      countryIso: "AF",
      cityPattern: null,
      ledgerVisibility: "shipping_only",
      scopeType: "Country Clearing Agent (Afghanistan Shipping Only)"
    },
    {
      userCode: "IN/CLEARINGAGENT@DGT.LLC",
      fullName: "India National Clearing Agent",
      role: "main_branch_admin",
      countryIso: "IN",
      cityPattern: null,
      ledgerVisibility: "shipping_only",
      scopeType: "Country Clearing Agent (India Shipping Only)"
    },
    {
      userCode: "CN/CLEARINGAGENT@DGT.LLC",
      fullName: "China National Clearing Agent",
      role: "main_branch_admin",
      countryIso: "CN",
      cityPattern: null,
      ledgerVisibility: "shipping_only",
      scopeType: "Country Clearing Agent (China Shipping Only)"
    },

    // ── Branch-Level Clearing Agents ──
    {
      userCode: "PK/CH/CLEARINGAGENT@DGT.DALNC",
      fullName: "Pakistan Chaman Branch Clearing Agent",
      role: "agent_user",
      countryIso: "PK",
      cityPattern: "chaman",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Pakistan - Chaman Shipping Only)"
    },
    {
      userCode: "PK/CHAMAN/CLEARINGAGENT@DGT.LLC",
      fullName: "Pakistan Chaman Clearing Agent (LLC)",
      role: "agent_user",
      countryIso: "PK",
      cityPattern: "chaman",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Pakistan - Chaman Shipping Only)"
    },
    {
      userCode: "PK/QTA/CLEARINGAGENT@DGT.DALNC",
      fullName: "Pakistan Quetta Branch Clearing Agent",
      role: "agent_user",
      countryIso: "PK",
      cityPattern: "quetta",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Pakistan - Quetta Shipping Only)"
    },
    {
      userCode: "PK/QUETTA/CLEARINGAGENT@DGT.LLC",
      fullName: "Pakistan Quetta Clearing Agent (LLC)",
      role: "agent_user",
      countryIso: "PK",
      cityPattern: "quetta",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Pakistan - Quetta Shipping Only)"
    },
    {
      userCode: "PK/KHI/CLEARINGAGENT@DGT.LLC",
      fullName: "Pakistan Karachi Port Clearing Agent",
      role: "agent_user",
      countryIso: "PK",
      cityPattern: "karachi",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Pakistan - Karachi Port Shipping Only)"
    },
    {
      userCode: "AF/KBL/CLEARINGAGENT@DGT.LLC",
      fullName: "Afghanistan Kabul Clearing Agent",
      role: "agent_user",
      countryIso: "AF",
      cityPattern: "kabul",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Afghanistan - Kabul Shipping Only)"
    },
    {
      userCode: "AF/KABUL/CLEARINGAGENT@DGT.DALNC",
      fullName: "Afghanistan Kabul Clearing Agent (DALNC)",
      role: "agent_user",
      countryIso: "AF",
      cityPattern: "kabul",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Afghanistan - Kabul Shipping Only)"
    },
    {
      userCode: "AF/KDH/CLEARINGAGENT@DGT.LLC",
      fullName: "Afghanistan Kandahar Clearing Agent",
      role: "agent_user",
      countryIso: "AF",
      cityPattern: "kandahar",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Afghanistan - Kandahar Shipping Only)"
    },
    {
      userCode: "AE/DXB/CLEARINGAGENT@DGT.LLC",
      fullName: "UAE Dubai Port Clearing Agent",
      role: "agent_user",
      countryIso: "AE",
      cityPattern: "dubai",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (UAE - Dubai Port Shipping Only)"
    },
    {
      userCode: "AE/DUBAI/CLEARINGAGENT@DGT.DALNC",
      fullName: "UAE Dubai Clearing Agent (DALNC)",
      role: "agent_user",
      countryIso: "AE",
      cityPattern: "dubai",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (UAE - Dubai Port Shipping Only)"
    },
    {
      userCode: "IN/DEL/CLEARINGAGENT@DGT.LLC",
      fullName: "India Delhi Clearing Agent",
      role: "agent_user",
      countryIso: "IN",
      cityPattern: "delhi",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (India - Delhi Shipping Only)"
    }
  ];

  const results = [];

  for (const def of userDefs) {
    const authEmail = def.userCode.toLowerCase();
    const country = def.countryIso ? countryMap.get(def.countryIso.toUpperCase()) : null;
    const countryBranch = def.countryIso ? resolveCountryBranch(def.countryIso) : null;
    const cityBranch = (def.countryIso && def.cityPattern) ? resolveCityBranch(def.countryIso, def.cityPattern) : null;

    let cId = null;
    let cbId = null;
    let cityId = null;

    if (def.role === "super_admin") {
      cId = null;
      cbId = null;
      cityId = null;
    } else if (def.role === "country_admin") {
      cId = country?.id || null;
      cbId = null;
      cityId = null;
    } else if (def.role === "main_branch_admin") {
      cId = country?.id || null;
      cbId = countryBranch?.id || null;
      cityId = null;
    } else if (def.role === "city_branch_admin" || def.role === "agent_user") {
      cId = country?.id || null;
      cbId = cityBranch?.country_branch_id || countryBranch?.id || null;
      cityId = cityBranch?.id || null;
    }

    // 1. Check or insert into auth.users
    let [authUser] = await sql`
      SELECT id, email FROM auth.users 
      WHERE email ILIKE ${authEmail}
      LIMIT 1;
    `;

    let userId = authUser?.id;

    if (!userId) {
      const [existingProfile] = await sql`
        SELECT id FROM public.profiles WHERE user_code ILIKE ${def.userCode} LIMIT 1;
      `;
      if (existingProfile) {
        userId = existingProfile.id;
      } else {
        const [genId] = await sql`SELECT gen_random_uuid() as id;`;
        userId = genId.id;
      }

      await sql`
        INSERT INTO auth.users (
          id, instance_id, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
          ${userId},
          '00000000-0000-0000-0000-000000000000',
          ${authEmail},
          crypt(${DEFAULT_PASSWORD}, gen_salt('bf')),
          NOW(),
          '{"provider":"email","providers":["email"]}',
          ${JSON.stringify({ full_name: def.fullName })},
          NOW(),
          NOW(),
          'authenticated',
          'authenticated'
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          encrypted_password = EXCLUDED.encrypted_password,
          updated_at = NOW();
      `;
    } else {
      await sql`
        UPDATE auth.users
        SET encrypted_password = crypt(${DEFAULT_PASSWORD}, gen_salt('bf')),
            updated_at = NOW()
        WHERE id = ${userId};
      `;
    }

    // 2. Upsert Profile in public.profiles
    await sql`
      INSERT INTO public.profiles (
        id, full_name, user_code, raw_password,
        preferred_language_code, created_at, updated_at
      ) VALUES (
        ${userId},
        ${def.fullName},
        ${def.userCode},
        ${DEFAULT_PASSWORD},
        'en',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        user_code = EXCLUDED.user_code,
        raw_password = EXCLUDED.raw_password,
        updated_at = NOW();
    `;

    // 3. Upsert User Role Assignment with Strict Constraints
    const visibility = def.ledgerVisibility || "scoped";
    await sql`
      DELETE FROM public.user_role_assignments WHERE user_id = ${userId};
    `;

    await sql`
      INSERT INTO public.user_role_assignments (
        user_id, role, country_id, country_branch_id, city_branch_id, ledger_visibility, is_active, created_at, updated_at
      ) VALUES (
        ${userId},
        ${def.role},
        ${cId},
        ${cbId},
        ${cityId},
        ${visibility},
        true,
        NOW(),
        NOW()
      );
    `;

    results.push({
      "Username / Login ID": def.userCode,
      "Role": def.role,
      "Country Scope": country?.name || "All Countries",
      "Branch Scope": cityBranch?.name || countryBranch?.name || "All Branches",
      "Access Permission": def.scopeType,
      "Status": "✅ Verified & Active"
    });
  }

  console.log("==========================================================================");
  console.log("📋 ALL UPCOUNTRY, BRANCH & CLEARING AGENT LOGINS SUCCESSFULLY CONFIGURED!");
  console.log("==========================================================================\n");
  console.table(results);

  await sql.end();
}

main().catch(err => {
  console.error("FATAL ERROR in setup-all-upcountry-logins:", err);
  process.exit(1);
});
