import { withLocalPg, getDbUrl } from '../lib/db/local-postgres.js';

async function seed() {
  const dbUrl = getDbUrl();
  console.log('Connecting to DEV DB:', dbUrl.includes('csesvyxxjivnkkozgopt'));
  if (!dbUrl.includes('csesvyxxjivnkkozgopt')) {
    throw new Error('Safety guard: must be DEV database csesvyxxjivnkkozgopt');
  }

  await withLocalPg(async (sql) => {
    const [uae] = await sql`select id from public.countries where name ilike '%United Arab Emirates%' limit 1`;
    const [pk] = await sql`select id from public.countries where name ilike '%Pakistan%' limit 1`;
    const [chaman] = await sql`select id from public.city_branches where name ilike '%Chaman Shipping & Clearing%' limit 1`;
    const [dubaiBranch] = await sql`select id from public.city_branches where name ilike '%Al Ras Shipping%' limit 1`;

    const uaeCountryId = uae?.id;
    const pkCountryId = pk?.id;
    const chamanBranchId = chaman?.id;
    const dubaiBranchId = dubaiBranch?.id;

    console.log('UAE:', uaeCountryId, 'PK:', pkCountryId, 'Chaman:', chamanBranchId, 'Dubai:', dubaiBranchId);

    const trucksToInsert = [
      {
        truck_number: '7888 هر ر',
        truck_name: 'شیل',
        model: '2009',
        owner_name: 'شاہجہان اصغر',
        owner_name_en: 'Shahjahan Asghar',
        owner_name_ur: 'شاہجہان اصغر',
        driver_name: 'Nsraillh Astad',
        driver_name_en: 'Nsraillh Astad',
        driver_name_ur: 'نصرالله استار',
        transport_company: 'import export',
        transport_company_en: 'import export',
        transport_company_ur: 'امپورٹ ایکسپورٹ',
        owner_mobile: '+92 33498765491',
        driver_mobile: '+92 33498765491',
        country_id: pkCountryId,
        city_branch_id: chamanBranchId,
        status: 'active',
        is_active: true
      },
      {
        truck_number: 'Tkb 861',
        truck_name: 'سوپر',
        model: '2003',
        owner_name: 'مفت استار',
        owner_name_en: 'Muft Ustad',
        owner_name_ur: 'مفت استار',
        driver_name: 'مفت استار',
        driver_name_en: 'Muft Ustad',
        driver_name_ur: 'مفت استار',
        transport_company: 'import export',
        transport_company_en: 'import export',
        transport_company_ur: 'امپورٹ ایکسپورٹ',
        owner_mobile: '+92 31678997543',
        driver_mobile: '+92 31678997543',
        country_id: pkCountryId,
        city_branch_id: chamanBranchId,
        status: 'active',
        is_active: true
      },
      {
        truck_number: 'tkb 988',
        truck_name: 'سوپر',
        model: '20000',
        owner_name: 'Abdul Mateen Khan',
        owner_name_en: 'Abdul Mateen Khan',
        owner_name_ur: 'عبدالمتین خان',
        driver_name: 'محمد ولی حاجی',
        driver_name_en: 'Mohammad Wali Haji',
        driver_name_ur: 'محمد ولی حاجی',
        transport_company: 'import export',
        transport_company_en: 'import export',
        transport_company_ur: 'امپورٹ ایکسپورٹ',
        owner_mobile: '+971 000 0000 00000',
        driver_mobile: '+971 000 0000 00000',
        country_id: uaeCountryId,
        city_branch_id: dubaiBranchId,
        status: 'active',
        is_active: true
      },
      {
        truck_number: 'Tkb445',
        truck_name: 'سوپر',
        model: '2003',
        owner_name: 'بسم الله جان',
        owner_name_en: 'Bismillah Jan',
        owner_name_ur: 'بسم الله جان',
        driver_name: 'Abdul Mateen Khan',
        driver_name_en: 'Abdul Mateen Khan',
        driver_name_ur: 'عبدالمتین خان',
        transport_company: 'import export',
        transport_company_en: 'import export',
        transport_company_ur: 'امپورٹ ایکسپورٹ',
        owner_mobile: '+92 33498765491',
        driver_mobile: '+92 33498765491',
        country_id: pkCountryId,
        city_branch_id: chamanBranchId,
        status: 'active',
        is_active: true
      },
      {
        truck_number: 'Tkf 054',
        truck_name: 'سوپر',
        model: '2003',
        owner_name: 'Nsraillh Astad',
        owner_name_en: 'Nsraillh Astad',
        owner_name_ur: 'نصرالله استار',
        driver_name: 'نصرالله استار',
        driver_name_en: 'Nasrullah Ustad',
        driver_name_ur: 'نصرالله استار',
        transport_company: 'import export',
        transport_company_en: 'import export',
        transport_company_ur: 'امپورٹ ایکسپورٹ',
        owner_mobile: '+92 3347899865',
        driver_mobile: '+92 3347899865',
        country_id: pkCountryId,
        city_branch_id: chamanBranchId,
        status: 'active',
        is_active: true
      },
      {
        truck_number: 'Tkz-5425',
        truck_name: 'سوپر',
        model: '2003',
        owner_name: 'عبدالسلام استار',
        owner_name_en: 'Abdulsalam Ustad',
        owner_name_ur: 'عبدالسلام استار',
        driver_name: 'Najeebullah Abdullah',
        driver_name_en: 'Najeebullah Abdullah',
        driver_name_ur: 'نجیب اللہ عبداللہ',
        transport_company: 'import export',
        transport_company_en: 'import export',
        transport_company_ur: 'امپورٹ ایکسپورٹ',
        owner_mobile: '+971 000 0000 00000',
        driver_mobile: '+971 000 0000 00000',
        country_id: pkCountryId,
        city_branch_id: chamanBranchId,
        status: 'active',
        is_active: true
      }
    ];

    for (const t of trucksToInsert) {
      const [existing] = await sql`select id from public.trucks where truck_number = ${t.truck_number}`;
      if (existing) {
        await sql`
          update public.trucks set
            truck_name = ${t.truck_name},
            model = ${t.model},
            owner_name = ${t.owner_name},
            owner_name_en = ${t.owner_name_en},
            owner_name_ur = ${t.owner_name_ur},
            driver_name = ${t.driver_name},
            driver_name_en = ${t.driver_name_en},
            driver_name_ur = ${t.driver_name_ur},
            transport_company = ${t.transport_company},
            transport_company_en = ${t.transport_company_en},
            transport_company_ur = ${t.transport_company_ur},
            owner_mobile = ${t.owner_mobile},
            driver_mobile = ${t.driver_mobile},
            country_id = ${t.country_id},
            city_branch_id = ${t.city_branch_id},
            status = ${t.status},
            is_active = ${t.is_active}
          where id = ${existing.id}
        `;
      } else {
        await sql`
          insert into public.trucks (
            truck_number, truck_name, model, owner_name, owner_name_en, owner_name_ur,
            driver_name, driver_name_en, driver_name_ur, transport_company, transport_company_en, transport_company_ur,
            owner_mobile, driver_mobile, country_id, city_branch_id, status, is_active
          ) values (
            ${t.truck_number}, ${t.truck_name}, ${t.model}, ${t.owner_name}, ${t.owner_name_en}, ${t.owner_name_ur},
            ${t.driver_name}, ${t.driver_name_en}, ${t.driver_name_ur}, ${t.transport_company}, ${t.transport_company_en}, ${t.transport_company_ur},
            ${t.owner_mobile}, ${t.driver_mobile}, ${t.country_id}, ${t.city_branch_id}, ${t.status}, ${t.is_active}
          )
        `;
      }
    }
    console.log('Successfully seeded/updated 6 approved trucks into DEV DB!');
  });
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
