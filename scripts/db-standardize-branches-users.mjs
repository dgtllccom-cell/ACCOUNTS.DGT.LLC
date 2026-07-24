import fs from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });
const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  try {
    console.log("=== Starting standard structure database migration ===");

    // 1. Resolve Afghanistan, India, UAE, and Pakistan country records
    const [afg] = await sql`SELECT id FROM countries WHERE name ILIKE '%Afghanistan%' AND deleted_at IS NULL`;
    const [ind] = await sql`SELECT id FROM countries WHERE name ILIKE '%India%' AND deleted_at IS NULL`;
    const [pak] = await sql`SELECT id FROM countries WHERE name ILIKE '%Pakistan%' AND deleted_at IS NULL`;
    const [uae] = await sql`SELECT id FROM countries WHERE name ILIKE '%Emirates%' AND deleted_at IS NULL`;

    if (!afg || !ind || !pak || !uae) {
      throw new Error(`One of the target countries was not found in database: AFG:${!!afg}, IND:${!!ind}, PAK:${!!pak}, UAE:${!!uae}`);
    }

    console.log(`Resolved Countries: AFG:${afg.id}, IND:${ind.id}, PAK:${pak.id}, UAE:${uae.id}`);

    // Resolve Main Branches
    const [afgMain] = await sql`SELECT id, company_id, owner_name, permission_grants, district_id FROM country_branches WHERE country_id = ${afg.id} AND deleted_at IS NULL LIMIT 1`;
    const [indMain] = await sql`SELECT id, company_id, owner_name, permission_grants, district_id FROM country_branches WHERE country_id = ${ind.id} AND deleted_at IS NULL LIMIT 1`;
    const [pakMain] = await sql`SELECT id, company_id, owner_name, permission_grants, district_id FROM country_branches WHERE country_id = ${pak.id} AND deleted_at IS NULL LIMIT 1`;
    const [uaeMain] = await sql`SELECT id, company_id, owner_name, permission_grants, district_id FROM country_branches WHERE country_id = ${uae.id} AND deleted_at IS NULL LIMIT 1`;

    if (!afgMain || !indMain || !pakMain || !uaeMain) {
      throw new Error(`One of the main country branches was not found: AFG:${!!afgMain}, IND:${!!indMain}, PAK:${!!pakMain}, UAE:${!!uaeMain}`);
    }

    // 2. Insert city branches if not exists
    // Kabul, Afghanistan (AFG-AFKD-002)
    const [kabulBranchExists] = await sql`SELECT id FROM city_branches WHERE code = 'AFG-AFKD-002' AND deleted_at IS NULL`;
    let kabulBranchId = "";
    if (kabulBranchExists) {
      kabulBranchId = kabulBranchExists.id;
      console.log(`Kabul branch already exists in database: ${kabulBranchId}`);
    } else {
      console.log("Inserting Kabul city branch row...");
      const [newKabul] = await sql`
        INSERT INTO city_branches (
          country_id, country_branch_id, city_name, name, code, local_currency, status, 
          state_province_id, city_id, company_id, owner_name, permission_template, permission_grants, district_id, email, phone
        ) VALUES (
          ${afg.id}, ${afgMain.id}, 'Kabul', 'KB/01', 'AFG-AFKD-002', 'AFN', 'active',
          '3215c0ed-b728-437f-9bff-214809f90317', 'cd209214-5638-44ee-b7e2-19b262edbfc9',
          ${afgMain.company_id}, ${afgMain.owner_name || 'Asmatullah'}, 'city-standard', ${sql.json(afgMain.permission_grants)}, ${afgMain.district_id}, 'kabul@dgt.llc', '0000000000'
        ) RETURNING id
      `;
      kabulBranchId = newKabul.id;
      console.log(`Kabul city branch inserted successfully: ${kabulBranchId}`);
    }

    // Mumbai, India (IND-INDL-002)
    const [mumbaiBranchExists] = await sql`SELECT id FROM city_branches WHERE code = 'IND-INDL-002' AND deleted_at IS NULL`;
    let mumbaiBranchId = "";
    if (mumbaiBranchExists) {
      mumbaiBranchId = mumbaiBranchExists.id;
      console.log(`Mumbai branch already exists in database: ${mumbaiBranchId}`);
    } else {
      console.log("Inserting Mumbai city branch row...");
      const [newMumbai] = await sql`
        INSERT INTO city_branches (
          country_id, country_branch_id, city_name, name, code, local_currency, status, 
          state_province_id, city_id, company_id, owner_name, permission_template, permission_grants, district_id, email, phone
        ) VALUES (
          ${ind.id}, ${indMain.id}, 'Mumbai', 'MB/01', 'IND-INDL-002', 'INR', 'active',
          '946b5d13-19fb-495e-92ee-686ec6ff5ef3', '6b661dd8-6e3c-4d06-afa0-424453c94fc1',
          ${indMain.company_id}, ${indMain.owner_name || 'Asmatullah'}, 'city-standard', ${sql.json(indMain.permission_grants)}, ${indMain.district_id}, 'mumbai@dgt.llc', '0000000000'
        ) RETURNING id
      `;
      mumbaiBranchId = newMumbai.id;
      console.log(`Mumbai city branch inserted successfully: ${mumbaiBranchId}`);
    }

    // 3. UAE/Fujairah City soft delete (ARE-AEFU-003)
    console.log("Soft-deleting Fujairah City branch...");
    await sql`UPDATE city_branches SET deleted_at = NOW() WHERE code = 'ARE-AEFU-003'`;
    console.log("Fujairah City branch soft-deleted.");

    // Resolve existing branch IDs for other standard city branches
    const [chamanBr] = await sql`SELECT id FROM city_branches WHERE code = 'PAK-PKBA-001' AND deleted_at IS NULL`;
    const [quettaBr] = await sql`SELECT id FROM city_branches WHERE code = 'PAK-PKBA-002' AND deleted_at IS NULL`;
    const [allahrahmBr] = await sql`SELECT id FROM city_branches WHERE code = 'PAK-PKBA-010' AND deleted_at IS NULL`;
    const [kandaharBr] = await sql`SELECT id FROM city_branches WHERE code = 'AFG-AFKD-001' AND deleted_at IS NULL`;
    const [newdelhiBr] = await sql`SELECT id FROM city_branches WHERE code = 'IND-INDL-001' AND deleted_at IS NULL`;
    const [dubaiBr] = await sql`SELECT id FROM city_branches WHERE code = 'ARE-AEDU-001' AND deleted_at IS NULL`;
    const [sharjahBr] = await sql`SELECT id FROM city_branches WHERE code = 'ARE-AESH-002' AND deleted_at IS NULL`;

    if (!chamanBr || !quettaBr || !allahrahmBr || !kandaharBr || !newdelhiBr || !dubaiBr || !sharjahBr) {
      throw new Error(`Missing branch code mapping: Chaman:${!!chamanBr}, Quetta:${!!quettaBr}, AllahRahm:${!!allahrahmBr}, Kandahar:${!!kandaharBr}, NewDelhi:${!!newdelhiBr}, Dubai:${!!dubaiBr}, Sharjah:${!!sharjahBr}`);
    }

    // Fetch all Auth Users from Supabase
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    const setupUser = async (email, password, fullName, userCode, role, scope) => {
      let authUser = users.find((u) => u.email === email);
      let userId = "";

      if (authUser) {
        userId = authUser.id;
        console.log(`User ${email} already exists in auth: ${userId}`);
      } else {
        console.log(`Creating auth user: ${email}...`);
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName }
        });
        if (createError) throw createError;
        userId = newUser.user.id;
        console.log(`Auth user created: ${email} (${userId})`);
      }

      // Upsert profile
      console.log(`Upserting profile for user ${email}...`);
      await sql`
        INSERT INTO profiles (id, full_name, user_code, raw_password, preferred_language_code, updated_at)
        VALUES (${userId}, ${fullName}, ${userCode}, ${password}, 'en', NOW())
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          user_code = EXCLUDED.user_code,
          raw_password = EXCLUDED.raw_password,
          updated_at = NOW()
      `;

      // Clear any existing assignments
      console.log(`Clearing existing assignments for ${email}...`);
      await sql`DELETE FROM user_role_assignments WHERE user_id = ${userId}`;

      // Insert new assignment
      console.log(`Inserting clean standardized assignment for ${email}...`);
      await sql`
        INSERT INTO user_role_assignments (user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at)
        VALUES (${userId}, ${role}, ${scope.country_id ?? null}, ${scope.country_branch_id ?? null}, ${scope.city_branch_id ?? null}, true, NOW())
      `;

      console.log(`Successfully standardized user ${email}`);
      return userId;
    };

    // 4. Provision Kabul Branch User
    await setupUser(
      "kabul@dgt.llc",
      "DgtKabul123",
      "Admin Kabul",
      "KABULDGTLLC",
      "city_branch_admin",
      { country_id: afg.id, country_branch_id: afgMain.id, city_branch_id: kabulBranchId }
    );

    // Provision Mumbai Branch User
    await setupUser(
      "mumbai@dgt.llc",
      "DgtMumbai123",
      "Admin Mumbai",
      "MUMBAIDGTLLC",
      "city_branch_admin",
      { country_id: ind.id, country_branch_id: indMain.id, city_branch_id: mumbaiBranchId }
    );

    // Provision Allah Rahm Branch User
    await setupUser(
      "allahrahm@dgt.llc",
      "DgtAllahRahm123",
      "Admin Allah Rahm",
      "ALLAHRAHMDGTLLC",
      "city_branch_admin",
      { country_id: pak.id, country_branch_id: pakMain.id, city_branch_id: allahrahmBr.id }
    );

    // 5. Standardize other main target users (Country Admins & Branch Admins)
    const standards = [
      // Country Admins
      { email: "pakistan.admin@dgt.llc", password: "DgtPakistanAdmin123", name: "Admin Pakistan", code: "PAKISTANADMIN", role: "country_admin", scope: { country_id: pak.id } },
      { email: "uae.admin@dgt.llc", password: "DgtUaeAdmin123", name: "Admin United Arab Emirates", code: "UAEADMIN", role: "country_admin", scope: { country_id: uae.id } },
      { email: "afghanistan.admin@dgt.llc", password: "DgtAfghanistanAdmin123", name: "Admin Afghanistan", code: "AFGHANISTANADMIN", role: "country_admin", scope: { country_id: afg.id } },
      { email: "india.admin@dgt.llc", password: "DgtIndiaAdmin123", name: "Admin India", code: "INDIAADMIN", role: "country_admin", scope: { country_id: ind.id } },

      // Branch Admins
      { email: "chaman@dgt.llc", password: "DgtChaman123", name: "Admin Chaman", code: "CHAMANDGTLLC", role: "city_branch_admin", scope: { country_id: pak.id, country_branch_id: pakMain.id, city_branch_id: chamanBr.id } },
      { email: "quetta@dgt.llc", password: "DgtQuetta123", name: "Admin Quetta", code: "QUETTADGTLLC", role: "city_branch_admin", scope: { country_id: pak.id, country_branch_id: pakMain.id, city_branch_id: quettaBr.id } },
      { email: "kandahar@dgt.llc", password: "DgtKandahar123", name: "Admin Kandahar", code: "KANDAHARDGTLLC", role: "city_branch_admin", scope: { country_id: afg.id, country_branch_id: afgMain.id, city_branch_id: kandaharBr.id } },
      { email: "newdelhi@dgt.llc", password: "DgtNewDelhi123", name: "Admin New Delhi", code: "NEWDELHIDGTLLC", role: "city_branch_admin", scope: { country_id: ind.id, country_branch_id: indMain.id, city_branch_id: newdelhiBr.id } },
      { email: "fareeddgtllc@users.damaan.local", password: "DgtFareedDubai123", name: "Admin Dubai", code: "FAREEDDGTLLC", role: "city_branch_admin", scope: { country_id: uae.id, country_branch_id: uaeMain.id, city_branch_id: dubaiBr.id } },
      { email: "sharjahcity@dgt.llc", password: "DgtSharjah123", name: "Admin Sharjah City", code: "SHARJAHDGTLLC", role: "city_branch_admin", scope: { country_id: uae.id, country_branch_id: uaeMain.id, city_branch_id: sharjahBr.id } }
    ];

    for (const spec of standards) {
      console.log(`Standardizing user: ${spec.email}...`);
      await setupUser(spec.email, spec.password, spec.name, spec.code, spec.role, spec.scope);
    }

    // 6. Clean up assignments for ALL other users in these 4 countries (Pakistan, UAE, Afghanistan, India)
    const targetCountryIds = [pak.id, uae.id, afg.id, ind.id];
    const allowedEmails = [
      "superadmin@damaan.com",
      "pakistan.admin@dgt.llc", "uae.admin@dgt.llc", "afghanistan.admin@dgt.llc", "india.admin@dgt.llc",
      "chaman@dgt.llc", "quetta@dgt.llc", "kandahar@dgt.llc", "newdelhi@dgt.llc",
      "fareeddgtllc@users.damaan.local", "sharjahcity@dgt.llc",
      "kabul@dgt.llc", "mumbai@dgt.llc", "allahrahm@dgt.llc"
    ];

    const allowedUserIds = users
      .filter((u) => allowedEmails.includes(u.email))
      .map((u) => u.id);

    console.log("Deactivating/deleting other active role assignments in standardized countries...");
    // Find all assignments linked to target countries
    const assignmentsToDelete = await sql`
      SELECT id FROM user_role_assignments
      WHERE country_id IN ${sql(targetCountryIds)}
         OR city_branch_id IN (SELECT id FROM city_branches WHERE country_id IN ${sql(targetCountryIds)})
    `;

    let deleteCount = 0;
    for (const ass of assignmentsToDelete) {
      // If assignment belongs to a user who is not standard, delete it to ensure standard isolation
      const [row] = await sql`SELECT user_id FROM user_role_assignments WHERE id = ${ass.id}`;
      if (row && !allowedUserIds.includes(row.user_id)) {
        await sql`DELETE FROM user_role_assignments WHERE id = ${ass.id}`;
        deleteCount++;
      }
    }
    console.log(`Cleaned up ${deleteCount} legacy assignments.`);

    console.log("=== Database migration completed successfully ===");
  } catch (err) {
    console.error("CRITICAL ERROR DURING MIGRATION:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
