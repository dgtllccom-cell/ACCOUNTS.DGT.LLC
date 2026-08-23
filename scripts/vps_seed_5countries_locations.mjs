
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
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^[\"\']/, "").replace(/[\"\']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 30 });

const LOCATIONS_DATA = [
  // 1. PAKISTAN
  {
    name: "Pakistan",
    iso2: "PK",
    iso3: "PAK",
    currency: "PKR",
    phone: "+92",
    officialEmail: "pk.office@dgt.llc",
    adminEmail: "pk.admin@dgt.llc",
    tr: { en: "Pakistan", ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" },
    states: [
      {
        name: "Punjab",
        code: "PK-PB",
        tr: { en: "Punjab", ur: "پنجاب", ar: "البنجاب", fa: "پنجاب", ps: "پنجاب" },
        districts: [
          {
            name: "Lahore District",
            code: "PK-PB-LHR",
            tr: { en: "Lahore District", ur: "ضلع لاہور", ar: "منطقة لاهور", fa: "ضلع لاهور", ps: "د لاهور ولسوالۍ" },
            cities: [
              { name: "Lahore", code: "LHR", zip: "54000", phone: "042", tr: { en: "Lahore", ur: "لاہور", ar: "لاهور", fa: "لاهور", ps: "لاهور" } },
              { name: "Model Town", code: "PK-PB-MTN", zip: "54700", phone: "042", tr: { en: "Model Town", ur: "ماڈل ٹاؤن", ar: "موديل تاون", fa: "مدل تاون", ps: "ماډل ټاون" } },
              { name: "Raiwind", code: "PK-PB-RWD", zip: "55150", phone: "042", tr: { en: "Raiwind", ur: "رائے ونڈ", ar: "رايوند", fa: "رایوند", ps: "رایونډ" } },
              { name: "Gulberg Lahore", code: "PK-PB-GLB", zip: "54660", phone: "042", tr: { en: "Gulberg Lahore", ur: "گلبرگ لاہور", ar: "غولبرغ لاهور", fa: "گلبرگ لاهور", ps: "ګلبرګ لاهور" } }
            ]
          },
          {
            name: "Rawalpindi District",
            code: "PK-PB-RWP",
            tr: { en: "Rawalpindi District", ur: "ضلع راولپنڈی", ar: "منطقة راولبندي", fa: "ضلع راولپندی", ps: "د راولپنډۍ ولسوالۍ" },
            cities: [
              { name: "Rawalpindi", code: "RWP", zip: "46000", phone: "051", tr: { en: "Rawalpindi", ur: "راولپنڈی", ar: "راولبندي", fa: "راولپندی", ps: "راولپنډۍ" } },
              { name: "Taxila", code: "PK-PB-TXL", zip: "47080", phone: "051", tr: { en: "Taxila", ur: "ٹیکسلا", ar: "تاكسيلا", fa: "تاکسیلا", ps: "ټیکسلا" } },
              { name: "Gujar Khan", code: "PK-PB-GJK", zip: "47800", phone: "051", tr: { en: "Gujar Khan", ur: "گوجر خان", ar: "غوجار خان", fa: "گوجر خان", ps: "ګوجر خان" } }
            ]
          },
          {
            name: "Faisalabad District",
            code: "PK-PB-FSD",
            tr: { en: "Faisalabad District", ur: "ضلع فیصل آباد", ar: "منطقة فيصل آباد", fa: "ضلع فیصل آباد", ps: "د فیصل اباد ولسوالۍ" },
            cities: [
              { name: "Faisalabad", code: "FSD", zip: "38000", phone: "041", tr: { en: "Faisalabad", ur: "فیصل آباد", ar: "فيصل آباد", fa: "فیصل آباد", ps: "فیصل اباد" } },
              { name: "Jaranwala", code: "PK-PB-JNW", zip: "37200", phone: "041", tr: { en: "Jaranwala", ur: "جڑانوالہ", ar: "جَرانوالا", fa: "جڑانواله", ps: "جړانواله" } }
            ]
          },
          {
            name: "Multan District",
            code: "PK-PB-MUX",
            tr: { en: "Multan District", ur: "ضلع ملتان", ar: "منطقة ملتان", fa: "ضلع ملتان", ps: "د ملتان ولسوالۍ" },
            cities: [
              { name: "Multan", code: "MUX", zip: "60000", phone: "061", tr: { en: "Multan", ur: "ملتان", ar: "ملتان", fa: "ملتان", ps: "ملتان" } },
              { name: "Shujabad", code: "PK-PB-SJB", zip: "60600", phone: "061", tr: { en: "Shujabad", ur: "شجاع آباد", ar: "شجاع آباد", fa: "شجاع آباد", ps: "شجاع اباد" } }
            ]
          },
          {
            name: "Gujranwala District",
            code: "PK-PB-GJR",
            tr: { en: "Gujranwala District", ur: "ضلع گوجرانوالہ", ar: "منطقة غوجرانوالا", fa: "ضلع گوجرانواله", ps: "د ګوجرانوالې ولسوالۍ" },
            cities: [
              { name: "Gujranwala", code: "GJR", zip: "52250", phone: "055", tr: { en: "Gujranwala", ur: "گوجرانوالہ", ar: "غوجرانوالا", fa: "گوجرانواله", ps: "ګوجرانواله" } },
              { name: "Kamoke", code: "PK-PB-KMK", zip: "52470", phone: "055", tr: { en: "Kamoke", ur: "کامونکی", ar: "كاموكي", fa: "کاموکی", ps: "کاموکي" } }
            ]
          },
          {
            name: "Sialkot District",
            code: "PK-PB-SKT",
            tr: { en: "Sialkot District", ur: "ضلع سیالکوٹ", ar: "منطقة سيالكوت", fa: "ضلع سیالکوت", ps: "د سیالکوټ ولسوالۍ" },
            cities: [
              { name: "Sialkot", code: "SKT", zip: "51310", phone: "052", tr: { en: "Sialkot", ur: "سیالکوٹ", ar: "سيالكوت", fa: "سیالکوت", ps: "سیالکوټ" } },
              { name: "Daska", code: "PK-PB-DSK", zip: "51010", phone: "052", tr: { en: "Daska", ur: "ڈسکہ", ar: "دسكا", fa: "دسکه", ps: "ډسکه" } }
            ]
          }
        ]
      },
      {
        name: "Sindh",
        code: "PK-SD",
        tr: { en: "Sindh", ur: "سندھ", ar: "السند", fa: "سند", ps: "سندھ" },
        districts: [
          {
            name: "Karachi Central District",
            code: "PK-SD-KHI",
            tr: { en: "Karachi Central District", ur: "ضلع کراچی سینٹرل", ar: "منطقة كراتشي المركزية", fa: "ضلع مرکزی کرچی", ps: "د کراچۍ مرکزي ولسوالۍ" },
            cities: [
              { name: "Karachi", code: "KHI", zip: "74000", phone: "021", tr: { en: "Karachi", ur: "کراچی", ar: "كراتشي", fa: "کرچی", ps: "کراچۍ" } },
              { name: "Gulshan-e-Iqbal", code: "PK-SD-GEI", zip: "75300", phone: "021", tr: { en: "Gulshan-e-Iqbal", ur: "گلشن اقبال", ar: "غلشن إقبال", fa: "گلشن اقبال", ps: "ګلشن اقبال" } },
              { name: "Clifton Karachi", code: "PK-SD-CFT", zip: "75600", phone: "021", tr: { en: "Clifton Karachi", ur: "کلفٹن کراچی", ar: "كليفتون كراتشي", fa: "کلیفټن کرچی", ps: "کلفټن کراچۍ" } },
              { name: "DHA Karachi", code: "PK-SD-DHA", zip: "75500", phone: "021", tr: { en: "DHA Karachi", ur: "ڈی ایچ اے کراچی", ar: "دي إتش إيه كراتشي", fa: "دی اچ ای کرچی", ps: "ډي ایچ اې کراچۍ" } },
              { name: "Saddar Karachi", code: "PK-SD-SDR", zip: "74400", phone: "021", tr: { en: "Saddar Karachi", ur: "صدر کراچی", ar: "صدر كراتشي", fa: "صدر کرچی", ps: "صدر کراچۍ" } }
            ]
          },
          {
            name: "Hyderabad District",
            code: "PK-SD-HDD",
            tr: { en: "Hyderabad District", ur: "ضلع حیدرآباد", ar: "منطقة حيدر أباد", fa: "ضلع حیدرآباد", ps: "د حیدر اباد ولسوالۍ" },
            cities: [
              { name: "Hyderabad", code: "HDD", zip: "71000", phone: "022", tr: { en: "Hyderabad", ur: "حیدرآباد", ar: "حيدر أباد", fa: "حیدرآباد", ps: "حیدر اباد" } },
              { name: "Latifabad", code: "PK-SD-LTF", zip: "71800", phone: "022", tr: { en: "Latifabad", ur: "لطیف آباد", ar: "لطيف آباد", fa: "لطیف آباد", ps: "لطیف اباد" } }
            ]
          },
          {
            name: "Sukkur District",
            code: "PK-SD-SKR",
            tr: { en: "Sukkur District", ur: "ضلع سکھر", ar: "منطقة سكر", fa: "ضلع سکر", ps: "د سکر ولسوالۍ" },
            cities: [
              { name: "Sukkur", code: "SKR", zip: "65200", phone: "071", tr: { en: "Sukkur", ur: "سکھر", ar: "سكر", fa: "سکر", ps: "سکر" } },
              { name: "Rohri", code: "PK-SD-RHR", zip: "65170", phone: "071", tr: { en: "Rohri", ur: "روہڑی", ar: "روهري", fa: "روهری", ps: "روهړي" } }
            ]
          }
        ]
      },
      {
        name: "Balochistan",
        code: "PK-BA",
        tr: { en: "Balochistan", ur: "بلوچستان", ar: "بلوشستان", fa: "بلوچستان", ps: "بلوچستان" },
        districts: [
          {
            name: "Quetta District",
            code: "PK-BA-QTA",
            tr: { en: "Quetta District", ur: "ضلع کوئٹہ", ar: "منطقة كويتا", fa: "ضلع کویته", ps: "د کوټې ولسوالۍ" },
            cities: [
              { name: "Quetta", code: "UET", zip: "87300", phone: "081", tr: { en: "Quetta", ur: "کوئٹہ", ar: "كويتا", fa: "کویته", ps: "کوټه" } },
              { name: "Kuchlak", code: "PK-BA-KCK", zip: "87100", phone: "081", tr: { en: "Kuchlak", ur: "کچلاک", ar: "كوتشلاك", fa: "کچلاک", ps: "کچلاک" } }
            ]
          },
          {
            name: "Chaman District",
            code: "PK-BA-CHM",
            tr: { en: "Chaman District", ur: "ضلع چمن", ar: "منطقة تشامان", fa: "ضلع چمن", ps: "د چمن ولسوالۍ" },
            cities: [
              { name: "Chaman", code: "CHM", zip: "86000", phone: "0826", tr: { en: "Chaman", ur: "چمن", ar: "تشامان", fa: "چمن", ps: "چمن" } }
            ]
          },
          {
            name: "Gwadar District",
            code: "PK-BA-GWD",
            tr: { en: "Gwadar District", ur: "ضلع گوادر", ar: "منطقة غوادر", fa: "ضلع گوادر", ps: "ګوادر" },
            cities: [
              { name: "Gwadar", code: "GWD", zip: "91200", phone: "086", tr: { en: "Gwadar", ur: "گوادر", ar: "غوادر", fa: "گوادر", ps: "ګوادر" } },
              { name: "Pasni", code: "PK-BA-PSN", zip: "91300", phone: "086", tr: { en: "Pasni", ur: "پسنی", ar: "باسني", fa: "پسنی", ps: "پسني" } },
              { name: "Ormara", code: "PK-BA-ORM", zip: "91400", phone: "086", tr: { en: "Ormara", ur: "اورماڑہ", ar: "أورمارا", fa: "اورماره", ps: "اورماړه" } }
            ]
          },
          {
            name: "Pishin District",
            code: "PK-BA-PSH",
            tr: { en: "Pishin District", ur: "ضلع پشین", ar: "منطقة بيشين", fa: "ضلع پشین", ps: "د پښین ولسوالۍ" },
            cities: [
              { name: "Pishin", code: "PSH", zip: "86200", phone: "0826", tr: { en: "Pishin", ur: "پشین", ar: "بيشين", fa: "پشین", ps: "پښین" } },
              { name: "Hurramzai", code: "PK-BA-HRM", zip: "86230", phone: "0826", tr: { en: "Hurramzai", ur: "حرم زئی", ar: "حرم زائي", fa: "حرم‌زئی", ps: "حرم زی" } }
            ]
          }
        ]
      },
      {
        name: "Khyber Pakhtunkhwa",
        code: "PK-KP",
        tr: { en: "Khyber Pakhtunkhwa", ur: "خیبر پختونخوا", ar: "خيبر بختونخوا", fa: "خیبر پختونخواه", ps: "خيبر پښتونخوا" },
        districts: [
          {
            name: "Peshawar District",
            code: "PK-KP-PEW",
            tr: { en: "Peshawar District", ur: "ضلع پشاور", ar: "منطقة بيشاور", fa: "ضلع پیشاور", ps: "د پېښور ولسوالۍ" },
            cities: [
              { name: "Peshawar", code: "PEW", zip: "25000", phone: "091", tr: { en: "Peshawar", ur: "پشاور", ar: "بيشاور", fa: "پیشاور", ps: "پېښور" } },
              { name: "Hayatabad", code: "PK-KP-HYT", zip: "25100", phone: "091", tr: { en: "Hayatabad", ur: "حیات آباد", ar: "حياة آباد", fa: "حیات آباد", ps: "حیات اباد" } }
            ]
          },
          {
            name: "Mardan District",
            code: "PK-KP-MDN",
            tr: { en: "Mardan District", ur: "ضلع مردان", ar: "منطقة مردان", fa: "ضلع مردان", ps: "د مردان ولسوالۍ" },
            cities: [
              { name: "Mardan", code: "MDN", zip: "23200", phone: "0937", tr: { en: "Mardan", ur: "مردان", ar: "مردان", fa: "مردان", ps: "مردان" } },
              { name: "Takht-i-Bahi", code: "PK-KP-TKB", zip: "23210", phone: "0937", tr: { en: "Takht-i-Bahi", ur: "تخت بھائی", ar: "تخت بهائي", fa: "تخت باهی", ps: "تخت باهي" } }
            ]
          },
          {
            name: "Abbottabad District",
            code: "PK-KP-ATD",
            tr: { en: "Abbottabad District", ur: "ضلع ایبٹ آباد", ar: "منطقة أبوت آباد", fa: "ضلع ابوت آباد", ps: "د ایبټ اباد ولسوالۍ" },
            cities: [
              { name: "Abbottabad", code: "ATD", zip: "22010", phone: "0992", tr: { en: "Abbottabad", ur: "ایبٹ آباد", ar: "أبوت آباد", fa: "ابوت آباد", ps: "ایبټ اباد" } },
              { name: "Havelian", code: "PK-KP-HVL", zip: "22500", phone: "0992", tr: { en: "Havelian", ur: "حویلیاں", ar: "حويليان", fa: "حویلیان", ps: "حویلیان" } }
            ]
          }
        ]
      },
      {
        name: "Islamabad Capital Territory",
        code: "PK-IS",
        tr: { en: "Islamabad Capital Territory", ur: "وفاقی دارالحکومت اسلام آباد", ar: "إقليم العاصمة الاتحادية إسلام أباد", fa: "ناحیه پایتخت اسلام‌آباد", ps: "د اسلام اباد فدرالي سیمه" },
        districts: [
          {
            name: "Islamabad District",
            code: "PK-IS-ISB",
            tr: { en: "Islamabad District", ur: "ضلع اسلام آباد", ar: "منطقة إسلام أباد", fa: "ضلع اسلام آباد", ps: "د اسلام اباد ولسوالۍ" },
            cities: [
              { name: "Islamabad", code: "ISB", zip: "44000", phone: "051", tr: { en: "Islamabad", ur: "اسلام آباد", ar: "إسلام أباد", fa: "اسلام آباد", ps: "اسلام اباد" } },
              { name: "Blue Area Islamabad", code: "PK-IS-BLU", zip: "44010", phone: "051", tr: { en: "Blue Area Islamabad", ur: "بلیو ایریا اسلام آباد", ar: "المنطقة الزرقاء إسلام أباد", fa: "بلو اریا اسلام آباد", ps: "بلو اریا اسلام اباد" } }
            ]
          }
        ]
      }
    ]
  },

  // 2. AFGHANISTAN
  {
    name: "Afghanistan",
    iso2: "AF",
    iso3: "AFG",
    currency: "AFN",
    phone: "+93",
    officialEmail: "af.office@dgt.llc",
    adminEmail: "af.admin@dgt.llc",
    tr: { en: "Afghanistan", ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" },
    states: [
      {
        name: "Kabul Province",
        code: "AF-KBL",
        tr: { en: "Kabul Province", ur: "صوبہ کابل", ar: "ولاية كابول", fa: "ولایت کابل", ps: "د کابل ولایت" },
        districts: [
          {
            name: "Kabul District",
            code: "AF-KBL-CTY",
            tr: { en: "Kabul District", ur: "ضلع کابل", ar: "منطقة كابول", fa: "ناحیه کابل", ps: "د کابل ولسوالۍ" },
            cities: [
              { name: "Kabul", code: "KBL", zip: "1001", phone: "020", tr: { en: "Kabul", ur: "کابل", ar: "كابول", fa: "کابل", ps: "کابل" } },
              { name: "Shahr-e Naw", code: "AF-KBL-SHN", zip: "1002", phone: "020", tr: { en: "Shahr-e Naw", ur: "شہر نو کابل", ar: "شهر نو", fa: "شهر نو کابل", ps: "شهر نو کابل" } },
              { name: "Wazir Akbar Khan", code: "AF-KBL-WAK", zip: "1003", phone: "020", tr: { en: "Wazir Akbar Khan", ur: "وزیر اکبر خان", ar: "وزير أكبر خان", fa: "وزیر اکبر خان", ps: "وزیر اکبر خان" } }
            ]
          },
          {
            name: "Paghman District",
            code: "AF-KBL-PGM",
            tr: { en: "Paghman District", ur: "ضلع پغمان", ar: "منطقة بغمان", fa: "ناحیه پغمان", ps: "د پغمان ولسوالۍ" },
            cities: [
              { name: "Paghman", code: "AF-KBL-PGM-C", zip: "1051", phone: "020", tr: { en: "Paghman", ur: "پغمان", ar: "بغمان", fa: "پغمان", ps: "پغمان" } }
            ]
          }
        ]
      },
      {
        name: "Kandahar Province",
        code: "AF-KDH",
        tr: { en: "Kandahar Province", ur: "صوبہ قندھار", ar: "ولاية قندهار", fa: "ولایت قندهار", ps: "د کندهار ولایت" },
        districts: [
          {
            name: "Kandahar District",
            code: "AF-KDH-CTY",
            tr: { en: "Kandahar District", ur: "ضلع قندھار", ar: "منطقة قندهار", fa: "ناحیه قندهار", ps: "د کندهار ولسوالۍ" },
            cities: [
              { name: "Kandahar", code: "KDH", zip: "3801", phone: "030", tr: { en: "Kandahar", ur: "قندھار", ar: "قندهار", fa: "قندهار", ps: "کندهار" } },
              { name: "Aino Mina", code: "AF-KDH-ANM", zip: "3802", phone: "030", tr: { en: "Aino Mina", ur: "عینو مینہ", ar: "عينو مينا", fa: "عینو مینه", ps: "عینو مېنه" } }
            ]
          },
          {
            name: "Spin Boldak District",
            code: "AF-KDH-SPB",
            tr: { en: "Spin Boldak District", ur: "ضلع اسپن بولدک", ar: "منطقة سبين بولداك", fa: "ناحیه اسپین بولدک", ps: "د سپین بولدک ولسوالۍ" },
            cities: [
              { name: "Spin Boldak", code: "AF-KDH-SPB-C", zip: "3851", phone: "030", tr: { en: "Spin Boldak", ur: "اسپن بولدک", ar: "سبين بولداك", fa: "اسپین بولدک", ps: "سپین بولدک" } }
            ]
          }
        ]
      },
      {
        name: "Herat Province",
        code: "AF-HRT",
        tr: { en: "Herat Province", ur: "صوبہ ہرات", ar: "ولاية هرات", fa: "ولایت هرات", ps: "د هرات ولایت" },
        districts: [
          {
            name: "Herat District",
            code: "AF-HRT-CTY",
            tr: { en: "Herat District", ur: "ضلع ہرات", ar: "منطقة هرات", fa: "ناحیه هرات", ps: "د هرات ولسوالۍ" },
            cities: [
              { name: "Herat", code: "HRT", zip: "3001", phone: "040", tr: { en: "Herat", ur: "ہرات", ar: "هرات", fa: "هرات", ps: "هرات" } },
              { name: "Islam Qala", code: "AF-HRT-ISQ-C", zip: "3061", phone: "040", tr: { en: "Islam Qala", ur: "اسلام قلعہ", ar: "إسلام قلعة", fa: "اسلام قلعه", ps: "اسلام قلعه" } }
            ]
          }
        ]
      },
      {
        name: "Balkh Province",
        code: "AF-BAL",
        tr: { en: "Balkh Province", ur: "صوبہ بلخ", ar: "ولاية بلخ", fa: "ولایت بلخ", ps: "د بلخ ولایت" },
        districts: [
          {
            name: "Mazar-i-Sharif District",
            code: "AF-BAL-MZR",
            tr: { en: "Mazar-i-Sharif District", ur: "ضلع مزار شریف", ar: "منطقة مزار شريف", fa: "ناحیه مزار شریف", ps: "د مزار شریف ولسوالۍ" },
            cities: [
              { name: "Mazar-i-Sharif", code: "MZR", zip: "1701", phone: "050", tr: { en: "Mazar-i-Sharif", ur: "مزار شریف", ar: "مزار شريف", fa: "مزار شریف", ps: "مزار شریف" } },
              { name: "Hairatan", code: "AF-BAL-HRT", zip: "1751", phone: "050", tr: { en: "Hairatan", ur: "حیرتان", ar: "حيرتان", fa: "حیرتان", ps: "حیرتان" } }
            ]
          }
        ]
      },
      {
        name: "Nangarhar Province",
        code: "AF-NAN",
        tr: { en: "Nangarhar Province", ur: "صوبہ ننگرہار", ar: "ولاية ننگرهار", fa: "ولایت ننگرهار", ps: "د ننګرهار ولایت" },
        districts: [
          {
            name: "Jalalabad District",
            code: "AF-NAN-JAA",
            tr: { en: "Jalalabad District", ur: "ضلع جلال آباد", ar: "منطقة جلال آباد", fa: "ناحیه جلال آباد", ps: "د جلال اباد ولسوالۍ" },
            cities: [
              { name: "Jalalabad", code: "JAA", zip: "2601", phone: "060", tr: { en: "Jalalabad", ur: "جلال آباد", ar: "جلال آباد", fa: "جلال آباد", ps: "جلال اباد" } },
              { name: "Torkham", code: "AF-NAN-TRK", zip: "2651", phone: "060", tr: { en: "Torkham", ur: "تورخم", ar: "طورخم", fa: "تورخم", ps: "تورخم" } }
            ]
          }
        ]
      }
    ]
  },

  // 3. IRAN
  {
    name: "Iran",
    iso2: "IR",
    iso3: "IRN",
    currency: "IRR",
    phone: "+98",
    officialEmail: "ir.office@dgt.llc",
    adminEmail: "ir.admin@dgt.llc",
    tr: { en: "Iran", ur: "ایران", ar: "إيران", fa: "ایران", ps: "ایران" },
    states: [
      {
        name: "Tehran Province",
        code: "IR-THR",
        tr: { en: "Tehran Province", ur: "صوبہ تہران", ar: "محافظة طهران", fa: "استان تهران", ps: "د تهران ولایت" },
        districts: [
          {
            name: "Tehran District",
            code: "IR-THR-CTY",
            tr: { en: "Tehran District", ur: "ضلع تہران", ar: "منطقة طهران", fa: "شهرستان تهران", ps: "د تهران ولسوالۍ" },
            cities: [
              { name: "Tehran", code: "THR", zip: "11111", phone: "021", tr: { en: "Tehran", ur: "تہران", ar: "طهران", fa: "تهران", ps: "تهران" } },
              { name: "Tajrish", code: "IR-THR-TAJ", zip: "19888", phone: "021", tr: { en: "Tajrish", ur: "تجریش", ar: "تجريش", fa: "تجریش", ps: "تجریش" } },
              { name: "Ray", code: "IR-THR-RAY", zip: "18777", phone: "021", tr: { en: "Ray", ur: "رے", ar: "الري", fa: "ری", ps: "ری" } }
            ]
          }
        ]
      },
      {
        name: "Razavi Khorasan Province",
        code: "IR-KHD",
        tr: { en: "Razavi Khorasan Province", ur: "صوبہ خراسان رضوی", ar: "محافظة خراسان الرضوية", fa: "استان خراسان رضوی", ps: "د رضوي خراسان ولایت" },
        districts: [
          {
            name: "Mashhad District",
            code: "IR-KHD-MSH",
            tr: { en: "Mashhad District", ur: "ضلع مشہد", ar: "منطقة مشهد", fa: "شهرستان مشهد", ps: "د مشهد ولسوالۍ" },
            cities: [
              { name: "Mashhad", code: "MHD", zip: "91777", phone: "051", tr: { en: "Mashhad", ur: "مشہد", ar: "مشهد", fa: "مشهد", ps: "مشهد" } },
              { name: "Nishapur", code: "IR-KHD-NSH", zip: "93111", phone: "051", tr: { en: "Nishapur", ur: "نیشاپور", ar: "نيسابور", fa: "نیشابور", ps: "نیشاپور" } },
              { name: "Taybad", code: "IR-KHD-TYB", zip: "95911", phone: "051", tr: { en: "Taybad", ur: "تایباد", ar: "تايباد", fa: "تایباد", ps: "تایباد" } },
              { name: "Dogharoun", code: "IR-KHD-DGH", zip: "95955", phone: "051", tr: { en: "Dogharoun", ur: "دوغارون", ar: "دوغارون", fa: "دوغارون", ps: "دوغارون" } }
            ]
          }
        ]
      },
      {
        name: "Sistan and Baluchestan Province",
        code: "IR-SBN",
        tr: { en: "Sistan and Baluchestan Province", ur: "صوبہ سیستان و بلوچستان", ar: "محافظة سيستان وبلوشستان", fa: "استان سیستان و بلوچستان", ps: "د سیستان او بلوچستان ولایت" },
        districts: [
          {
            name: "Zahedan District",
            code: "IR-SBN-ZAH",
            tr: { en: "Zahedan District", ur: "ضلع زاہدان", ar: "منطقة زاهدان", fa: "شهرستان زاهدان", ps: "د زاهدان ولسوالۍ" },
            cities: [
              { name: "Zahedan", code: "ZAH", zip: "98111", phone: "054", tr: { en: "Zahedan", ur: "زاہدان", ar: "زاهدان", fa: "زاهدان", ps: "زاهدان" } },
              { name: "Mirjaveh", code: "IR-SBN-MRJ", zip: "98411", phone: "054", tr: { en: "Mirjaveh", ur: "میرجاوہ", ar: "ميرجاوة", fa: "میرجاوه", ps: "میرجاوه" } },
              { name: "Zabol", code: "IR-SBN-ZBL", zip: "98611", phone: "054", tr: { en: "Zabol", ur: "زابل", ar: "زابل", fa: "زابل", ps: "زابل" } }
            ]
          },
          {
            name: "Chabahar District",
            code: "IR-SBN-CHB",
            tr: { en: "Chabahar District", ur: "ضلع چابہار", ar: "منطقة تشابهار", fa: "شهرستان چابهار", ps: "د چابهار ولسوالۍ" },
            cities: [
              { name: "Chabahar", code: "ZBR", zip: "99711", phone: "054", tr: { en: "Chabahar", ur: "چابہار", ar: "تشابهار", fa: "چابهار", ps: "چابهار" } },
              { name: "Rask", code: "IR-SBN-RSK", zip: "99911", phone: "054", tr: { en: "Rask", ur: "راسک", ar: "راسك", fa: "راسک", ps: "راسک" } }
            ]
          }
        ]
      },
      {
        name: "Hormozgan Province",
        code: "IR-HRZ",
        tr: { en: "Hormozgan Province", ur: "صوبہ ہرمزگان", ar: "محافظة هرمزغان", fa: "استان هرمزگان", ps: "د هرمزګان ولایت" },
        districts: [
          {
            name: "Bandar Abbas District",
            code: "IR-HRZ-BND",
            tr: { en: "Bandar Abbas District", ur: "ضلع بندر عباس", ar: "منطقة بندر عباس", fa: "شهرستان بندرعباس", ps: "د بندر عباس ولسوالۍ" },
            cities: [
              { name: "Bandar Abbas", code: "BND", zip: "79111", phone: "076", tr: { en: "Bandar Abbas", ur: "بندر عباس", ar: "بندر عباس", fa: "بندرعباس", ps: "بندر عباس" } },
              { name: "Qeshm", code: "GSM", zip: "79511", phone: "076", tr: { en: "Qeshm", ur: "قشم", ar: "قشم", fa: "قشم", ps: "قشم" } },
              { name: "Kish", code: "KIH", zip: "79411", phone: "076", tr: { en: "Kish", ur: "کیش", ar: "كيش", fa: "کیش", ps: "کیش" } }
            ]
          }
        ]
      },
      {
        name: "Isfahan Province",
        code: "IR-ISF",
        tr: { en: "Isfahan Province", ur: "صوبہ اصفہان", ar: "محافظة أصفهان", fa: "استان اصفهان", ps: "د اصفهان ولایت" },
        districts: [
          {
            name: "Isfahan District",
            code: "IR-ISF-CTY",
            tr: { en: "Isfahan District", ur: "ضلع اصفہان", ar: "منطقة أصفهان", fa: "شهرستان اصفهان", ps: "د اصفهان ولسوالۍ" },
            cities: [
              { name: "Isfahan", code: "IFN", zip: "81111", phone: "031", tr: { en: "Isfahan", ur: "اصفہان", ar: "أصفهان", fa: "اصفهان", ps: "اصفهان" } },
              { name: "Kashan", code: "IR-ISF-KSH", zip: "87111", phone: "031", tr: { en: "Kashan", ur: "کاشان", ar: "كاشان", fa: "کاشان", ps: "کاشان" } }
            ]
          }
        ]
      }
    ]
  },

  // 4. UNITED ARAB EMIRATES
  {
    name: "United Arab Emirates",
    iso2: "AE",
    iso3: "ARE",
    currency: "AED",
    phone: "+971",
    officialEmail: "ae.office@dgt.llc",
    adminEmail: "ae.admin@dgt.llc",
    tr: { en: "United Arab Emirates", ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "د متحدو عربي اماراتو" },
    states: [
      {
        name: "Emirate of Dubai",
        code: "AE-DU",
        tr: { en: "Emirate of Dubai", ur: "امارت دبئی", ar: "إمارة دبي", fa: "امارت دبی", ps: "د دبی امارت" },
        districts: [
          {
            name: "Deira District",
            code: "AE-DU-DRA",
            tr: { en: "Deira District", ur: "ضلع دیرہ دبئی", ar: "منطقة ديرة دبي", fa: "ضلع دیره دبی", ps: "د دبي دیره ولسوالۍ" },
            cities: [
              { name: "Deira", code: "AE-DU-DEI", zip: "00000", phone: "04", tr: { en: "Deira", ur: "دیرہ", ar: "ديرة", fa: "دیره", ps: "دیره" } },
              { name: "Al Rigga", code: "AE-DU-RGA", zip: "00000", phone: "04", tr: { en: "Al Rigga", ur: "الرقعہ", ar: "الرقة", fa: "الرقه", ps: "الرقه" } },
              { name: "Al Garhoud", code: "AE-DU-GRH", zip: "00000", phone: "04", tr: { en: "Al Garhoud", ur: "الگرہود", ar: "القرهود", fa: "القرهود", ps: "القرهود" } },
              { name: "Al Qusais", code: "AE-DU-QSS", zip: "00000", phone: "04", tr: { en: "Al Qusais", ur: "القصيص", ar: "القصيص", fa: "القصيص", ps: "القصيص" } }
            ]
          },
          {
            name: "Bur Dubai District",
            code: "AE-DU-BDR",
            tr: { en: "Bur Dubai District", ur: "ضلع بر دبئی", ar: "منطقة بر دبي", fa: "ضلع بر دبی", ps: "د بر دبي ولسوالۍ" },
            cities: [
              { name: "Dubai", code: "DXB", zip: "00000", phone: "04", tr: { en: "Dubai", ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دبي" } },
              { name: "Bur Dubai", code: "AE-DU-BUR", zip: "00000", phone: "04", tr: { en: "Bur Dubai", ur: "بر دبئی", ar: "بر دبي", fa: "بر دبی", ps: "بر دبي" } },
              { name: "Business Bay", code: "AE-DU-BB", zip: "00000", phone: "04", tr: { en: "Business Bay", ur: "بزنس بے", ar: "الخليج التجاري", fa: "بیزنس بی", ps: "بزنس بې" } },
              { name: "Downtown Dubai", code: "AE-DU-DTD", zip: "00000", phone: "04", tr: { en: "Downtown Dubai", ur: "ڈاؤن ٹاؤن دبئی", ar: "وسط مدينة دبي", fa: "داون تاون دبی", ps: "ډاون ټاون دبي" } },
              { name: "Jumeirah", code: "AE-DU-JMR", zip: "00000", phone: "04", tr: { en: "Jumeirah", ur: "جمیرہ", ar: "جميرا", fa: "جمیرا", ps: "جمیرا" } }
            ]
          },
          {
            name: "New Dubai / South District",
            code: "AE-DU-NDS",
            tr: { en: "New Dubai District", ur: "ضلع نیو دبئی", ar: "منطقة دبي الجديدة", fa: "ضلع دبی جدید", ps: "د نوې دبي ولسوالۍ" },
            cities: [
              { name: "Dubai Marina", code: "AE-DU-DMR", zip: "00000", phone: "04", tr: { en: "Dubai Marina", ur: "دبئی مرینا", ar: "دبي مارينا", fa: "دبی مارینا", ps: "دبي مارینا" } },
              { name: "Palm Jumeirah", code: "AE-DU-PJM", zip: "00000", phone: "04", tr: { en: "Palm Jumeirah", ur: "پام جمیرہ", ar: "نخلة جميرا", fa: "پالم جمیرا", ps: "پام جمیرا" } },
              { name: "Jebel Ali", code: "AE-DU-JBL", zip: "00000", phone: "04", tr: { en: "Jebel Ali", ur: "جبل علی", ar: "جبل علي", fa: "جبل علی", ps: "جبل علي" } }
            ]
          }
        ]
      },
      {
        name: "Emirate of Abu Dhabi",
        code: "AE-AZ",
        tr: { en: "Emirate of Abu Dhabi", ur: "امارت ابوظہبی", ar: "إمارة أبوظبي", fa: "امارت ابوظبی", ps: "د ابوظبی امارت" },
        districts: [
          {
            name: "Abu Dhabi Region District",
            code: "AE-AZ-ADR",
            tr: { en: "Abu Dhabi District", ur: "ضلع ابوظہبی", ar: "منطقة أبوظبي", fa: "ضلع ابوظبی", ps: "د ابوظبي ولسوالۍ" },
            cities: [
              { name: "Abu Dhabi", code: "AUH", zip: "00000", phone: "02", tr: { en: "Abu Dhabi", ur: "ابوظہبی", ar: "أبوظبي", fa: "ابوظبی", ps: "ابوظبي" } },
              { name: "Mussafah", code: "AE-AZ-MSF", zip: "00000", phone: "02", tr: { en: "Mussafah", ur: "مصفح", ar: "مصفح", fa: "مصفح", ps: "مصفح" } },
              { name: "Al Reem Island", code: "AE-AZ-RIM", zip: "00000", phone: "02", tr: { en: "Al Reem Island", ur: "جزیرہ الریم", ar: "جزيرة الريم", fa: "جزیره الریم", ps: "د الریم ټاپو" } },
              { name: "Yas Island", code: "AE-AZ-YAS", zip: "00000", phone: "02", tr: { en: "Yas Island", ur: "جزیرہ یاس", ar: "جزيرة ياس", fa: "جزیره یاس", ps: "د یاس ټاپو" } }
            ]
          },
          {
            name: "Al Ain Region District",
            code: "AE-AZ-AAR",
            tr: { en: "Al Ain District", ur: "ضلع العین", ar: "منطقة العين", fa: "ضلع العین", ps: "د العین ولسوالۍ" },
            cities: [
              { name: "Al Ain", code: "AAN", zip: "00000", phone: "03", tr: { en: "Al Ain", ur: "العین", ar: "العين", fa: "العین", ps: "العین" } }
            ]
          }
        ]
      },
      {
        name: "Emirate of Sharjah",
        code: "AE-SH",
        tr: { en: "Emirate of Sharjah", ur: "امارت شارجہ", ar: "إمارة الشارقة", fa: "امارت شارجه", ps: "د شارجه امارت" },
        districts: [
          {
            name: "Sharjah City District",
            code: "AE-SH-SHJ",
            tr: { en: "Sharjah District", ur: "ضلع شارجہ", ar: "منطقة الشارقة", fa: "ضلع شارجه", ps: "د شارجه ولسوالۍ" },
            cities: [
              { name: "Sharjah", code: "SHJ", zip: "00000", phone: "06", tr: { en: "Sharjah", ur: "شارجہ", ar: "الشارقة", fa: "شارجه", ps: "شارجه" } },
              { name: "Al Majaz", code: "AE-SH-MJZ", zip: "00000", phone: "06", tr: { en: "Al Majaz", ur: "المجاز", ar: "المجاز", fa: "المجاز", ps: "المجاز" } },
              { name: "Khor Fakkan", code: "KFK", zip: "00000", phone: "09", tr: { en: "Khor Fakkan", ur: "خورفکان", ar: "خورفكان", fa: "خورفکان", ps: "خورفکان" } }
            ]
          }
        ]
      },
      {
        name: "Emirate of Ajman",
        code: "AE-AJ",
        tr: { en: "Emirate of Ajman", ur: "امارت عجمان", ar: "إمارة عجمان", fa: "امارت عجمان", ps: "د عجمان امارت" },
        districts: [
          {
            name: "Ajman District",
            code: "AE-AJ-AJM",
            tr: { en: "Ajman District", ur: "ضلع عجمان", ar: "منطقة عجمان", fa: "ضلع عجمان", ps: "د عجمان ولسوالۍ" },
            cities: [
              { name: "Ajman", code: "AJM", zip: "00000", phone: "06", tr: { en: "Ajman", ur: "عجمان", ar: "عجمان", fa: "عجمان", ps: "عجمان" } },
              { name: "Al Nuaimia", code: "AE-AJ-NMA", zip: "00000", phone: "06", tr: { en: "Al Nuaimia", ur: "النعيمية", ar: "النعيمية", fa: "النعیمیه", ps: "النعیمیه" } }
            ]
          }
        ]
      },
      {
        name: "Emirate of Ras Al Khaimah",
        code: "AE-RK",
        tr: { en: "Emirate of Ras Al Khaimah", ur: "امارت راس الخیمہ", ar: "إمارة رأس الخيمة", fa: "امارت رأس الخیمه", ps: "د رأس الخیمه امارت" },
        districts: [
          {
            name: "Ras Al Khaimah District",
            code: "AE-RK-RAK",
            tr: { en: "Ras Al Khaimah District", ur: "ضلع راس الخیمہ", ar: "منطقة رأس الخيمة", fa: "ضلع رأس الخیمه", ps: "د رأس الخیمه ولسوالۍ" },
            cities: [
              { name: "Ras Al Khaimah", code: "RKT", zip: "00000", phone: "07", tr: { en: "Ras Al Khaimah", ur: "راس الخیمہ", ar: "رأس الخيمة", fa: "رأس الخیمه", ps: "رأس الخیمه" } }
            ]
          }
        ]
      },
      {
        name: "Emirate of Fujairah",
        code: "AE-FU",
        tr: { en: "Emirate of Fujairah", ur: "امارت فجیرہ", ar: "إمارة الفجيرة", fa: "امارت فجیره", ps: "د فجیره امارت" },
        districts: [
          {
            name: "Fujairah District",
            code: "AE-FU-FJR",
            tr: { en: "Fujairah District", ur: "ضلع فجیرہ", ar: "منطقة الفجيرة", fa: "ضلع فجیره", ps: "د فجیره ولسوالۍ" },
            cities: [
              { name: "Fujairah", code: "FJR", zip: "00000", phone: "09", tr: { en: "Fujairah", ur: "فجیرہ", ar: "الفجيرة", fa: "فجیره", ps: "فجیره" } }
            ]
          }
        ]
      },
      {
        name: "Emirate of Umm Al Quwain",
        code: "AE-UQ",
        tr: { en: "Emirate of Umm Al Quwain", ur: "امارت ام القیوین", ar: "إمارة أم القيوين", fa: "امارت ام‌القیوین", ps: "د ام القیوین امارت" },
        districts: [
          {
            name: "Umm Al Quwain District",
            code: "AE-UQ-UAQ",
            tr: { en: "Umm Al Quwain District", ur: "ضلع ام القیوین", ar: "منطقة أم القيوين", fa: "ضلع ام‌القیوین", ps: "د ام القیوین ولسوالۍ" },
            cities: [
              { name: "Umm Al Quwain", code: "UAQ", zip: "00000", phone: "06", tr: { en: "Umm Al Quwain", ur: "ام القیوین", ar: "أم القيوين", fa: "ام‌القیوین", ps: "ام القیوین" } }
            ]
          }
        ]
      }
    ]
  },

  // 5. INDIA
  {
    name: "India",
    iso2: "IN",
    iso3: "IND",
    currency: "INR",
    phone: "+91",
    officialEmail: "in.office@dgt.llc",
    adminEmail: "in.admin@dgt.llc",
    tr: { en: "India", ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" },
    states: [
      {
        name: "Maharashtra",
        code: "IN-MH",
        tr: { en: "Maharashtra", ur: "مہاراشٹر", ar: "ماهاراشترا", fa: "ماهاراشترا", ps: "مهاراشترا" },
        districts: [
          {
            name: "Mumbai District",
            code: "IN-MH-BOM",
            tr: { en: "Mumbai District", ur: "ضلع ممبئی", ar: "منطقة بومباي", fa: "ضلع بمبئی", ps: "د بمبۍ ولسوالۍ" },
            cities: [
              { name: "Mumbai", code: "BOM", zip: "400001", phone: "022", tr: { en: "Mumbai", ur: "ممبئی", ar: "بومباي", fa: "بمبئی", ps: "بمبئی" } },
              { name: "Navi Mumbai", code: "IN-MH-NVM", zip: "400703", phone: "022", tr: { en: "Navi Mumbai", ur: "نوی ممبئی", ar: "نافي مومباي", fa: "ناوی بمبئی", ps: "نوی بمبۍ" } },
              { name: "Thane", code: "IN-MH-THN", zip: "400601", phone: "022", tr: { en: "Thane", ur: "تھانے", ar: "ثين", fa: "تانه", ps: "تانه" } }
            ]
          },
          {
            name: "Pune District",
            code: "IN-MH-PNE",
            tr: { en: "Pune District", ur: "ضلع پونے", ar: "منطقة بوني", fa: "ضلع پونه", ps: "د پونې ولسوالۍ" },
            cities: [
              { name: "Pune", code: "PNQ", zip: "411001", phone: "020", tr: { en: "Pune", ur: "پونے", ar: "بوني", fa: "پونه", ps: "پونه" } }
            ]
          }
        ]
      },
      {
        name: "Delhi National Capital Territory",
        code: "IN-DL",
        tr: { en: "Delhi", ur: "دہلی", ar: "دلهي", fa: "دهلی", ps: "ډیلي" },
        districts: [
          {
            name: "New Delhi District",
            code: "IN-DL-NDL",
            tr: { en: "New Delhi District", ur: "ضلع نئی دہلی", ar: "منطقة نيودلهي", fa: "ضلع دهلی نو", ps: "د نوي ډیلي ولسوالۍ" },
            cities: [
              { name: "New Delhi", code: "DEL", zip: "110001", phone: "011", tr: { en: "New Delhi", ur: "نئی دہلی", ar: "نيودلهي", fa: "دهلی نو", ps: "نوی ډیلی" } },
              { name: "Connaught Place", code: "IN-DL-CP", zip: "110001", phone: "011", tr: { en: "Connaught Place", ur: "کناٹ پلیس", ar: "كونوت بليس", fa: "کانات پلیس", ps: "کناټ پلیس" } }
            ]
          }
        ]
      },
      {
        name: "Gujarat",
        code: "IN-GJ",
        tr: { en: "Gujarat", ur: "گجرات", ar: "غوجارات", fa: "گجرات", ps: "ګجرات" },
        districts: [
          {
            name: "Ahmedabad District",
            code: "IN-GJ-AMD",
            tr: { en: "Ahmedabad District", ur: "ضلع احمد آباد", ar: "منطقة أحمد آباد", fa: "ضلع احمدآباد", ps: "د احمد اباد ولسوالۍ" },
            cities: [
              { name: "Ahmedabad", code: "AMD", zip: "380001", phone: "079", tr: { en: "Ahmedabad", ur: "احمد آباد", ar: "أحمد آباد", fa: "احمدآباد", ps: "احمد اباد" } },
              { name: "Gandhinagar", code: "IN-GJ-GDN", zip: "382010", phone: "079", tr: { en: "Gandhinagar", ur: "گاندھی نگر", ar: "غانديناغار", fa: "گاندی‌نگر", ps: "ګاندي نگر" } }
            ]
          },
          {
            name: "Surat District",
            code: "IN-GJ-SRT",
            tr: { en: "Surat District", ur: "ضلع سورت", ar: "منطقة سورات", fa: "ضلع سورت", ps: "د سورت ولسوالۍ" },
            cities: [
              { name: "Surat", code: "STV", zip: "395003", phone: "0261", tr: { en: "Surat", ur: "سورت", ar: "سورات", fa: "سورت", ps: "سورت" } },
              { name: "Mundra", code: "IN-GJ-MUN", zip: "370421", phone: "02838", tr: { en: "Mundra", ur: "مندرا", ar: "موندرا", fa: "موندرا", ps: "مونډرا" } }
            ]
          }
        ]
      },
      {
        name: "Karnataka",
        code: "IN-KA",
        tr: { en: "Karnataka", ur: "کرناٹک", ar: "كارناتاكا", fa: "کارناتاکا", ps: "کارناتاکا" },
        districts: [
          {
            name: "Bengaluru District",
            code: "IN-KA-BLR",
            tr: { en: "Bengaluru District", ur: "ضلع بنگلور", ar: "منطقة بنغالور", fa: "ضلع بنگلور", ps: "د بنګلور ولسوالۍ" },
            cities: [
              { name: "Bengaluru", code: "BLR", zip: "560001", phone: "080", tr: { en: "Bengaluru", ur: "بنگلور", ar: "بنغالور", fa: "بنگلور", ps: "بنګلور" } }
            ]
          }
        ]
      }
    ]
  }
];

async function upsertTranslation(recordTable, recordId, fieldName, originalText, tr) {
  const langTexts = {
    en: tr.en || originalText,
    ur: tr.ur || originalText,
    ar: tr.ar || originalText,
    fa: tr.fa || originalText,
    ps: tr.ps || originalText
  };

  const [existing] = await sql`
    SELECT id FROM public.record_translations
    WHERE record_table = ${recordTable} AND record_id = ${recordId} AND field_name = ${fieldName}
    LIMIT 1
  `;

  if (existing) {
    await sql`
      UPDATE public.record_translations
      SET original_text = ${originalText},
          english_text = ${langTexts.en},
          urdu_text = ${langTexts.ur},
          arabic_text = ${langTexts.ar},
          persian_text = ${langTexts.fa},
          pashto_text = ${langTexts.ps},
          language_texts = ${sql.json(langTexts)},
          translation_status = 'approved',
          source = 'manual',
          deleted_at = NULL,
          updated_at = NOW()
      WHERE id = ${existing.id}
    `;
  } else {
    await sql`
      INSERT INTO public.record_translations (
        record_table, record_id, field_name, original_text, original_language_code,
        english_text, urdu_text, arabic_text, persian_text, pashto_text,
        language_texts, source, translation_status, updated_at
      )
      VALUES (
        ${recordTable}, ${recordId}, ${fieldName}, ${originalText}, 'en',
        ${langTexts.en}, ${langTexts.ur}, ${langTexts.ar}, ${langTexts.fa}, ${langTexts.ps},
        ${sql.json(langTexts)}, 'manual', 'approved', NOW()
      )
    `;
  }

  // Also sync to per-language tables if they exist
  try {
    await sql`
      INSERT INTO public.translations_english (record_table, record_id, field_name, text, original_text, original_language_code, source, translation_status, translated_by_engine, updated_at)
      VALUES (${recordTable}, ${recordId}, ${fieldName}, ${langTexts.en}, ${originalText}, 'en', 'manual', 'approved', 'manual', NOW())
      ON CONFLICT (record_table, record_id, field_name) DO UPDATE SET text = EXCLUDED.text, updated_at = NOW()
    `;
  } catch {}

  try {
    await sql`
      INSERT INTO public.translations_urdu (record_table, record_id, field_name, text, updated_at)
      VALUES (${recordTable}, ${recordId}, ${fieldName}, ${langTexts.ur}, NOW())
      ON CONFLICT (record_table, record_id, field_name) DO UPDATE SET text = EXCLUDED.text, updated_at = NOW()
    `;
  } catch {}

  try {
    await sql`
      INSERT INTO public.translations_arabic (record_table, record_id, field_name, text, updated_at)
      VALUES (${recordTable}, ${recordId}, ${fieldName}, ${langTexts.ar}, NOW())
      ON CONFLICT (record_table, record_id, field_name) DO UPDATE SET text = EXCLUDED.text, updated_at = NOW()
    `;
  } catch {}

  try {
    await sql`
      INSERT INTO public.translations_persian (record_table, record_id, field_name, text, updated_at)
      VALUES (${recordTable}, ${recordId}, ${fieldName}, ${langTexts.fa}, NOW())
      ON CONFLICT (record_table, record_id, field_name) DO UPDATE SET text = EXCLUDED.text, updated_at = NOW()
    `;
  } catch {}

  try {
    await sql`
      INSERT INTO public.translations_pashto (record_table, record_id, field_name, text, updated_at)
      VALUES (${recordTable}, ${recordId}, ${fieldName}, ${langTexts.ps}, NOW())
      ON CONFLICT (record_table, record_id, field_name) DO UPDATE SET text = EXCLUDED.text, updated_at = NOW()
    `;
  } catch {}
}

async function populate() {
  console.log("=================================================================");
  console.log("   SEEDING COMPLETE 5-COUNTRY LOCATION HIERARCHY & TRANSLATIONS  ");
  console.log("=================================================================\n");

  let countryCount = 0;
  let stateCount = 0;
  let districtCount = 0;
  let cityCount = 0;
  let translationCount = 0;

  for (const cData of LOCATIONS_DATA) {
    let countryId = null;
    const [cMatch] = await sql`
      SELECT id FROM public.countries 
      WHERE deleted_at IS NULL AND (LOWER(name) = LOWER(${cData.name}) OR iso2 = ${cData.iso2})
      LIMIT 1
    `;

    if (cMatch?.id) {
      countryId = cMatch.id;
      await sql`
        UPDATE public.countries
        SET name = ${cData.name}, iso2 = ${cData.iso2}, iso3 = ${cData.iso3},
            currency_code = ${cData.currency}, phone_code = ${cData.phone},
            official_email = ${cData.officialEmail}, admin_email = ${cData.adminEmail},
            is_active = true, updated_at = NOW()
        WHERE id = ${countryId}
      `;
    } else {
      const [cIns] = await sql`
        INSERT INTO public.countries (name, iso2, iso3, currency_code, reporting_currency, is_active, official_email, admin_email, phone_code)
        VALUES (${cData.name}, ${cData.iso2}, ${cData.iso3}, ${cData.currency}, 'USD', true, ${cData.officialEmail}, ${cData.adminEmail}, ${cData.phone})
        RETURNING id
      `;
      countryId = cIns.id;
    }
    countryCount++;

    await upsertTranslation("countries", countryId, "name", cData.name, cData.tr);
    translationCount++;

    console.log("  🌍 Country: " + cData.name + " (" + cData.iso2 + ") -> ID: " + countryId);

    // States / Provinces
    for (const sData of cData.states) {
      let stateId = null;
      const [sMatch] = await sql`
        SELECT id FROM public.states_provinces
        WHERE country_id = ${countryId} AND deleted_at IS NULL
          AND (LOWER(name) = LOWER(${sData.name}) OR code = ${sData.code})
        LIMIT 1
      `;

      if (sMatch?.id) {
        stateId = sMatch.id;
        await sql`
          UPDATE public.states_provinces
          SET name = ${sData.name}, code = ${sData.code}, is_active = true, updated_at = NOW()
          WHERE id = ${stateId}
        `;
      } else {
        const [sIns] = await sql`
          INSERT INTO public.states_provinces (country_id, name, code, is_active)
          VALUES (${countryId}, ${sData.name}, ${sData.code}, true)
          RETURNING id
        `;
        stateId = sIns.id;
      }
      stateCount++;

      await upsertTranslation("states_provinces", stateId, "name", sData.name, sData.tr);
      translationCount++;

      // Districts
      for (const dData of sData.districts) {
        let districtId = null;
        const [dMatch] = await sql`
          SELECT id FROM public.districts
          WHERE state_province_id = ${stateId} AND deleted_at IS NULL
            AND (LOWER(name) = LOWER(${dData.name}) OR code = ${dData.code})
          LIMIT 1
        `;

        if (dMatch?.id) {
          districtId = dMatch.id;
          await sql`
            UPDATE public.districts
            SET name = ${dData.name}, code = ${dData.code}, country_id = ${countryId}, is_active = true, updated_at = NOW()
            WHERE id = ${districtId}
          `;
        } else {
          const [dIns] = await sql`
            INSERT INTO public.districts (country_id, state_province_id, name, code, is_active)
            VALUES (${countryId}, ${stateId}, ${dData.name}, ${dData.code}, true)
            RETURNING id
          `;
          districtId = dIns.id;
        }
        districtCount++;

        await upsertTranslation("districts", districtId, "name", dData.name, dData.tr);
        translationCount++;

        // Cities
        for (const cityData of dData.cities) {
          let cityId = null;
          const [cityMatch] = await sql`
            SELECT id FROM public.cities
            WHERE country_id = ${countryId} AND deleted_at IS NULL
              AND (LOWER(name) = LOWER(${cityData.name}) OR code = ${cityData.code})
            LIMIT 1
          `;

          if (cityMatch?.id) {
            cityId = cityMatch.id;
            await sql`
              UPDATE public.cities
              SET name = ${cityData.name}, code = ${cityData.code}, state_province_id = ${stateId},
                  district_id = ${districtId}, zip_code = ${cityData.zip}, phone_area_code = ${cityData.phone},
                  is_active = true, updated_at = NOW()
              WHERE id = ${cityId}
            `;
          } else {
            const [cityIns] = await sql`
              INSERT INTO public.cities (country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active)
              VALUES (${countryId}, ${stateId}, ${districtId}, ${cityData.name}, ${cityData.code}, ${cityData.zip}, ${cityData.phone}, true)
              RETURNING id
            `;
            cityId = cityIns.id;
          }
          cityCount++;

          await upsertTranslation("cities", cityId, "name", cityData.name, cityData.tr);
          translationCount++;
        }
      }
    }
  }

  // System dictionary entries for location keywords
  const locationTerms = [
    { en: "Country", ur: "ملک", ar: "دولة", fa: "کشور", ps: "هیواد" },
    { en: "State", ur: "صوبہ", ar: "ولاية", fa: "استان", ps: "ولایت" },
    { en: "Province", ur: "صوبہ", ar: "محافظة", fa: "استان", ps: "ولایت" },
    { en: "District", ur: "ضلع", ar: "منطقة", fa: "شهرستان", ps: "ولسوالۍ" },
    { en: "City", ur: "شہر", ar: "مدينة", fa: "شهر", ps: "ښار" },
    { en: "Location", ur: "مقام / پتہ", ar: "الموقع", fa: "موقعیت", ps: "ځای" },
    { en: "Location Management", ur: "انتظام مقامات", ar: "إدارة المواقع", fa: "مدیریت موقعیت‌ها", ps: "د ځایونو مدیریت" },
    { en: "Postal Code", ur: "پوسٹل کوڈ", ar: "الرمز البريدي", fa: "کد پستی", ps: "پوسټل کوډ" },
    { en: "Main Branch", ur: "مین برانچ", ar: "الفرع الرئيسي", fa: "شعبه اصلی", ps: "اصلي څانګه" },
    { en: "City Branch", ur: "سٹی برانچ", ar: "فرع المدينة", fa: "شعبه شهری", ps: "د ښار څانګه" }
  ];

  for (const lt of locationTerms) {
    const fakeId = "00000000-0000-0000-0000-" + Buffer.from(lt.en).toString("hex").padEnd(12, "0").slice(0, 12);
    const [exDict] = await sql`
      SELECT id FROM public.record_translations
      WHERE record_table = 'system_dictionary' AND record_id = ${fakeId}::uuid AND field_name = 'term'
      LIMIT 1
    `;

    if (exDict) {
      await sql`
        UPDATE public.record_translations
        SET original_text = ${lt.en}, english_text = ${lt.en}, urdu_text = ${lt.ur}, arabic_text = ${lt.ar},
            persian_text = ${lt.fa}, pashto_text = ${lt.ps}, language_texts = ${sql.json(lt)},
            translation_status = 'approved', source = 'manual', deleted_at = NULL, updated_at = NOW()
        WHERE id = ${exDict.id}
      `;
    } else {
      await sql`
        INSERT INTO public.record_translations (
          record_table, record_id, field_name, original_text, original_language_code,
          english_text, urdu_text, arabic_text, persian_text, pashto_text,
          language_texts, source, translation_status, updated_at
        )
        VALUES (
          'system_dictionary', ${fakeId}::uuid, 'term', ${lt.en}, 'en',
          ${lt.en}, ${lt.ur}, ${lt.ar}, ${lt.fa}, ${lt.ps},
          ${sql.json(lt)}, 'manual', 'approved', NOW()
        )
      `;
    }
  }

  console.log("\n=================================================================");
  console.log("       VPS PRODUCTION LOCATION SEEDING SUMMARY                   ");
  console.log("=================================================================");

  const auditSummary = {
    "Total Countries": (await sql`SELECT COUNT(*)::int as count FROM public.countries WHERE deleted_at IS NULL`)[0].count,
    "Total States / Provinces": (await sql`SELECT COUNT(*)::int as count FROM public.states_provinces WHERE deleted_at IS NULL`)[0].count,
    "Total Districts": (await sql`SELECT COUNT(*)::int as count FROM public.districts WHERE deleted_at IS NULL`)[0].count,
    "Total Cities": (await sql`SELECT COUNT(*)::int as count FROM public.cities WHERE deleted_at IS NULL`)[0].count,
    "Total Record Translations": (await sql`SELECT COUNT(*)::int as count FROM public.record_translations WHERE deleted_at IS NULL`)[0].count,
    "Urdu Translations": (await sql`SELECT COUNT(*)::int as count FROM public.record_translations WHERE urdu_text IS NOT NULL AND urdu_text <> ''`)[0].count,
    "Arabic Translations": (await sql`SELECT COUNT(*)::int as count FROM public.record_translations WHERE arabic_text IS NOT NULL AND arabic_text <> ''`)[0].count,
    "Persian Translations": (await sql`SELECT COUNT(*)::int as count FROM public.record_translations WHERE persian_text IS NOT NULL AND persian_text <> ''`)[0].count,
    "Pashto Translations": (await sql`SELECT COUNT(*)::int as count FROM public.record_translations WHERE pashto_text IS NOT NULL AND pashto_text <> ''`)[0].count
  };

  console.table(auditSummary);

  const countriesList = await sql`SELECT id, name, iso2, currency_code, phone_code FROM public.countries WHERE deleted_at IS NULL ORDER BY name`;
  console.log("\n--> 5 VERIFIED ACTIVE COUNTRIES (" + countriesList.length + "):");
  for (const c of countriesList) {
    const states = await sql`SELECT COUNT(*)::int as count FROM public.states_provinces WHERE country_id = ${c.id} AND deleted_at IS NULL`;
    const cities = await sql`SELECT COUNT(*)::int as count FROM public.cities WHERE country_id = ${c.id} AND deleted_at IS NULL`;
    console.log("  - " + c.name + " (" + c.iso2 + ") | States: " + states[0].count + " | Cities: " + cities[0].count + " | Currency: " + c.currency_code + " | Phone: " + c.phone_code);
  }

  await sql.end();
  console.log("\n>>> LOCATION MANAGEMENT SEEDING & 5-LANGUAGE TRANSLATIONS COMPLETED ON VPS PRODUCTION! <<<\n");
}

populate().catch(e => {
  console.error("Population Fatal Error:", e);
  process.exit(1);
});
