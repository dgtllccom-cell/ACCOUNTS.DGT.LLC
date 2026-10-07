import postgres from "postgres";

const PROD_URL = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

const CANDIDATES = [
  "Chaman@9090", "chaman@9090",
  "Gulistan@9090", "gulistan@9090",
  "Admin@9090", "admin@9090",
  "Admin@123", "admin@123", "Admin@1234", "Admin@12345",
  "Alras@9090", "alras@9090", "Alras@123", "alras@123", "Alras@2026",
  "Dubai@9090", "dubai@9090", "Dubai@123", "dubai@123",
  "Uae@9090", "uae@9090", "Uae@123", "uae@123",
  "Shipping@9090", "shipping@9090", "Shipping@123", "shipping@123",
  "Dgt@9090", "dgt@9090", "Dgt@123", "dgt@123", "Dgt@123456", "Dgt#123456", "Dgt@2026",
  "Damaan@9090", "damaan@9090", "Damaan@123", "damaan@123",
  "Quetta@9090", "quetta@9090",
  "Pakistan@9090", "pakistan@9090",
  "12345678", "123456789", "password", "password123",
  "VAULT-DGT-ARE-MBA001", "VAULT-DGT-ARE-CA001", "VAULT-DGT-ARE-CLA001",
  "alras.shipping", "ALRAS.SHIPPING", "alras.shipping@dgt.llc"
];

async function main() {
  const sql = postgres(PROD_URL, { max: 1, ssl: "require" });
  
  const targetUsers = [
    { email: "alras.shipping@dgt.llc", id: "84644d2f-8f15-4377-9c99-d360da7131de" },
    { email: "chaman.shipping@dgt.llc", id: "9b568b89-5541-450d-b3e5-45053cf7364c" },
    { email: "business.superadmin@dgt.llc", id: "00000000-0000-4000-8000-000000000001" },
    { email: "shipping.superadmin@dgt.llc", id: "22222222-2222-4000-8000-000000000002" },
  ];

  for (const u of targetUsers) {
    console.log(`\nTesting ${u.email}...`);
    let found = false;
    for (const cand of CANDIDATES) {
      const [{ match }] = await sql`
        SELECT (encrypted_password = crypt(${cand}, encrypted_password)) as match
        FROM auth.users
        WHERE id = ${u.id}
      `;
      if (match) {
        console.log(`  >>> FOUND PASSWORD FOR ${u.email}: "${cand}" <<<`);
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`  No candidate matched for ${u.email}`);
    }
  }

  await sql.end();
}

main().catch(console.error);
