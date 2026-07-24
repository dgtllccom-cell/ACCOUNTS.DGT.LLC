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

const dbUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!dbUrl || !supabaseUrl || !supabaseKey) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const sql = postgres(dbUrl);

async function createOrUpdateUser(email, password, fullName, roleData) {
  let userId;
  
  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  
  if (authError) {
      if (authError.message?.toLowerCase().includes("already") || authError.message?.toLowerCase().includes("registered")) {
        // Find existing user id to update password
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users.users.find(u => u.email === email);
        if (existingUser) {
          userId = existingUser.id;
          await supabase.auth.admin.updateUserById(userId, { password });
        } else {
          console.error(`Error finding user ${email}`);
          return null;
        }
      } else {
        console.error(`Error creating auth user ${email}:`, authError.message);
        return null;
      }
  } else {
    userId = authData.user.id;
  }
  
  // Wait a moment for trigger to create profile if it exists (some databases use triggers)
  await new Promise(r => setTimeout(r, 1000));
  
  // Upsert Profile to guarantee it exists before role assignment
  await sql`
    INSERT INTO profiles (id, full_name, raw_password)
    VALUES (${userId}, ${fullName}, ${password})
    ON CONFLICT (id) DO UPDATE 
    SET full_name = EXCLUDED.full_name, raw_password = EXCLUDED.raw_password
  `;
  
  // Check if role assignment exists
  const existingRole = await sql`
    SELECT id FROM user_role_assignments
    WHERE user_id = ${userId} AND role = ${roleData.role}
  `;
  
  if (existingRole.length === 0) {
    await sql`
      INSERT INTO user_role_assignments (user_id, role, country_id, country_branch_id, city_branch_id)
      VALUES (
        ${userId}, 
        ${roleData.role}, 
        ${roleData.countryId || null}, 
        ${roleData.countryBranchId || null},
        ${roleData.cityBranchId || null}
      )
    `;
  }
  
  return userId;
}

async function main() {
  try {
    console.log("Fetching countries...");
    const countries = await sql`SELECT id, name FROM countries`;
    console.log(`Found ${countries.length} countries.`);
    
    const credentials = [];
    
    // Country Admins
    for (const country of countries) {
      // Format: countryname.admin@dgt.llc
      let countryPrefix = country.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (countryPrefix === "unitedarabemirates") countryPrefix = "uae";
      
      const email = `${countryPrefix}.admin@dgt.llc`;
      const password = "Admin@123";
      const fullName = `Admin ${country.name}`;
      
      console.log(`Setting up Country Admin for ${country.name}...`);
      await createOrUpdateUser(email, password, fullName, {
        role: "country_admin",
        countryId: country.id
      });
      credentials.push({ Type: "Country Admin", Location: country.name, UserID: email, Password: password });
    }
    
    // City Admins for ALL countries (including UAE, Pakistan, etc.)
    const allCities = await sql`SELECT id, city_name, country_id, country_branch_id FROM city_branches`;
    console.log(`Found ${allCities.length} City Branches in total.`);
    
    for (const city of allCities) {
      const cityPrefix = city.city_name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const email = `${cityPrefix}@dgt.llc`;
      const password = "Admin@123";
      const fullName = `Admin ${city.city_name}`;
      
      console.log(`Setting up City Admin for ${city.city_name}...`);
      await createOrUpdateUser(email, password, fullName, {
        role: "city_branch_admin",
        countryId: city.country_id,
        countryBranchId: city.country_branch_id,
        cityBranchId: city.id
      });
      credentials.push({ Type: "City Admin", Location: city.city_name, UserID: email, Password: password });
    }
    
    // Fix existing names
    console.log("Fixing existing Admin names...");
    await sql`
      UPDATE profiles p
      SET full_name = 'Admin ' || c.name
      FROM user_role_assignments ura
      JOIN countries c ON c.id = ura.country_id
      WHERE ura.user_id = p.id AND ura.role = 'country_admin' 
        AND (p.full_name NOT LIKE 'Admin %' OR p.full_name IS NULL)
    `;
    
    await sql`
      UPDATE profiles p
      SET full_name = 'Admin ' || cb.city_name
      FROM user_role_assignments ura
      JOIN city_branches cb ON cb.id = ura.city_branch_id
      WHERE ura.user_id = p.id AND ura.role = 'city_branch_admin'
        AND (p.full_name NOT LIKE 'Admin %' OR p.full_name IS NULL)
    `;
    
    console.log("\n=============================================");
    console.log("SETUP COMPLETE! HERE ARE THE CREDENTIALS:");
    console.log("=============================================\n");
    console.table(credentials);
    
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await sql.end();
  }
}

main();
