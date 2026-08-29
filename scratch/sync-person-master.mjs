import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';
import fs from 'fs';

const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function syncAndMigrate() {
  try {
    console.log("=== STEP 1: APPLYING PERSON MASTER SCHEMA MIGRATION ===");
    
    await sql`
      ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS person_code text;
    `;
    console.log("Added person_code to customers");

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS customers_person_code_uidx
        ON public.customers (person_code)
        WHERE person_code IS NOT NULL AND deleted_at IS NULL;
    `;
    console.log("Created index customers_person_code_uidx");

    await sql`
      ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS father_name text;
    `;
    console.log("Added father_name to customers");

    await sql`
      ALTER TABLE public.companies
        ADD COLUMN IF NOT EXISTS owner_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS companies_owner_person_idx
        ON public.companies (owner_person_id)
        WHERE deleted_at IS NULL;
    `;

    await sql`
      ALTER TABLE public.companies
        ADD COLUMN IF NOT EXISTS manager_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS companies_manager_person_idx
        ON public.companies (manager_person_id)
        WHERE deleted_at IS NULL;
    `;
    console.log("Added owner/manager person fields to companies");

    // Record migration in erp_schema_migrations
    await sql`
      INSERT INTO erp_schema_migrations (name, status, applied_at)
      VALUES ('20260825_person_master_phase1', 'applied', NOW())
      ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();
    `;
    console.log("Migration recorded in erp_schema_migrations");

    console.log("\n=== STEP 2: RESTORING & CLEANING PERSON MASTER / CUSTOMERS DATA ===");

    // 1. Un-delete any soft-deleted customers linked to employees
    await sql`
      UPDATE public.customers
      SET deleted_at = NULL, is_active = TRUE
      WHERE id IN (
        SELECT DISTINCT person_master_id FROM public.employees WHERE deleted_at IS NULL
      ) AND deleted_at IS NOT NULL;
    `;
    console.log("Restored any soft-deleted customer records linked to employees.");

    // 2. Populate father_name and names from notes JSON or known data
    const allCusts = await sql`SELECT id, customer_name, contact_person, notes FROM public.customers`;
    for (const c of allCusts) {
      let parsedNotes = null;
      try {
        if (c.notes && c.notes.startsWith('{')) {
          parsedNotes = JSON.parse(c.notes);
        }
      } catch (e) {}

      const fatherName = parsedNotes?.fatherName || c.contact_person || null;
      const firstName = parsedNotes?.firstName || null;
      const lastName = parsedNotes?.lastName || null;

      await sql`
        UPDATE public.customers
        SET 
          father_name = COALESCE(customers.father_name, ${fatherName}),
          first_name = COALESCE(customers.first_name, ${firstName}),
          last_name = COALESCE(customers.last_name, ${lastName}),
          is_active = TRUE
        WHERE id = ${c.id}::uuid;
      `;
    }
    console.log("Populated father_name, first_name, last_name from notes.");

    // Specific record fixes based on employees list
    // 1) Asmatullah Abdullah
    await sql`
      UPDATE public.customers
      SET customer_name = 'ASMATULLAH ABDULLAH',
          first_name = 'ASMATULLAH',
          last_name = 'ABDULLAH',
          father_name = 'ABDULLAH',
          contact_person = 'ABDULLAH',
          mobile = '+971 544816664',
          email = 'asmat@dgt.llc',
          is_active = true,
          deleted_at = null
      WHERE id = '00f508a8-d79d-4300-95b1-0a6dc405a6e1'::uuid;
    `;

    // 2) Fareedullah Abdullah
    await sql`
      UPDATE public.customers
      SET customer_name = 'Fareedullah Abdullah',
          first_name = 'Fareedullah',
          last_name = 'Abdullah',
          father_name = 'ABDULLAH',
          contact_person = 'ABDULLAH',
          is_active = true,
          deleted_at = null
      WHERE id = '71d7eb2f-98f0-408e-be60-b48b7edefff1'::uuid;
    `;

    // 3) Najeebullah Abdullah
    await sql`
      UPDATE public.customers
      SET customer_name = 'Najeebullah Abdullah',
          first_name = 'Najeebullah',
          last_name = 'Abdullah',
          father_name = 'Abdullah',
          contact_person = 'Abdullah',
          is_active = true,
          deleted_at = null
      WHERE id = '47144350-078f-40d9-a723-2cbf0a13db31'::uuid;
    `;

    // 4) Muhammad Saleem
    await sql`
      UPDATE public.customers
      SET customer_name = 'Muhammad Saleem',
          first_name = 'Muhammad',
          last_name = 'Saleem',
          father_name = 'Saleem',
          is_active = true,
          deleted_at = null
      WHERE id = 'c6ee6850-363f-4641-92e0-9d58cf9a1ef6'::uuid;
    `;

    // 5) Sana Shahbaz
    await sql`
      UPDATE public.customers
      SET customer_name = 'Sana Shahbaz',
          first_name = 'Sana',
          last_name = 'Shahbaz',
          father_name = 'Shahbaz Ahmad',
          contact_person = 'Shahbaz Ahmad',
          is_active = true,
          deleted_at = null
      WHERE id = '98daf249-bb4c-4869-a989-476178929ae4'::uuid;
    `;

    // 6) NASEEB ULLAH
    await sql`
      UPDATE public.customers
      SET customer_name = 'NASEEB ULLAH',
          first_name = 'NASEEB',
          last_name = 'ULLAH',
          father_name = 'ABDULLAH',
          contact_person = 'ABDULLAH',
          is_active = true,
          deleted_at = null
      WHERE id = '7219bee7-e983-4e11-bb2f-e9c1fffa807a'::uuid;
    `;

    // 7) نقیب اللہ خان / نجیب اللہ خان
    await sql`
      UPDATE public.customers
      SET customer_name = 'نقیب اللہ خان',
          first_name = 'نقیب اللہ',
          last_name = 'خان',
          father_name = 'عبد اللہ',
          contact_person = 'عبد اللہ',
          is_active = true,
          deleted_at = null
      WHERE id = '83f034b4-17b0-4513-a424-4ad81d30e270'::uuid;
    `;

    // 8) Muhammad Anees
    await sql`
      UPDATE public.customers
      SET customer_name = 'Muhammad Anees',
          first_name = 'Muhammad',
          last_name = 'Anees',
          father_name = 'Muhammad Murad',
          contact_person = 'Muhammad Murad',
          is_active = true,
          deleted_at = null
      WHERE id = '5128cf92-e729-4a84-8bff-8d396baa5bfc'::uuid;
    `;

    console.log("\n=== STEP 3: ALLOCATING PERSON CODES (PER-XXXXXX) ===");
    const unallocated = await sql`
      SELECT id FROM public.customers
      WHERE person_code IS NULL AND deleted_at IS NULL
      ORDER BY created_at ASC;
    `;
    console.log(`Found ${unallocated.length} customers without person_code.`);
    for (const row of unallocated) {
      const [{ code }] = await sql`SELECT next_entity_serial('global', 'GLOBAL', 'person', 'PER') AS code`;
      await sql`
        UPDATE public.customers
        SET person_code = ${code}
        WHERE id = ${row.id}::uuid AND person_code IS NULL;
      `;
      console.log(`Assigned ${code} to customer ${row.id}`);
    }

    console.log("\n=== STEP 4: SEEDING MULTILINGUAL TRANSLATIONS (PASHTO, URDU, ARABIC, PERSIAN) ===");
    
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
        VALUES ('customers', ${t.id}::uuid, 'customer_name', ${t.en}, ${t.en}, 'en', 'human_entered', 'approved')
        ON CONFLICT DO NOTHING;
      `;
    }
    console.log("Seeded Pashto, Urdu, Arabic, Persian, and English translations!");

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
    console.log(`SUCCESS! Loaded ${result.length} active customer / person records:`);
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
