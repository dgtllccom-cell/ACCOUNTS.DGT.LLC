import postgres from "postgres";
import fs from "fs";

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
if (fs.existsSync("/var/www/dgt-nextjs/.env")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env", "utf8");
}

let dbUrl = "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^["']/, "").replace(/["']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 30 });

async function runTest() {
  console.log("=== Testing Person Master & Owner/Employee Registry on VPS ===");

  // 1. Verify Pakistan country
  const [pakistan] = await sql`SELECT id, name FROM public.countries WHERE iso2 = 'PK' LIMIT 1`;
  console.log("Country:", pakistan);

  // 2. Insert or verify a Person Master for Country Owner
  const ownerName = "Muhammad Usman";
  const [existing] = await sql`
    SELECT id, customer_name, first_name, last_name, company_name, mobile, notes
    FROM public.customers
    WHERE customer_name = ${ownerName} OR (first_name = 'Muhammad' AND last_name = 'Usman')
    LIMIT 1
  `;

  let personId = existing?.id;
  if (!existing) {
    const notesData = JSON.stringify({
      customerType: "Country Owner",
      firstName: "Muhammad",
      lastName: "Usman",
      fatherName: "Haji Abdul Rehman",
      contacts: [{ type: "Mobile", value: "+92 300 1234567" }, { type: "WhatsApp", value: "+92 300 1234567" }],
      documents: [{ type: "CNIC", number: "54400-1234567-1" }],
      status: "Active"
    });

    const [inserted] = await sql`
      INSERT INTO public.customers (
        country_id, customer_name, first_name, last_name, mobile, whatsapp, notes, original_language_code, is_active, created_at, updated_at
      ) VALUES (
        ${pakistan.id},
        ${ownerName},
        'Muhammad',
        'Usman',
        '+92 300 1234567',
        '+92 300 1234567',
        ${notesData},
        'en',
        true,
        NOW(),
        NOW()
      )
      RETURNING id, customer_name, first_name, last_name, mobile, notes
    `;
    personId = inserted.id;
    console.log("Inserted New Person Master:", inserted);
  } else {
    console.log("Found Existing Person Master:", existing);
  }

  // 3. Test Search
  const searchResults = await sql`
    SELECT id, customer_name, first_name, last_name, mobile, notes
    FROM public.customers
    WHERE deleted_at IS NULL
      AND (customer_name ILIKE '%Usman%' OR first_name ILIKE '%Usman%' OR last_name ILIKE '%Usman%' OR mobile ILIKE '%1234567%')
    LIMIT 5
  `;
  console.log("\nSearch Query Results for 'Usman' / '1234567':");
  console.table(searchResults.map(r => ({ id: r.id, name: r.customer_name, first: r.first_name, last: r.last_name, mobile: r.mobile })));

  await sql.end();
}

runTest().catch(console.error);
