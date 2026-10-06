import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPaths = ['.env.local', '.env.production', '.env'];
  for (const envFile of envPaths) {
    const fullPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

const OFFICIAL_LOCATIONS_DATA = [
  {
    name: "Pakistan",
    iso2: "PK",
    iso3: "PAK",
    currency: "PKR",
    phone: "+92",
    states: [
      {
        name: "Punjab",
        code: "PK-PB",
        districts: [
          {
            name: "Lahore",
            code: "PK-PB-LHR",
            cities: [
              { name: "Lahore", code: "LHR", zip: "54000", phone: "042" },
              { name: "Model Town", code: "PK-PB-MTN", zip: "54700", phone: "042" },
              { name: "Raiwind", code: "PK-PB-RWD", zip: "55150", phone: "042" },
              { name: "Gulberg Lahore", code: "PK-PB-GLB", zip: "54660", phone: "042" },
              { name: "Cantonment Lahore", code: "PK-PB-LCT", zip: "54810", phone: "042" }
            ]
          },
          {
            name: "Faisalabad",
            code: "PK-PB-FSD",
            cities: [
              { name: "Faisalabad", code: "FSD", zip: "38000", phone: "041" },
              { name: "Jaranwala", code: "PK-PB-JNW", zip: "37200", phone: "041" },
              { name: "Samundri", code: "PK-PB-SMD", zip: "37300", phone: "041" }
            ]
          },
          {
            name: "Rawalpindi",
            code: "PK-PB-RWP",
            cities: [
              { name: "Rawalpindi", code: "RWP", zip: "46000", phone: "051" },
              { name: "Taxila", code: "PK-PB-TXL", zip: "47080", phone: "051" },
              { name: "Gujar Khan", code: "PK-PB-GJK", zip: "47800", phone: "051" }
            ]
          },
          {
            name: "Multan",
            code: "PK-PB-MUX",
            cities: [
              { name: "Multan", code: "MUX", zip: "60000", phone: "061" },
              { name: "Shujabad", code: "PK-PB-SJB", zip: "60600", phone: "061" }
            ]
          },
          {
            name: "Gujranwala",
            code: "PK-PB-GJR",
            cities: [
              { name: "Gujranwala", code: "GJR", zip: "52250", phone: "055" },
              { name: "Kamoke", code: "PK-PB-KMK", zip: "52470", phone: "055" }
            ]
          },
          {
            name: "Sialkot",
            code: "PK-PB-SKT",
            cities: [
              { name: "Sialkot", code: "SKT", zip: "51310", phone: "052" },
              { name: "Daska", code: "PK-PB-DSK", zip: "51010", phone: "052" }
            ]
          }
        ]
      },
      {
        name: "Sindh",
        code: "PK-SD",
        districts: [
          {
            name: "Karachi Central",
            code: "PK-SD-KHI",
            cities: [
              { name: "Karachi", code: "KHI", zip: "74000", phone: "021" },
              { name: "Gulshan-e-Iqbal", code: "PK-SD-GEI", zip: "75300", phone: "021" },
              { name: "Clifton Karachi", code: "PK-SD-CFT", zip: "75600", phone: "021" },
              { name: "DHA Karachi", code: "PK-SD-DHA", zip: "75500", phone: "021" },
              { name: "Nazimabad", code: "PK-SD-NZM", zip: "74600", phone: "021" },
              { name: "North Nazimabad", code: "PK-SD-NNZ", zip: "74700", phone: "021" },
              { name: "Korangi", code: "PK-SD-KRG", zip: "74900", phone: "021" },
              { name: "Saddar Karachi", code: "PK-SD-SDR", zip: "74400", phone: "021" }
            ]
          },
          {
            name: "Hyderabad",
            code: "PK-SD-HDD",
            cities: [
              { name: "Hyderabad", code: "HDD", zip: "71000", phone: "022" },
              { name: "Latifabad", code: "PK-SD-LTF", zip: "71800", phone: "022" },
              { name: "Qasimabad", code: "PK-SD-QSM", zip: "71500", phone: "022" }
            ]
          },
          {
            name: "Sukkur",
            code: "PK-SD-SKR",
            cities: [
              { name: "Sukkur", code: "SKR", zip: "65200", phone: "071" },
              { name: "Rohri", code: "PK-SD-RHR", zip: "65170", phone: "071" }
            ]
          }
        ]
      },
      {
        name: "Balochistan",
        code: "PK-BA",
        districts: [
          {
            name: "Quetta",
            code: "PK-BA-UET",
            cities: [
              { name: "Quetta", code: "UET", zip: "87300", phone: "081" },
              { name: "Cantonment Quetta", code: "PK-BA-QCT", zip: "87310", phone: "081" },
              { name: "Kuchlak", code: "PK-BA-KCK", zip: "87100", phone: "081" }
            ]
          },
          {
            name: "Gwadar",
            code: "PK-BA-GWD",
            cities: [
              { name: "Gwadar", code: "GWD", zip: "91200", phone: "086" },
              { name: "Pasni", code: "PK-BA-PSN", zip: "91300", phone: "086" },
              { name: "Ormara", code: "PK-BA-ORM", zip: "91400", phone: "086" }
            ]
          },
          {
            name: "Chaman",
            code: "PK-BA-CHM",
            cities: [
              { name: "Chaman", code: "CHM", zip: "86000", phone: "0826" }
            ]
          },
          {
            name: "Pishin",
            code: "PK-BA-PSH",
            cities: [
              { name: "Pishin", code: "PSH", zip: "86200", phone: "0826" },
              { name: "Hurramzai", code: "PK-BA-HRM", zip: "86230", phone: "0826" }
            ]
          }
        ]
      },
      {
        name: "Khyber Pakhtunkhwa",
        code: "PK-KP",
        districts: [
          {
            name: "Peshawar",
            code: "PK-KP-PEW",
            cities: [
              { name: "Peshawar", code: "PEW", zip: "25000", phone: "091" },
              { name: "Hayatabad", code: "PK-KP-HYT", zip: "25100", phone: "091" },
              { name: "University Town", code: "PK-KP-UTN", zip: "25120", phone: "091" }
            ]
          },
          {
            name: "Mardan",
            code: "PK-KP-MDN",
            cities: [
              { name: "Mardan", code: "MDN", zip: "23200", phone: "0937" },
              { name: "Takht-i-Bahi", code: "PK-KP-TKB", zip: "23210", phone: "0937" }
            ]
          },
          {
            name: "Abbottabad",
            code: "PK-KP-ATD",
            cities: [
              { name: "Abbottabad", code: "ATD", zip: "22010", phone: "0992" },
              { name: "Havelian", code: "PK-KP-HVL", zip: "22500", phone: "0992" }
            ]
          }
        ]
      },
      {
        name: "Islamabad Capital Territory",
        code: "PK-IS",
        districts: [
          {
            name: "Islamabad",
            code: "PK-IS-ISB",
            cities: [
              { name: "Islamabad", code: "ISB", zip: "44000", phone: "051" },
              { name: "Blue Area Islamabad", code: "PK-IS-BLU", zip: "44010", phone: "051" },
              { name: "Sector F-6", code: "PK-IS-F6", zip: "44220", phone: "051" },
              { name: "Sector F-7", code: "PK-IS-F7", zip: "44210", phone: "051" },
              { name: "Sector G-9", code: "PK-IS-G9", zip: "44080", phone: "051" },
              { name: "Sector I-8", code: "PK-IS-I8", zip: "44800", phone: "051" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "Afghanistan",
    iso2: "AF",
    iso3: "AFG",
    currency: "AFN",
    phone: "+93",
    states: [
      {
        name: "Kabul",
        code: "AF-KBL",
        districts: [
          {
            name: "Kabul City",
            code: "AF-KBL-CTY",
            cities: [
              { name: "Kabul", code: "KBL", zip: "1001", phone: "020" },
              { name: "Shahr-e Naw", code: "AF-KBL-SHN", zip: "1002", phone: "020" },
              { name: "Wazir Akbar Khan", code: "AF-KBL-WAK", zip: "1003", phone: "020" },
              { name: "Dasht-e Barchi", code: "AF-KBL-DEB", zip: "1004", phone: "020" },
              { name: "Khair Khana", code: "AF-KBL-KHK", zip: "1005", phone: "020" }
            ]
          },
          {
            name: "Paghman",
            code: "AF-KBL-PGM",
            cities: [
              { name: "Paghman", code: "AF-KBL-PGM-C", zip: "1051", phone: "020" }
            ]
          }
        ]
      },
      {
        name: "Kandahar",
        code: "AF-KDH",
        districts: [
          {
            name: "Kandahar City",
            code: "AF-KDH-CTY",
            cities: [
              { name: "Kandahar", code: "KDH", zip: "3801", phone: "030" },
              { name: "Aino Mina", code: "AF-KDH-ANM", zip: "3802", phone: "030" },
              { name: "Loya Wala", code: "AF-KDH-LYW", zip: "3803", phone: "030" }
            ]
          },
          {
            name: "Spin Boldak",
            code: "AF-KDH-SPB",
            cities: [
              { name: "Spin Boldak", code: "AF-KDH-SPB-C", zip: "3851", phone: "030" }
            ]
          }
        ]
      },
      {
        name: "Herat",
        code: "AF-HRT",
        districts: [
          {
            name: "Herat City",
            code: "AF-HRT-CTY",
            cities: [
              { name: "Herat", code: "HRT", zip: "3001", phone: "040" },
              { name: "Ghoriyan", code: "AF-HRT-GHR", zip: "3051", phone: "040" }
            ]
          },
          {
            name: "Islam Qala",
            code: "AF-HRT-ISQ",
            cities: [
              { name: "Islam Qala", code: "AF-HRT-ISQ-C", zip: "3061", phone: "040" }
            ]
          }
        ]
      },
      {
        name: "Balkh",
        code: "AF-BAL",
        districts: [
          {
            name: "Mazar-i-Sharif",
            code: "AF-BAL-MZR",
            cities: [
              { name: "Mazar-i-Sharif", code: "MZR", zip: "1701", phone: "050" },
              { name: "Balkh", code: "AF-BAL-BLK", zip: "1702", phone: "050" },
              { name: "Hairatan", code: "AF-BAL-HRT", zip: "1751", phone: "050" }
            ]
          }
        ]
      },
      {
        name: "Nangarhar",
        code: "AF-NAN",
        districts: [
          {
            name: "Jalalabad",
            code: "AF-NAN-JAA",
            cities: [
              { name: "Jalalabad", code: "JAA", zip: "2601", phone: "060" },
              { name: "Torkham", code: "AF-NAN-TRK", zip: "2651", phone: "060" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "United Arab Emirates",
    iso2: "AE",
    iso3: "ARE",
    currency: "AED",
    phone: "+971",
    states: [
      {
        name: "Abu Dhabi",
        code: "AE-AZ",
        districts: [
          {
            name: "Abu Dhabi Region",
            code: "AE-AZ-ADR",
            cities: [
              { name: "Abu Dhabi", code: "AUH", zip: "00000", phone: "02" },
              { name: "Mussafah", code: "AE-AZ-MSF", zip: "00000", phone: "02" },
              { name: "Al Reem Island", code: "AE-AZ-RIM", zip: "00000", phone: "02" },
              { name: "Yas Island", code: "AE-AZ-YAS", zip: "00000", phone: "02" },
              { name: "Al Raha", code: "AE-AZ-RHA", zip: "00000", phone: "02" },
              { name: "Khalifa City", code: "AE-AZ-KHC", zip: "00000", phone: "02" },
              { name: "Mohammed Bin Zayed City", code: "AE-AZ-MBZ", zip: "00000", phone: "02" }
            ]
          },
          {
            name: "Al Ain Region",
            code: "AE-AZ-AAR",
            cities: [
              { name: "Al Ain", code: "AAN", zip: "00000", phone: "03" },
              { name: "Al Yahar", code: "AE-AZ-YHR", zip: "00000", phone: "03" },
              { name: "Al Maqam", code: "AE-AZ-MQM", zip: "00000", phone: "03" }
            ]
          },
          {
            name: "Al Dhafra Region",
            code: "AE-AZ-ADF",
            cities: [
              { name: "Ruwais", code: "AE-AZ-RWS", zip: "00000", phone: "02" },
              { name: "Madinat Zayed", code: "AE-AZ-MNZ", zip: "00000", phone: "02" },
              { name: "Mirfa", code: "AE-AZ-MRF", zip: "00000", phone: "02" }
            ]
          }
        ]
      },
      {
        name: "Dubai",
        code: "AE-DU",
        districts: [
          {
            name: "Deira",
            code: "AE-DU-DRA",
            cities: [
              { name: "Deira", code: "AE-DU-DEI", zip: "00000", phone: "04" },
              { name: "Al Rigga", code: "AE-DU-RGA", zip: "00000", phone: "04" },
              { name: "Al Muteena", code: "AE-DU-MTN", zip: "00000", phone: "04" },
              { name: "Al Garhoud", code: "AE-DU-GRH", zip: "00000", phone: "04" },
              { name: "Al Qusais", code: "AE-DU-QSS", zip: "00000", phone: "04" },
              { name: "Al Nahda Dubai", code: "AE-DU-NHD", zip: "00000", phone: "04" }
            ]
          },
          {
            name: "Bur Dubai",
            code: "AE-DU-BDR",
            cities: [
              { name: "Dubai", code: "DXB", zip: "00000", phone: "04" },
              { name: "Bur Dubai", code: "AE-DU-BUR", zip: "00000", phone: "04" },
              { name: "Business Bay", code: "AE-DU-BB", zip: "00000", phone: "04" },
              { name: "Downtown Dubai", code: "AE-DU-DTD", zip: "00000", phone: "04" },
              { name: "DIFC", code: "AE-DU-DIFC", zip: "00000", phone: "04" },
              { name: "Al Karama", code: "AE-DU-KRM", zip: "00000", phone: "04" },
              { name: "Al Mankhool", code: "AE-DU-MNK", zip: "00000", phone: "04" },
              { name: "Jumeirah", code: "AE-DU-JMR", zip: "00000", phone: "04" }
            ]
          },
          {
            name: "New Dubai / South",
            code: "AE-DU-NDS",
            cities: [
              { name: "Dubai Marina", code: "AE-DU-DMR", zip: "00000", phone: "04" },
              { name: "JBR (Jumeirah Beach Residence)", code: "AE-DU-JBR", zip: "00000", phone: "04" },
              { name: "JLT (Jumeirah Lake Towers)", code: "AE-DU-JLT", zip: "00000", phone: "04" },
              { name: "Palm Jumeirah", code: "AE-DU-PJM", zip: "00000", phone: "04" },
              { name: "Dubai Silicon Oasis", code: "AE-DU-DSO", zip: "00000", phone: "04" },
              { name: "International City Dubai", code: "AE-DU-INC", zip: "00000", phone: "04" },
              { name: "Dubai Sports City", code: "AE-DU-DSC", zip: "00000", phone: "04" },
              { name: "JVC (Jumeirah Village Circle)", code: "AE-DU-JVC", zip: "00000", phone: "04" },
              { name: "Dubai Investment Park (DIP)", code: "AE-DU-DIP", zip: "00000", phone: "04" },
              { name: "Jebel Ali", code: "AE-DU-JBL", zip: "00000", phone: "04" }
            ]
          }
        ]
      },
      {
        name: "Sharjah",
        code: "AE-SH",
        districts: [
          {
            name: "Sharjah City",
            code: "AE-SH-SHJ",
            cities: [
              { name: "Sharjah", code: "SHJ", zip: "00000", phone: "06" },
              { name: "Al Majaz", code: "AE-SH-MJZ", zip: "00000", phone: "06" },
              { name: "Al Nahda Sharjah", code: "AE-SH-NHD", zip: "00000", phone: "06" },
              { name: "Al Qasimia", code: "AE-SH-QSM", zip: "00000", phone: "06" },
              { name: "Al Taawun", code: "AE-SH-TWN", zip: "00000", phone: "06" },
              { name: "Muwaileh", code: "AE-SH-MWL", zip: "00000", phone: "06" },
              { name: "Sharjah Industrial Area", code: "AE-SH-IND", zip: "00000", phone: "06" }
            ]
          },
          {
            name: "Eastern Region",
            code: "AE-SH-ERG",
            cities: [
              { name: "Khor Fakkan", code: "KFK", zip: "00000", phone: "09" },
              { name: "Kalba", code: "KLB", zip: "00000", phone: "09" },
              { name: "Dibba Al Hisn", code: "AE-SH-DAH", zip: "00000", phone: "09" }
            ]
          }
        ]
      },
      {
        name: "Ajman",
        code: "AE-AJ",
        districts: [
          {
            name: "Ajman City",
            code: "AE-AJ-AJM",
            cities: [
              { name: "Ajman", code: "AJM", zip: "00000", phone: "06" },
              { name: "Al Nuaimia", code: "AE-AJ-NMA", zip: "00000", phone: "06" },
              { name: "Al Rashidiya Ajman", code: "AE-AJ-RSH", zip: "00000", phone: "06" },
              { name: "Al Jurf", code: "AE-AJ-JRF", zip: "00000", phone: "06" },
              { name: "Ajman Industrial Area", code: "AE-AJ-IND", zip: "00000", phone: "06" }
            ]
          }
        ]
      },
      {
        name: "Ras Al Khaimah",
        code: "AE-RK",
        districts: [
          {
            name: "Ras Al Khaimah City",
            code: "AE-RK-RAK",
            cities: [
              { name: "Ras Al Khaimah", code: "RKT", zip: "00000", phone: "07" },
              { name: "Al Hamra Village", code: "AE-RK-AHV", zip: "00000", phone: "07" },
              { name: "Al Marjan Island", code: "AE-RK-AMJ", zip: "00000", phone: "07" },
              { name: "Al Nakheel", code: "AE-RK-NKH", zip: "00000", phone: "07" }
            ]
          }
        ]
      },
      {
        name: "Fujairah",
        code: "AE-FU",
        districts: [
          {
            name: "Fujairah City",
            code: "AE-FU-FJR",
            cities: [
              { name: "Fujairah", code: "FJR", zip: "00000", phone: "09" },
              { name: "Dibba Al Fujairah", code: "AE-FU-DBA", zip: "00000", phone: "09" },
              { name: "Al Aqah", code: "AE-FU-AQH", zip: "00000", phone: "09" }
            ]
          }
        ]
      },
      {
        name: "Umm Al Quwain",
        code: "AE-UQ",
        districts: [
          {
            name: "Umm Al Quwain City",
            code: "AE-UQ-UAQ",
            cities: [
              { name: "Umm Al Quwain", code: "UAQ", zip: "00000", phone: "06" },
              { name: "Al Salama", code: "AE-UQ-SLM", zip: "00000", phone: "06" }
            ]
          }
        ]
      }
    ]
  }
];

async function run() {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    console.error("No DATABASE_URL found!");
    process.exit(1);
  }

  console.log("Connecting to PostgreSQL...");
  const sql = postgres(dbUrl, { max: 1, prepare: false });

  for (const cData of OFFICIAL_LOCATIONS_DATA) {
    try {
      console.log(`Processing Country: ${cData.name}...`);
      let countryId = null;
      const [cMatch] = await sql`
        select id from public.countries
        where deleted_at is null and (lower(name) = lower(${cData.name}) or iso2 = ${cData.iso2})
        limit 1
      `;

      if (cMatch?.id) {
        countryId = cMatch.id;
        await sql`
          update public.countries
          set name = ${cData.name}, iso2 = ${cData.iso2}, iso3 = ${cData.iso3},
              currency_code = ${cData.currency}, phone_code = ${cData.phone},
              is_active = true, updated_at = now()
          where id = ${countryId}
        `;
      } else {
        const [cIns] = await sql`
          insert into public.countries (name, iso2, iso3, currency_code, phone_code, is_active, official_email, admin_email)
          values (${cData.name}, ${cData.iso2}, ${cData.iso3}, ${cData.currency}, ${cData.phone}, true, ${'official@' + cData.name.toLowerCase().replace(/\s+/g, '') + '.com'}, ${'admin@' + cData.name.toLowerCase().replace(/\s+/g, '') + '.com'})
          returning id
        `;
        countryId = cIns.id;
      }

      for (const sData of cData.states) {
        let stateId = null;
        const [sMatch] = await sql`
          select id from public.states_provinces
          where country_id = ${countryId} and deleted_at is null
            and (lower(name) = lower(${sData.name}) or code = ${sData.code})
          limit 1
        `;

        if (sMatch?.id) {
          stateId = sMatch.id;
          await sql`
            update public.states_provinces
            set name = ${sData.name}, code = ${sData.code}, is_active = true, updated_at = now()
            where id = ${stateId}
          `;
        } else {
          const [sIns] = await sql`
            insert into public.states_provinces (country_id, name, code, is_active)
            values (${countryId}, ${sData.name}, ${sData.code}, true)
            returning id
          `;
          stateId = sIns.id;
        }

        for (const dData of sData.districts) {
          let districtId = null;
          const [dMatch] = await sql`
            select id from public.districts
            where state_province_id = ${stateId} and deleted_at is null
              and (lower(name) = lower(${dData.name}) or code = ${dData.code})
            limit 1
          `;

          if (dMatch?.id) {
            districtId = dMatch.id;
            await sql`
              update public.districts
              set name = ${dData.name}, code = ${dData.code}, country_id = ${countryId}, is_active = true, updated_at = now()
              where id = ${districtId}
            `;
          } else {
            const [dIns] = await sql`
              insert into public.districts (country_id, state_province_id, name, code, is_active)
              values (${countryId}, ${stateId}, ${dData.name}, ${dData.code}, true)
              returning id
            `;
            districtId = dIns.id;
          }

          for (const cityData of dData.cities) {
            const [cityMatch] = await sql`
              select id from public.cities
              where country_id = ${countryId} and deleted_at is null
                and (lower(name) = lower(${cityData.name}) or code = ${cityData.code})
              limit 1
            `;

            if (cityMatch?.id) {
              await sql`
                update public.cities
                set name = ${cityData.name}, code = ${cityData.code},
                    state_province_id = ${stateId}, district_id = ${districtId},
                    zip_code = ${cityData.zip || null}, phone_area_code = ${cityData.phone || null},
                    is_active = true, updated_at = now()
                where id = ${cityMatch.id}
              `;
            } else {
              await sql`
                insert into public.cities (country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active)
                values (${countryId}, ${stateId}, ${districtId}, ${cityData.name}, ${cityData.code}, ${cityData.zip || null}, ${cityData.phone || null}, true)
              `;
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error processing ${cData.name}:`, err);
    }
  }

  console.log("Location population completed!");
  await sql.end();
}

run();
