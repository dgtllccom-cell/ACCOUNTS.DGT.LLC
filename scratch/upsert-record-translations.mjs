import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

const translationEntries = [
  {
    id: '00f508a8-d79d-4300-95b1-0a6dc405a6e1',
    field: 'customer_name',
    en: 'ASMATULLAH ABDULLAH',
    ps: 'عصمت الله عبد الله',
    ur: 'عصمت اللہ عبداللہ',
    ar: 'عصمت الله عبد الله',
    fa: 'عصمت‌الله عبدالله'
  },
  {
    id: '71d7eb2f-98f0-408e-be60-b48b7edefff1',
    field: 'customer_name',
    en: 'Fareedullah Abdullah',
    ps: 'فريد الله عبد الله',
    ur: 'فرید اللہ عبداللہ',
    ar: 'فريد الله عبد الله',
    fa: 'فریدالله عبدالله'
  },
  {
    id: '47144350-078f-40d9-a723-2cbf0a13db31',
    field: 'customer_name',
    en: 'Najeebullah Abdullah',
    ps: 'نجيب الله عبد الله',
    ur: 'نجیب اللہ عبداللہ',
    ar: 'نجيب الله عبد الله',
    fa: 'نجیب‌الله عبدالله'
  },
  {
    id: 'c6ee6850-363f-4641-92e0-9d58cf9a1ef6',
    field: 'customer_name',
    en: 'Muhammad Saleem',
    ps: 'محمد سليم',
    ur: 'محمد سلیم',
    ar: 'محمد سليم',
    fa: 'محمد سلیم'
  },
  {
    id: '98daf249-bb4c-4869-a989-476178929ae4',
    field: 'customer_name',
    en: 'Sana Shahbaz',
    ps: 'ثناء شهباز',
    ur: 'ثناء شہباز',
    ar: 'ثناء شهباز',
    fa: 'ثناء شهباز'
  },
  {
    id: '7219bee7-e983-4e11-bb2f-e9c1fffa807a',
    field: 'customer_name',
    en: 'NASEEB ULLAH',
    ps: 'نصيب الله',
    ur: 'نصیب اللہ',
    ar: 'نصيب الله',
    fa: 'نصیب‌الله'
  },
  {
    id: '83f034b4-17b0-4513-a424-4ad81d30e270',
    field: 'customer_name',
    en: 'Naqeeb Ullah Khan',
    ps: 'نقیب الله خان',
    ur: 'نقیب اللہ خان',
    ar: 'نقيب الله خان',
    fa: 'نقیب‌الله خان'
  },
  {
    id: '5128cf92-e729-4a84-8bff-8d396baa5bfc',
    field: 'customer_name',
    en: 'Muhammad Anees',
    ps: 'محمد انيس',
    ur: 'محمد انیس',
    ar: 'محمد أنيس',
    fa: 'محمد انیس'
  },
  {
    id: '1900bbe1-d245-47dd-a9ee-dfffd46ab245',
    field: 'customer_name',
    en: 'Muhammad Usman',
    ps: 'محمد عثمان',
    ur: 'محمد عثمان',
    ar: 'محمد عثمان',
    fa: 'محمد عثمان'
  },
  {
    id: 'd95b898d-302d-4a15-8713-c7fdbfd18160',
    field: 'customer_name',
    en: 'Najeebullah',
    ps: 'نجيب الله',
    ur: 'نجیب اللہ',
    ar: 'نجيب الله',
    fa: 'نجیب‌الله'
  },
  {
    id: '6b6d57a7-d65f-4cf5-80e4-424a40c1b1f0',
    field: 'customer_name',
    en: 'Muhammad Anees',
    ps: 'محمد انيس',
    ur: 'محمد انیس',
    ar: 'محمد أنيس',
    fa: 'محمد انیس'
  }
];

async function main() {
  try {
    for (const t of translationEntries) {
      const languageTexts = {
        en: t.en,
        ps: t.ps,
        ur: t.ur,
        ar: t.ar,
        fa: t.fa
      };

      const existing = await sql`
        SELECT id FROM public.record_translations
        WHERE record_table = 'customers' AND record_id = ${t.id}::uuid AND field_name = ${t.field};
      `;

      if (existing.length > 0) {
        await sql`
          UPDATE public.record_translations
          SET 
            english_text = ${t.en},
            pashto_text = ${t.ps},
            urdu_text = ${t.ur},
            arabic_text = ${t.ar},
            persian_text = ${t.fa},
            language_texts = ${JSON.stringify(languageTexts)},
            translation_status = 'approved',
            source = 'manual',
            updated_at = NOW(),
            deleted_at = NULL
          WHERE id = ${existing[0].id};
        `;
      } else {
        await sql`
          INSERT INTO public.record_translations (
            record_table, record_id, field_name, original_text, original_language_code,
            english_text, pashto_text, urdu_text, arabic_text, persian_text,
            language_texts, translation_status, source, created_at, updated_at
          ) VALUES (
            'customers', ${t.id}::uuid, ${t.field}, ${t.en}, 'en',
            ${t.en}, ${t.ps}, ${t.ur}, ${t.ar}, ${t.fa},
            ${JSON.stringify(languageTexts)}, 'approved', 'manual', NOW(), NOW()
          );
        `;
      }
      console.log(`Upserted record_translations for customer ${t.en} (${t.id})`);
    }
    console.log("All record_translations successfully upserted!");
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
