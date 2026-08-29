import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';

const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function syncAndMigrate() {
  try {
    console.log("=== STEP 4: SEEDING MULTILINGUAL TRANSLATIONS (PASHTO, URDU, ARABIC, PERSIAN, ENGLISH) ===");
    
    // Define multilingual names mapping
    const translationEntries = [
      {
        id: '00f508a8-d79d-4300-95b1-0a6dc405a6e1',
        en: 'ASMATULLAH ABDULLAH',
        ps: 'عصمت الله عبد الله',
        ur: 'عصمت اللہ عبداللہ',
        ar: 'عصمت الله عبد الله',
        fa: 'عصمت‌الله عبدالله'
      },
      {
        id: '71d7eb2f-98f0-408e-be60-b48b7edefff1',
        en: 'Fareedullah Abdullah',
        ps: 'فريد الله عبد الله',
        ur: 'فرید اللہ عبداللہ',
        ar: 'فريد الله عبد الله',
        fa: 'فریدالله عبدالله'
      },
      {
        id: '47144350-078f-40d9-a723-2cbf0a13db31',
        en: 'Najeebullah Abdullah',
        ps: 'نجيب الله عبد الله',
        ur: 'نجیب اللہ عبداللہ',
        ar: 'نجيب الله عبد الله',
        fa: 'نجیب‌الله عبدالله'
      },
      {
        id: 'c6ee6850-363f-4641-92e0-9d58cf9a1ef6',
        en: 'Muhammad Saleem',
        ps: 'محمد سليم',
        ur: 'محمد سلیم',
        ar: 'محمد سليم',
        fa: 'محمد سلیم'
      },
      {
        id: '98daf249-bb4c-4869-a989-476178929ae4',
        en: 'Sana Shahbaz',
        ps: 'ثناء شهباز',
        ur: 'ثناء شہباز',
        ar: 'ثناء شهباز',
        fa: 'ثناء شهباز'
      },
      {
        id: '7219bee7-e983-4e11-bb2f-e9c1fffa807a',
        en: 'NASEEB ULLAH',
        ps: 'نصيب الله',
        ur: 'نصیب اللہ',
        ar: 'نصيب الله',
        fa: 'نصیب‌الله'
      },
      {
        id: '83f034b4-17b0-4513-a424-4ad81d30e270',
        en: 'Naqeeb Ullah Khan',
        ps: 'نقیب الله خان',
        ur: 'نقیب اللہ خان',
        ar: 'نقيب الله خان',
        fa: 'نقیب‌الله خان'
      },
      {
        id: '5128cf92-e729-4a84-8bff-8d396baa5bfc',
        en: 'Muhammad Anees',
        ps: 'محمد انيس',
        ur: 'محمد انیس',
        ar: 'محمد أنيس',
        fa: 'محمد انیس'
      },
      {
        id: '1900bbe1-d245-47dd-a9ee-dfffd46ab245',
        en: 'Muhammad Usman',
        ps: 'محمد عثمان',
        ur: 'محمد عثمان',
        ar: 'محمد عثمان',
        fa: 'محمد عثمان'
      }
    ];

    for (const t of translationEntries) {
      // Pashto
      await sql`
        INSERT INTO public.translations_pashto (record_table, record_id, field_name, text)
        VALUES ('customers', ${t.id}::uuid, 'customer_name', ${t.ps})
        ON CONFLICT DO NOTHING;
      `;
      // Urdu
      await sql`
        INSERT INTO public.translations_urdu (record_table, record_id, field_name, text)
        VALUES ('customers', ${t.id}::uuid, 'customer_name', ${t.ur})
        ON CONFLICT DO NOTHING;
      `;
      // Arabic
      await sql`
        INSERT INTO public.translations_arabic (record_table, record_id, field_name, text)
        VALUES ('customers', ${t.id}::uuid, 'customer_name', ${t.ar})
        ON CONFLICT DO NOTHING;
      `;
      // Persian
      await sql`
        INSERT INTO public.translations_persian (record_table, record_id, field_name, text)
        VALUES ('customers', ${t.id}::uuid, 'customer_name', ${t.fa})
        ON CONFLICT DO NOTHING;
      `;
      // English
      await sql`
        INSERT INTO public.translations_english (record_table, record_id, field_name, text, original_text, original_language_code, source, translation_status)
        VALUES ('customers', ${t.id}::uuid, 'customer_name', ${t.en}, ${t.en}, 'en', 'manual'::translation_source, 'approved')
        ON CONFLICT DO NOTHING;
      `;
    }
    console.log("✅ Seeded Pashto, Urdu, Arabic, Persian, and English translations!");

    console.log("\n=== STEP 5: VERIFYING CUSTOMERS TABLE QUERY ===");
    const CUSTOMER_COLUMNS = [
      "id", "country_id", "state_province_id", "district_id", "city_id", "area_location_id",
      "customer_name", "first_name", "last_name", "father_name", "gender", "photo_url", "person_code",
      "company_name", "contact_person", "mobile", "whatsapp", "email", "address",
      "notes", "original_language_code", "is_active", "created_at", "updated_at"
    ];

    const result = await sql`
      SELECT ${sql(CUSTOMER_COLUMNS)} FROM public.customers
      WHERE deleted_at IS NULL
      ORDER BY customer_name ASC;
    `;
    console.log(`🎉 SUCCESS! Loaded ${result.length} active customer / person records:`);
    console.table(result.map(r => ({
      code: r.person_code,
      name: r.customer_name,
      father_name: r.father_name,
      mobile: r.mobile,
      active: r.is_active
    })));

  } catch (err) {
    console.error("Sync error:", err);
  } finally {
    await sql.end();
  }
}

syncAndMigrate();
