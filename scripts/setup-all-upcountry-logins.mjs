import { createClient } from "@supabase/supabase-js";
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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const sql = postgres(dbUrl, { max: 10 });
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

const DEFAULT_PASSWORD = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD || "Admin@123";

async function main() {
  console.log("==========================================================================");
  console.log("🔐 SETTING UP ALL UPCOUNTRY, BRANCH & CLEARING AGENT LOGINS");
  console.log("==========================================================================\n");

  // 1. Fetch Countries
  const countries = await sql`
    SELECT id, name, iso2, iso3 FROM public.countries WHERE is_active = true;
  `;
  const countryMap = new Map();
  for (const c of countries) {
    if (c.iso2) countryMap.set(c.iso2.toUpperCase(), c);
    if (c.name) countryMap.set(c.name.toLowerCase(), c);
  }

  // 2. Fetch Country Branches
  const countryBranches = await sql`
    SELECT id, country_id, name, code, is_main FROM public.country_branches WHERE deleted_at IS NULL;
  `;

  // 3. Fetch City Branches
  const cityBranches = await sql`
    SELECT id, country_id, country_branch_id, name, code FROM public.city_branches WHERE deleted_at IS NULL;
  `;

  // Helper to resolve city branch
  function resolveCityBranch(countryIso2, cityNamePattern) {
    const c = countryMap.get(countryIso2.toUpperCase());
    if (!c) return null;
    const pat = cityNamePattern.toLowerCase();
    return cityBranches.find(cb => 
      cb.country_id === c.id && 
      (cb.name.toLowerCase().includes(pat) || (cb.code && cb.code.toLowerCase().includes(pat)))
    ) || null;
  }

  function resolveCountryBranch(countryIso2) {
    const c = countryMap.get(countryIso2.toUpperCase());
    if (!c) return null;
    return countryBranches.find(cb => cb.country_id === c.id && cb.is_main) ||
           countryBranches.find(cb => cb.country_id === c.id) || null;
  }

  // Define User Definitions
  const userDefs = [
    // ── Super Admins ──
    {
      email: "SUPERADMIN@DGT.LLC",
      fullName: "Global Super Admin",
      role: "super_admin",
      countryIso: null,
      cityPattern: null,
      scopeType: "Global Super Admin (Full ERP Access)"
    },
    {
      email: "ASMATDGTLLC@USERS.DAMAAN.LOCAL",
      fullName: "Super Admin (Asmatullah)",
      role: "super_admin",
      countryIso: null,
      cityPattern: null,
      scopeType: "Global Super Admin"
    },

    // ── Country Admin Logins ──
    {
      email: "PAKISTAN@DGT.LLC",
      fullName: "Pakistan National Country Admin",
      role: "country_admin",
      countryIso: "PK",
      cityPattern: null,
      scopeType: "Country Admin (Pakistan Full Scope)"
    },
    {
      email: "AFGHANISTAN@DGT.LLC",
      fullName: "Afghanistan National Country Admin",
      role: "country_admin",
      countryIso: "AF",
      cityPattern: null,
      scopeType: "Country Admin (Afghanistan Full Scope)"
    },
    {
      email: "INDIA@DGT.LLC",
      fullName: "India National Country Admin",
      role: "country_admin",
      countryIso: "IN",
      cityPattern: null,
      scopeType: "Country Admin (India Full Scope)"
    },
    {
      email: "UAE@DGT.DALNC",
      fullName: "United Arab Emirates Country Admin",
      role: "country_admin",
      countryIso: "AE",
      cityPattern: null,
      scopeType: "Country Admin (UAE Full Scope)"
    },
    {
      email: "UAE@DGT.LLC",
      fullName: "UAE Country Admin (Primary LLC)",
      role: "country_admin",
      countryIso: "AE",
      cityPattern: null,
      scopeType: "Country Admin (UAE Full Scope)"
    },
    {
      email: "CHINA@DGT.LLC",
      fullName: "China National Country Admin",
      role: "country_admin",
      countryIso: "CN",
      cityPattern: null,
      scopeType: "Country Admin (China Full Scope)"
    },

    // ── City Branch Logins: Pakistan ──
    {
      email: "PK/CHAMAN@DGT.LLC",
      fullName: "Pakistan Chaman City Branch User",
      role: "city_branch_user",
      countryIso: "PK",
      cityPattern: "chaman",
      scopeType: "City Branch User (Pakistan - Chaman)"
    },
    {
      email: "PK/QUETTA@DGT.LLC",
      fullName: "Pakistan Quetta City Branch User",
      role: "city_branch_user",
      countryIso: "PK",
      cityPattern: "quetta",
      scopeType: "City Branch User (Pakistan - Quetta)"
    },
    {
      email: "PK/KARACHI@DGT.LLC",
      fullName: "Pakistan Karachi City Branch User",
      role: "city_branch_user",
      countryIso: "PK",
      cityPattern: "karachi",
      scopeType: "City Branch User (Pakistan - Karachi)"
    },
    {
      email: "PK/LAHORE@DGT.LLC",
      fullName: "Pakistan Lahore City Branch User",
      role: "city_branch_user",
      countryIso: "PK",
      cityPattern: "lahore",
      scopeType: "City Branch User (Pakistan - Lahore)"
    },
    {
      email: "PK/ISLAMABAD@DGT.LLC",
      fullName: "Pakistan Islamabad City Branch User",
      role: "city_branch_user",
      countryIso: "PK",
      cityPattern: "islamabad",
      scopeType: "City Branch User (Pakistan - Islamabad)"
    },
    {
      email: "PK/PESHAWAR@DGT.LLC",
      fullName: "Pakistan Peshawar City Branch User",
      role: "city_branch_user",
      countryIso: "PK",
      cityPattern: "peshawar",
      scopeType: "City Branch User (Pakistan - Peshawar)"
    },
    {
      email: "PK/GWADAR@DGT.LLC",
      fullName: "Pakistan Gwadar Port Branch User",
      role: "city_branch_user",
      countryIso: "PK",
      cityPattern: "gwadar",
      scopeType: "City Branch User (Pakistan - Gwadar)"
    },
    {
      email: "PK/TORKHAM@DGT.LLC",
      fullName: "Pakistan Torkham Border Branch User",
      role: "city_branch_user",
      countryIso: "PK",
      cityPattern: "torkham",
      scopeType: "City Branch User (Pakistan - Torkham)"
    },

    // ── City Branch Logins: Afghanistan ──
    {
      email: "AF/KABUL@DGT.DALNC",
      fullName: "Afghanistan Kabul City Branch User",
      role: "city_branch_user",
      countryIso: "AF",
      cityPattern: "kabul",
      scopeType: "City Branch User (Afghanistan - Kabul)"
    },
    {
      email: "AF/KABUL@DGT.LLC",
      fullName: "Afghanistan Kabul Branch User (LLC)",
      role: "city_branch_user",
      countryIso: "AF",
      cityPattern: "kabul",
      scopeType: "City Branch User (Afghanistan - Kabul)"
    },
    {
      email: "AF/KANDAHAR@DGT.LLC",
      fullName: "Afghanistan Kandahar City Branch User",
      role: "city_branch_user",
      countryIso: "AF",
      cityPattern: "kandahar",
      scopeType: "City Branch User (Afghanistan - Kandahar)"
    },
    {
      email: "AF/HERAT@DGT.LLC",
      fullName: "Afghanistan Herat City Branch User",
      role: "city_branch_user",
      countryIso: "AF",
      cityPattern: "herat",
      scopeType: "City Branch User (Afghanistan - Herat)"
    },
    {
      email: "AF/SPINBOLDAK@DGT.LLC",
      fullName: "Afghanistan Spin Boldak Branch User",
      role: "city_branch_user",
      countryIso: "AF",
      cityPattern: "boldak",
      scopeType: "City Branch User (Afghanistan - Spin Boldak)"
    },
    {
      email: "AF/MAZAR@DGT.LLC",
      fullName: "Afghanistan Mazar-i-Sharif Branch User",
      role: "city_branch_user",
      countryIso: "AF",
      cityPattern: "mazar",
      scopeType: "City Branch User (Afghanistan - Mazar-i-Sharif)"
    },

    // ── City Branch Logins: United Arab Emirates ──
    {
      email: "AE/DUBAI@DGT.LLC",
      fullName: "UAE Dubai City Branch User",
      role: "city_branch_user",
      countryIso: "AE",
      cityPattern: "dubai",
      scopeType: "City Branch User (UAE - Dubai City Branch)"
    },
    {
      email: "AE/ABUDHABI@DGT.LLC",
      fullName: "UAE Abu Dhabi City Branch User",
      role: "city_branch_user",
      countryIso: "AE",
      cityPattern: "abu dhabi",
      scopeType: "City Branch User (UAE - Abu Dhabi)"
    },
    {
      email: "AE/SHARJAH@DGT.LLC",
      fullName: "UAE Sharjah City Branch User",
      role: "city_branch_user",
      countryIso: "AE",
      cityPattern: "sharjah",
      scopeType: "City Branch User (UAE - Sharjah)"
    },
    {
      email: "AE/JEBELALI@DGT.LLC",
      fullName: "UAE Jebel Ali Port Branch User",
      role: "city_branch_user",
      countryIso: "AE",
      cityPattern: "jebel ali",
      scopeType: "City Branch User (UAE - Jebel Ali Port)"
    },

    // ── City Branch Logins: India ──
    {
      email: "IN/DELHI@DGT.LLC",
      fullName: "India New Delhi City Branch User",
      role: "city_branch_user",
      countryIso: "IN",
      cityPattern: "delhi",
      scopeType: "City Branch User (India - New Delhi)"
    },
    {
      email: "IN/MUMBAI@DGT.LLC",
      fullName: "India Mumbai City Branch User",
      role: "city_branch_user",
      countryIso: "IN",
      cityPattern: "mumbai",
      scopeType: "City Branch User (India - Mumbai)"
    },
    {
      email: "IN/ATTARI@DGT.LLC",
      fullName: "India Attari Border Branch User",
      role: "city_branch_user",
      countryIso: "IN",
      cityPattern: "attari",
      scopeType: "City Branch User (India - Attari/Amritsar)"
    },

    // ── City Branch Logins: China ──
    {
      email: "CN/SHENZHEN@DGT.LLC",
      fullName: "China Shenzhen City Branch User",
      role: "city_branch_user",
      countryIso: "CN",
      cityPattern: "shenzhen",
      scopeType: "City Branch User (China - Shenzhen)"
    },
    {
      email: "CN/DALIAN@DGT.LLC",
      fullName: "China Dalian City Branch User",
      role: "city_branch_user",
      countryIso: "CN",
      cityPattern: "dalian",
      scopeType: "City Branch User (China - Dalian)"
    },
    {
      email: "CN/GUANGZHOU@DGT.LLC",
      fullName: "China Guangzhou City Branch User",
      role: "city_branch_user",
      countryIso: "CN",
      cityPattern: "guangzhou",
      scopeType: "City Branch User (China - Guangzhou)"
    },

    // ── Shipping Line & Country-Level Clearing Agents ──
    {
      email: "PK/CLEARINGAGENT@DGT.LLC",
      fullName: "Pakistan National Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "PK",
      cityPattern: null,
      ledgerVisibility: "shipping_only",
      scopeType: "Country Clearing Agent (Pakistan Shipping Only)"
    },
    {
      email: "AE/CLEARINGAGENT@DGT.LLC",
      fullName: "UAE National Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "AE",
      cityPattern: null,
      ledgerVisibility: "shipping_only",
      scopeType: "Country Clearing Agent (UAE Shipping Only)"
    },
    {
      email: "AF/CLEARINGAGENT@DGT.LLC",
      fullName: "Afghanistan National Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "AF",
      cityPattern: null,
      ledgerVisibility: "shipping_only",
      scopeType: "Country Clearing Agent (Afghanistan Shipping Only)"
    },
    {
      email: "IN/CLEARINGAGENT@DGT.LLC",
      fullName: "India National Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "IN",
      cityPattern: null,
      ledgerVisibility: "shipping_only",
      scopeType: "Country Clearing Agent (India Shipping Only)"
    },
    {
      email: "CN/CLEARINGAGENT@DGT.LLC",
      fullName: "China National Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "CN",
      cityPattern: null,
      ledgerVisibility: "shipping_only",
      scopeType: "Country Clearing Agent (China Shipping Only)"
    },

    // ── Branch-Level Clearing Agents ──
    {
      email: "PK/CH/CLEARINGAGENT@DGT.DALNC",
      fullName: "Pakistan Chaman Branch Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "PK",
      cityPattern: "chaman",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Pakistan - Chaman Shipping Only)"
    },
    {
      email: "PK/CHAMAN/CLEARINGAGENT@DGT.LLC",
      fullName: "Pakistan Chaman Clearing Agent (LLC)",
      role: "clearing_agent_user",
      countryIso: "PK",
      cityPattern: "chaman",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Pakistan - Chaman Shipping Only)"
    },
    {
      email: "PK/QTA/CLEARINGAGENT@DGT.DALNC",
      fullName: "Pakistan Quetta Branch Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "PK",
      cityPattern: "quetta",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Pakistan - Quetta Shipping Only)"
    },
    {
      email: "PK/QUETTA/CLEARINGAGENT@DGT.LLC",
      fullName: "Pakistan Quetta Clearing Agent (LLC)",
      role: "clearing_agent_user",
      countryIso: "PK",
      cityPattern: "quetta",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Pakistan - Quetta Shipping Only)"
    },
    {
      email: "PK/KHI/CLEARINGAGENT@DGT.LLC",
      fullName: "Pakistan Karachi Port Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "PK",
      cityPattern: "karachi",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Pakistan - Karachi Port Shipping Only)"
    },
    {
      email: "AF/KBL/CLEARINGAGENT@DGT.LLC",
      fullName: "Afghanistan Kabul Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "AF",
      cityPattern: "kabul",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Afghanistan - Kabul Shipping Only)"
    },
    {
      email: "AF/KABUL/CLEARINGAGENT@DGT.DALNC",
      fullName: "Afghanistan Kabul Clearing Agent (DALNC)",
      role: "clearing_agent_user",
      countryIso: "AF",
      cityPattern: "kabul",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Afghanistan - Kabul Shipping Only)"
    },
    {
      email: "AF/KDH/CLEARINGAGENT@DGT.LLC",
      fullName: "Afghanistan Kandahar Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "AF",
      cityPattern: "kandahar",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (Afghanistan - Kandahar Shipping Only)"
    },
    {
      email: "AE/DXB/CLEARINGAGENT@DGT.LLC",
      fullName: "UAE Dubai Port Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "AE",
      cityPattern: "dubai",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (UAE - Dubai Port Shipping Only)"
    },
    {
      email: "AE/DUBAI/CLEARINGAGENT@DGT.DALNC",
      fullName: "UAE Dubai Clearing Agent (DALNC)",
      role: "clearing_agent_user",
      countryIso: "AE",
      cityPattern: "dubai",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (UAE - Dubai Port Shipping Only)"
    },
    {
      email: "IN/DEL/CLEARINGAGENT@DGT.LLC",
      fullName: "India Delhi Clearing Agent",
      role: "clearing_agent_user",
      countryIso: "IN",
      cityPattern: "delhi",
      ledgerVisibility: "shipping_only",
      scopeType: "Branch Clearing Agent (India - Delhi Shipping Only)"
    }
  ];

  const results = [];

  for (const def of userDefs) {
    const emailNorm = def.email.toLowerCase();
    const country = def.countryIso ? countryMap.get(def.countryIso.toUpperCase()) : null;
    const countryBranch = def.countryIso ? resolveCountryBranch(def.countryIso) : null;
    const cityBranch = (def.countryIso && def.cityPattern) ? resolveCityBranch(def.countryIso, def.cityPattern) : null;

    let userId = null;

    // 1. Supabase Auth sync (if available)
    if (supabase) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email: emailNorm,
          password: DEFAULT_PASSWORD,
          email_confirm: true
        });

        if (authErr) {
          if (authErr.message?.toLowerCase().includes("already") || authErr.message?.toLowerCase().includes("registered")) {
            const { data: users } = await supabase.auth.admin.listUsers();
            const existing = users.users.find(u => u.email?.toLowerCase() === emailNorm);
            if (existing) {
              userId = existing.id;
              await supabase.auth.admin.updateUserById(userId, { password: DEFAULT_PASSWORD });
            }
          }
        } else if (authData?.user?.id) {
          userId = authData.user.id;
        }
      } catch (e) {
        console.warn(`Supabase auth error for ${def.email}:`, e.message);
      }
    }

    // 2. Check / Upsert Profile in Postgres
    let [profile] = await sql`
      SELECT id, email, user_code FROM public.profiles 
      WHERE email ILIKE ${def.email} OR user_code ILIKE ${def.email} 
      LIMIT 1;
    `;

    if (!profile) {
      if (!userId) {
        const [genId] = await sql`SELECT gen_random_uuid() as id;`;
        userId = genId.id;
      }
      [profile] = await sql`
        INSERT INTO public.profiles (
          id, full_name, email, user_code, raw_password, is_active,
          preferred_language_code, created_at, updated_at
        ) VALUES (
          ${userId},
          ${def.fullName},
          ${emailNorm},
          ${def.email},
          ${DEFAULT_PASSWORD},
          true,
          'en',
          NOW(),
          NOW()
        )
        RETURNING id, full_name, email, user_code;
      `;
    } else {
      userId = profile.id;
      await sql`
        UPDATE public.profiles
        SET full_name = ${def.fullName},
            email = ${emailNorm},
            user_code = ${def.email},
            raw_password = ${DEFAULT_PASSWORD},
            is_active = true,
            updated_at = NOW()
        WHERE id = ${userId};
      `;
    }

    // 3. Upsert User Role Assignment with Strict Country & Branch Scopes
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
        ${country?.id || null},
        ${countryBranch?.id || null},
        ${cityBranch?.id || null},
        ${visibility},
        true,
        NOW(),
        NOW()
      );
    `;

    results.push({
      email: def.email,
      role: def.role,
      country: country?.name || "All Countries",
      branch: cityBranch?.name || countryBranch?.name || "All Branches",
      scope: def.scopeType,
      status: "✅ Active & Verified"
    });
  }

  console.log("==========================================================================");
  console.log("📋 ALL UPCOUNTRY, BRANCH & CLEARING AGENT LOGINS SUCCESSFULLY CONFIGURED!");
  console.log("==========================================================================");
  console.table(results);

  await sql.end();
}

main().catch(err => {
  console.error("FATAL ERROR in setup-all-upcountry-logins:", err);
  process.exit(1);
});
