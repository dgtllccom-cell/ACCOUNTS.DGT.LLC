import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from "postgres";

const vpsEnv = {
  DATABASE_URL: resolveDbUrl("prod")
};
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

async function seedLanguages() {
  console.log("Seeding 5 languages into VPS public.languages table...");
  const langs = [
    { code: "en", english_name: "English", native_name: "English", direction: "ltr", is_default: true, is_active: true },
    { code: "ur", english_name: "Urdu", native_name: "اردو", direction: "rtl", is_default: false, is_active: true },
    { code: "ar", english_name: "Arabic", native_name: "العربية", direction: "rtl", is_default: false, is_active: true },
    { code: "fa", english_name: "Persian", native_name: "فارسی", direction: "rtl", is_default: false, is_active: true },
    { code: "ps", english_name: "Pashto", native_name: "پښتو", direction: "rtl", is_default: false, is_active: true }
  ];

  for (const l of langs) {
    await vpsSql`
      INSERT INTO public.languages (code, english_name, native_name, direction, is_default, is_active, created_at, updated_at)
      VALUES (${l.code}, ${l.english_name}, ${l.native_name}, ${l.direction}, ${l.is_default}, ${l.is_active}, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET english_name = EXCLUDED.english_name, native_name = EXCLUDED.native_name, direction = EXCLUDED.direction;
    `;
  }

  const check = await vpsSql`SELECT * FROM public.languages`;
  console.log("VPS Languages table now has:", check.map(c => `${c.code} (${c.native_name})`));
  await vpsSql.end();
  process.exit(0);
}

seedLanguages();
