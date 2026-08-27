import postgres from "postgres";
import fs from "fs";

function loadEnv() {
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }
}
loadEnv();

const localDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";

// Complete dataset of Countries & Ports/Borders/Airports with 5-Language Translations
const COUNTRIES_DATA = [
  { name: "Afghanistan", iso2: "AF", iso3: "AFG", currency: "AFN", translations: { ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" } },
  { name: "China", iso2: "CN", iso3: "CHN", currency: "CNY", translations: { ur: "چین", ar: "الصين", fa: "چین", ps: "چین" } },
  { name: "India", iso2: "IN", iso3: "IND", currency: "INR", translations: { ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" } },
  { name: "Iran", iso2: "IR", iso3: "IRN", currency: "IRR", translations: { ur: "ایران", ar: "إيران", fa: "ایران", ps: "ایران" } },
  { name: "Kazakhstan", iso2: "KZ", iso3: "KAZ", currency: "KZT", translations: { ur: "قازقستان", ar: "كازاخستان", fa: "قزاقستان", ps: "قزاقستان" } },
  { name: "Pakistan", iso2: "PK", iso3: "PAK", currency: "PKR", translations: { ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" } },
  { name: "Tajikistan", iso2: "TJ", iso3: "TJK", currency: "TJS", translations: { ur: "تاجکستان", ar: "طاجيكستان", fa: "تاجیکستان", ps: "تاجیکستان" } },
  { name: "Turkmenistan", iso2: "TM", iso3: "TKM", currency: "TMT", translations: { ur: "ترکمانستان", ar: "تركمانستان", fa: "ترکمنستان", ps: "ترکمنستان" } },
  { name: "Turkiye", iso2: "TR", iso3: "TUR", currency: "TRY", translations: { ur: "ترکیہ", ar: "تركيا", fa: "ترکیه", ps: "ترکیه" } },
  { name: "United Arab Emirates", iso2: "AE", iso3: "ARE", currency: "AED", translations: { ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" } },
  { name: "Uzbekistan", iso2: "UZ", iso3: "UZB", currency: "UZS", translations: { ur: "ازبکستان", ar: "أوزبكستان", fa: "ازبکستان", ps: "ازبکستان" } },
  { name: "Russia", iso2: "RU", iso3: "RUS", currency: "RUB", translations: { ur: "روس", ar: "روسيا", fa: "روسیه", ps: "روسیه" } }
];

const PORTS_DATA = [
  // --- CHINA ---
  { country: "China", code: "CN-SHA", name: "Shanghai Port", type: "sea", trans: { ur: "شنگھائی پورٹ", ar: "ميناء شنغهاي", fa: "بندر شانگهای", ps: "د شانګهای بندر" } },
  { country: "China", code: "CN-NGB", name: "Ningbo-Zhoushan Port", type: "sea", trans: { ur: "ننگبو زوشان پورٹ", ar: "ميناء نينغبو", fa: "بندر نینگبو", ps: "د نینګبو بندر" } },
  { country: "China", code: "CN-SZX", name: "Shenzhen Port", type: "sea", trans: { ur: "شینزین پورٹ", ar: "ميناء شنتشن", fa: "بندر شنژن", ps: "د شینزین بندر" } },
  { country: "China", code: "CN-QDG", name: "Qingdao Port", type: "sea", trans: { ur: "چنگڈاؤ پورٹ", ar: "ميناء تشينغداو", fa: "بندر چینگ دائو", ps: "د چینګداو بندر" } },
  { country: "China", code: "CN-TXG", name: "Tianjin Port", type: "sea", trans: { ur: "تیانجن پورٹ", ar: "ميناء تيانجين", fa: "بندر تیانجین", ps: "د تیانجین بندر" } },
  { country: "China", code: "CN-DLC", name: "Dalian Port", type: "sea", trans: { ur: "ڈالیان پورٹ", ar: "ميناء داليان", fa: "بندر دالیان", ps: "د دالیان بندر" } },
  { country: "China", code: "CN-XMN", name: "Xiamen Port", type: "sea", trans: { ur: "شیامین پورٹ", ar: "ميناء شيامن", fa: "بندر شیامن", ps: "د شیامن بندر" } },
  { country: "China", code: "CN-CAN", name: "Guangzhou Port (Nansha)", type: "sea", trans: { ur: "گوانگژو پورٹ (نانشا)", ar: "ميناء قوانغتشو", fa: "بندر گوانگژو", ps: "د ګوانګژو بندر" } },
  { country: "China", code: "CN-KHO", name: "Khorgos Land Border (CN-KZ)", type: "road", trans: { ur: "خورگوس زمینی بارڈر (چین-قازق)", ar: "معبر خورغوس البري", fa: "مرز زمینی خورگوس", ps: "د خورګوس ځمکنی سرحد" } },
  { country: "China", code: "CN-ALA", name: "Alashankou / Dostyk Border", type: "road", trans: { ur: "الاشانکو / دوستیک بارڈر", ar: "معبر الاشأنكو الحدودي", fa: "مرز آلاشانکو / دوستیک", ps: "د الاشانکو سرحد" } },
  { country: "China", code: "CN-KHU", name: "Khunjerab Pass Border (CN-PK)", type: "road", trans: { ur: "خنجراب پاس بارڈر (چین-پاکستان)", ar: "معبر خنجراب الحدودي", fa: "گذرگاه خنجراب", ps: "د خنجراب لار سرحد" } },
  { country: "China", code: "CN-IRK", name: "Irkeshtam Border (CN-KG)", type: "road", trans: { ur: "ارکشتام بارڈر", ar: "معبر إركشتام الحدودي", fa: "مرز ایرکشتام", ps: "د ارکشتام سرحد" } },
  { country: "China", code: "CN-PVG", name: "Shanghai Pudong Int'l Airport", type: "air", trans: { ur: "شنگھائی پودونگ بین الاقوامی ہوائی اڈہ", ar: "مطار شانغهاي بودونغ الدولي", fa: "فرودگاه بین‌المللی شانگهای پودنگ", ps: "د شانګهای پودونګ هوایی ډګر" } },
  { country: "China", code: "CN-PEK", name: "Beijing Capital Int'l Airport", type: "air", trans: { ur: "بیجنگ کیپٹل بین الاقوامی ہوائی اڈہ", ar: "مطار بكين العاصمة الدولي", fa: "فرودگاه بین‌المللی پکن", ps: "د بیجینګ نړیوال هوایی ډګر" } },
  { country: "China", code: "CN-CAN-AIR", name: "Guangzhou Baiyun Airport", type: "air", trans: { ur: "گوانگژو بایون ہوائی اڈہ", ar: "مطار قوانغتشو بايون الدولي", fa: "فرودگاه بایون گوانگژو", ps: "د ګوانګژو بایون هوایی ډګر" } },

  // --- UNITED ARAB EMIRATES ---
  { country: "United Arab Emirates", code: "AE-JEA", name: "Jebel Ali Port (Dubai)", type: "sea", trans: { ur: "جبل علی پورٹ (دبئی)", ar: "ميناء جبل علي (دبي)", fa: "بندر جبل علی (دبی)", ps: "د جبل علی بندر (دوبی)" } },
  { country: "United Arab Emirates", code: "AE-KHL", name: "Khalifa Port (Abu Dhabi)", type: "sea", trans: { ur: "خلیفہ پورٹ (ابوظہبی)", ar: "ميناء خليفة (أبوظبي)", fa: "بندر خلیفه (ابوظبی)", ps: "د خلیفه بندر (ابوظبی)" } },
  { country: "United Arab Emirates", code: "AE-SHJ", name: "Port Khalid (Sharjah)", type: "sea", trans: { ur: "پورٹ خالد (شارجہ)", ar: "ميناء خالد (الشارقة)", fa: "بندر خالد (شارجه)", ps: "د خالد بندر (شارجه)" } },
  { country: "United Arab Emirates", code: "AE-KLF", name: "Khor Fakkan Port", type: "sea", trans: { ur: "خور فکان پورٹ", ar: "ميناء خورفكان", fa: "بندر خور فکان", ps: "د خور فکان بندر" } },
  { country: "United Arab Emirates", code: "AE-FJR", name: "Port of Fujairah", type: "sea", trans: { ur: "فجیرہ پورٹ", ar: "ميناء الفجيرة", fa: "بندر فجیره", ps: "د فجیره بندر" } },
  { country: "United Arab Emirates", code: "AE-HAM", name: "Hamriyah Port (Sharjah)", type: "sea", trans: { ur: "حمریہ پورٹ (شارجہ)", ar: "ميناء الحمرية (الشارقة)", fa: "بندر حمریه (شارجه)", ps: "د حمریه بندر (شارجه)" } },
  { country: "United Arab Emirates", code: "AE-RKT-SEA", name: "Mina Saqr (Ras Al Khaimah)", type: "sea", trans: { ur: "مینا صقر (راس الخیمہ)", ar: "ميناء صقر (رأس الخيمة)", fa: "بندر صقر (رأس‌الخیمه)", ps: "د صقر بندر (راس الخیمه)" } },
  { country: "United Arab Emirates", code: "AE-GHU", name: "Ghuwaifat Border (UAE-Saudi)", type: "road", trans: { ur: "غویفات بارڈر (متحدہ عرب امارات-سعودی)", ar: "منفذ الغويفات الحدودي (الإمارات-السعودية)", fa: "مرز غویفات (امارات-عربستان)", ps: "د غویفات سرحد (امارات-سعودی)" } },
  { country: "United Arab Emirates", code: "AE-HAT", name: "Hatta Border (UAE-Oman)", type: "road", trans: { ur: "حتا بارڈر (متحدہ عرب امارات-عمان)", ar: "منفذ حتا الحدودي (الإمارات-عمان)", fa: "مرز حتا (امارات-عمان)", ps: "د حتا سرحد (امارات-عمان)" } },
  { country: "United Arab Emirates", code: "AE-MEZ", name: "Mezyad / Khatm Al Shiklah Border (Al Ain)", type: "road", trans: { ur: "مزیاد / خطم الشكلہ بارڈر (العین)", ar: "منفذ مزيد / خطم الشكلة الحدودي (العين)", fa: "مرز مزید / ختم الشکله (العین)", ps: "د مزید / خطم الشکله سرحد (العین)" } },
  { country: "United Arab Emirates", code: "AE-DXB", name: "Dubai International Airport (DXB)", type: "air", trans: { ur: "دبئی بین الاقوامی ہوائی اڈہ", ar: "مطار دبي الدولي", fa: "فرودگاه بین‌المللی دبی", ps: "د دوبی نړیوال هوایی ډګر" } },
  { country: "United Arab Emirates", code: "AE-DWC", name: "Al Maktoum Int'l / Dubai World Central", type: "air", trans: { ur: "المکتوم بین الاقوامی ہوائی اڈہ (DWC)", ar: "مطار آل مكتوم الدولي (دبي ورلد سنترال)", fa: "فرودگاه بین‌المللی آل مکتوم", ps: "د آل مکتوم نړیوال هوایی ډګر" } },
  { country: "United Arab Emirates", code: "AE-AUH", name: "Abu Dhabi International Airport (AUH)", type: "air", trans: { ur: "ابوظہبی بین الاقوامی ہوائی اڈہ", ar: "مطار أبوظبي الدولي", fa: "فرودگاه بین‌المللی ابوظبی", ps: "د ابوظبی نړیوال هوایی ډګر" } },
  { country: "United Arab Emirates", code: "AE-SHJ-AIR", name: "Sharjah International Airport (SHJ)", type: "air", trans: { ur: "شارجہ بین الاقوامی ہوائی اڈہ", ar: "مطار الشارقة الدولي", fa: "فرودگاه بین‌المللی شارجه", ps: "د شارجه نړیوال هوایی ډګر" } },

  // --- PAKISTAN ---
  { country: "Pakistan", code: "PK-KHI", name: "Karachi Port (KPT)", type: "sea", trans: { ur: "کراچی پورٹ ٹرسٹ (کے پی ٹی)", ar: "ميناء كراتشي", fa: "بندر کراچی", ps: "د کراچۍ بندر" } },
  { country: "Pakistan", code: "PK-BQM", name: "Port Muhammad Bin Qasim", type: "sea", trans: { ur: "پورٹ محمد بن قاسم", ar: "ميناء قاسم", fa: "بندر قاسم", ps: "د قاسم بندر" } },
  { country: "Pakistan", code: "PK-GWD", name: "Gwadar Deep Sea Port", type: "sea", trans: { ur: "گوادر ڈیپ سی پورٹ", ar: "ميناء جوادر", fa: "بندر گوادر", ps: "د ګوادر بندر" } },
  { country: "Pakistan", code: "PK-TRK", name: "Torkham Border Terminal (PK-AF)", type: "road", trans: { ur: "طورخم بارڈر ٹرمینل (پاکستان-افغانستان)", ar: "معبر تورخام الحدودي", fa: "پایانه مرزی تورخم", ps: "د تورخم سرحدي ترمینل" } },
  { country: "Pakistan", code: "PK-CHM", name: "Chaman / Spin Boldak Border (PK-AF)", type: "road", trans: { ur: "چمن / سپین بولدک بارڈر (پاکستان-افغانستان)", ar: "معبر چمن / سبين بولداك الحدودي", fa: "مرز چمن / اسپین بولدک", ps: "د چمن / سپین بولدک سرحد" } },
  { country: "Pakistan", code: "PK-GHK", name: "Ghulam Khan Border (North Waziristan)", type: "road", trans: { ur: "غلام خان بارڈر (شمالی وزیرستان)", ar: "معبر غلام خان الحدودي", fa: "مرز غلام خان", ps: "د غلام خان سرحد" } },
  { country: "Pakistan", code: "PK-ANG", name: "Angoor Adda Border (South Waziristan)", type: "road", trans: { ur: "انگور اڈہ بارڈر", ar: "معبر أنغور أدا الحدودي", fa: "مرز انگور اده", ps: "د انګور اډې سرحد" } },
  { country: "Pakistan", code: "PK-KRL", name: "Kharlachi Border (Kurram)", type: "road", trans: { ur: "خرلاچی بارڈر (کرم ایجنسی)", ar: "معبر خرلاچي الحدودي", fa: "مرز خرلاچی", ps: "د خرلاڅي سرحد" } },
  { country: "Pakistan", code: "PK-TAF", name: "Taftan / Mirjaveh Border (PK-IR)", type: "road", trans: { ur: "تفتان / میرجاوہ بارڈر (پاکستان-ایران)", ar: "معبر تفتان / ميرجاوة الحدودي", fa: "پایانه مرزی تفتان / میرجاوه", ps: "د تفتان / میرجاوه سرحد" } },
  { country: "Pakistan", code: "PK-GBD", name: "Gabd / Rimdan Border (Gwadar-IR)", type: "road", trans: { ur: "گبد / ریمدان بارڈر (گوادر-ایران)", ar: "معبر غبد / ريمدان الحدودي", fa: "مرز گبد / ریمدان", ps: "د ګبد / ریمدان سرحد" } },
  { country: "Pakistan", code: "PK-KHU-SOST", name: "Sost Dry Port / Khunjerab Pass (PK-CN)", type: "road", trans: { ur: "سوسٹ ڈرائی پورٹ / خنجراب پاس", ar: "ميناء سوست الجاف / معبر خنجراب", fa: "بندر خشک سوست / خنجراب", ps: "د سوست وچ بندر / خنجراب" } },
  { country: "Pakistan", code: "PK-WGH", name: "Wagah / Attari Border (PK-IN)", type: "road", trans: { ur: "واہگہ / اٹاری بارڈر", ar: "معبر واغاه الحدودي", fa: "مرز واگه / اتاری", ps: "د واګه سرحد" } },
  { country: "Pakistan", code: "PK-KHI-AIR", name: "Jinnah International Airport Karachi (KHI)", type: "air", trans: { ur: "جناح انٹرنیشنل ایئرپورٹ کراچی", ar: "مطار جناح الدولي كراتشي", fa: "فرودگاه بین‌المللی جناح کراچی", ps: "د جناح نړیوال هوایی ډګر کراچۍ" } },
  { country: "Pakistan", code: "PK-ISB-AIR", name: "Islamabad International Airport (ISB)", type: "air", trans: { ur: "اسلام آباد انٹرنیشنل ایئرپورٹ", ar: "مطار إسلام آباد الدولي", fa: "فرودگاه بین‌المللی اسلام‌آباد", ps: "د اسلام اباد نړیوال هوایی ډګر" } },
  { country: "Pakistan", code: "PK-LHE-AIR", name: "Allama Iqbal Int'l Airport Lahore (LHE)", type: "air", trans: { ur: "علامہ اقبال انٹرنیشنل ایئرپورٹ لاہور", ar: "مطار علامه إقبال الدولي لاهور", fa: "فرودگاه علامه اقبال لاهور", ps: "د علامه اقبال نړیوال هوایی ډګر لاهور" } },
  { country: "Pakistan", code: "PK-PEW-AIR", name: "Bacha Khan Int'l Airport Peshawar (PEW)", type: "air", trans: { ur: "باچا خان انٹرنیشنل ایئرپورٹ پشاور", ar: "مطار باچا خان الدولي بيشاور", fa: "فرودگاه باچا خان پیشاور", ps: "د باچا خان نړیوال هوایی ډګر پېښور" } },

  // --- AFGHANISTAN ---
  { country: "Afghanistan", code: "AF-TRK", name: "Torkham Dry Port & Border (Nangarhar)", type: "road", trans: { ur: "طورخم ڈرائی پورٹ و بارڈر (ننگرہار)", ar: "ميناء تورخام الجاف والحدود (ننجرهار)", fa: "بندر خشک و مرز تورخم (ننگرهار)", ps: "د تورخم وچ بندر او سرحد (ننګرهار)" } },
  { country: "Afghanistan", code: "AF-SPB", name: "Spin Boldak Border Terminal (Kandahar)", type: "road", trans: { ur: "سپین بولدک بارڈر ٹرمینل (قندھار)", ar: "منفذ سبين بولداك الحدودي (قندهار)", fa: "پایانه مرزی اسپین بولدک (قندهار)", ps: "د سپین بولدک سرحدي ترمینل (کندهار)" } },
  { country: "Afghanistan", code: "AF-ISQ", name: "Islam Qala / Dogharoon Border (Herat)", type: "road", trans: { ur: "اسلام قلعہ / دوغارون بارڈر (ہرات)", ar: "منفذ إسلام قلعة الحدودي (هرات)", fa: "گمرک و مرز اسلام قلعه (هرات)", ps: "د اسلام قلعه ګمرک او سرحد (هرات)" } },
  { country: "Afghanistan", code: "AF-HRT", name: "Hairatan Dry Port & Rail (Balkh - UZ)", type: "road", trans: { ur: "حیرتان ڈرائی پورٹ (بلخ-ازبکستان)", ar: "ميناء حيرتان الجاف (بلخ)", fa: "بندر خشک و ریلی حیرتان (بلخ)", ps: "د حیرتان وچ بندر (بلخ)" } },
  { country: "Afghanistan", code: "AF-ZRJ", name: "Zaranj / Milak Border (Nimroz - IR)", type: "road", trans: { ur: "زرنج / میلک بارڈر (نیمروز-ایران)", ar: "منفذ زرنج / ميلك الحدودي (نيمروز)", fa: "پایانه مرزی زرنج / میلک (نیمروز)", ps: "د زرنج / میلک سرحد (نیمروز)" } },
  { country: "Afghanistan", code: "AF-TRG", name: "Torghundi Dry Port (Herat - TM)", type: "road", trans: { ur: "تورغنڈی ڈرائی پورٹ (ہرات-ترکمانستان)", ar: "ميناء تورغندي الجاف (هرات)", fa: "بندر خشک تورغندی (هرات)", ps: "د تورغونډۍ وچ بندر (هرات)" } },
  { country: "Afghanistan", code: "AF-AQN", name: "Aqina Dry Port & Rail (Faryab - TM)", type: "road", trans: { ur: "آقینہ ڈرائی پورٹ (فاریاب)", ar: "ميناء آقينة الجاف (فارياب)", fa: "بندر خشک آقینه (فاریاب)", ps: "د اقینې وچ بندر (فاریاب)" } },
  { country: "Afghanistan", code: "AF-SKB", name: "Sher Khan Bandar Border (Kunduz - TJ)", type: "road", trans: { ur: "شیر خان بندر بارڈر (کندوز-تاجکستان)", ar: "معبر شير خان بندر (قندوز)", fa: "بندر شیرخان (کندز-تاجیکستان)", ps: "د شیرخان بندر سرحد (کندز)" } },
  { country: "Afghanistan", code: "AF-GHU", name: "Ghulam Khan Border Crossing (Khost)", type: "road", trans: { ur: "غلام خان بارڈر کراسنگ (خوست)", ar: "معبر غلام خان (خوست)", fa: "گذرگاه مرزی غلام خان (خوست)", ps: "د غلام خان سرحدي لاره (خوست)" } },
  { country: "Afghanistan", code: "AF-DND", name: "Dand-e-Patan Border (Paktia - PK)", type: "road", trans: { ur: "ڈنڈ پتان بارڈر (پکتیا)", ar: "معبر دند بتان (بكتيا)", fa: "مرز دند پتان (پکتیا)", ps: "د ډنډ پټان سرحد (پکتیا)" } },
  { country: "Afghanistan", code: "AF-KBL-AIR", name: "Kabul International Airport (KBL)", type: "air", trans: { ur: "کابل انٹرنیشنل ایئرپورٹ", ar: "مطار كابول الدولي", fa: "فرودگاه بین‌المللی کابل", ps: "د کابل نړیوال هوایی ډګر" } },
  { country: "Afghanistan", code: "AF-HEA-AIR", name: "Herat Khwaja Abdullah Ansari Airport (HEA)", type: "air", trans: { ur: "ہرات انٹرنیشنل ایئرپورٹ", ar: "مطار هرات الدولي", fa: "فرودگاه بین‌المللی هرات", ps: "د هرات نړیوال هوایی ډګر" } },
  { country: "Afghanistan", code: "AF-MZR-AIR", name: "Mazar-i-Sharif Airport (MZR)", type: "air", trans: { ur: "مزار شریف انٹرنیشنل ایئرپورٹ", ar: "مطار مزار شريف الدولي", fa: "فرودگاه بین‌المللی مزار شریف", ps: "د مزار شریف هوایی ډګر" } },
  { country: "Afghanistan", code: "AF-KDH-AIR", name: "Kandahar Ahmad Shah Baba Airport (KDH)", type: "air", trans: { ur: "قندھار احمد شاہ بابا انٹرنیشنل ایئرپورٹ", ar: "مطار قندهار الدولي", fa: "فرودگاه بین‌المللی قندهار", ps: "د کندهار احمد شاه بابا هوایی ډګر" } },

  // --- IRAN ---
  { country: "Iran", code: "IR-BND", name: "Bandar Abbas (Shahid Rajaee Port)", type: "sea", trans: { ur: "بندر عباس (شہید رجائی پورٹ)", ar: "ميناء الشهيد رجائي (بندر عباس)", fa: "مجتمع بندری شهید رجایی (بندرعباس)", ps: "د شهید رجایی بندر (بندر عباس)" } },
  { country: "Iran", code: "IR-CHB", name: "Chabahar Port (Shahid Beheshti)", type: "sea", trans: { ur: "چابہار پورٹ (شہید بہشتی)", ar: "ميناء تشابهار (الشهيد بهشتي)", fa: "بندر چابهار (شهید بهشتی)", ps: "د چابهار بندر (شهید بهشتی)" } },
  { country: "Iran", code: "IR-BSH", name: "Bushehr Port", type: "sea", trans: { ur: "بوشہر پورٹ", ar: "ميناء بوشهر", fa: "بندر بوشهر", ps: "د بوشهر بندر" } },
  { country: "Iran", code: "IR-BIK", name: "Bandar Imam Khomeini (BIK)", type: "sea", trans: { ur: "بندر امام خمینی", ar: "ميناء الإمام الخميني", fa: "بندر امام خمینی", ps: "د امام خمینی بندر" } },
  { country: "Iran", code: "IR-ANZ", name: "Bandar Anzali Port (Caspian Sea)", type: "sea", trans: { ur: "بندر انزلی پورٹ (بحیرہ کیسپین)", ar: "ميناء بندر أنزلي (بحر قزوين)", fa: "بندر انزلی (دریای خزر)", ps: "د انزلي بندر (د خزر سمندرګی)" } },
  { country: "Iran", code: "IR-DOG", name: "Dogharoon Border Terminal (IR-AF)", type: "road", trans: { ur: "دوغارون بارڈر ٹرمینل (ایران-افغانستان)", ar: "منفذ دوغارون الحدودي (إيران-أفغانستان)", fa: "پایانه مرزی دوغارون (تایباد)", ps: "د دوغارون سرحدي ترمینل" } },
  { country: "Iran", code: "IR-MRJ", name: "Mirjaveh Border Terminal (IR-PK)", type: "road", trans: { ur: "میرجاوہ بارڈر ٹرمینل (ایران-پاکستان)", ar: "منفذ ميرجاوة الحدودي", fa: "پایانه مرزی میرجاوه", ps: "د میرجاوه سرحدي ترمینل" } },
  { country: "Iran", code: "IR-BZG", name: "Bazargan Border Terminal (IR-TR)", type: "road", trans: { ur: "بازرگان بارڈر ٹرمینل (ایران-ترکیہ)", ar: "منفذ بازركان الحدودي (إيران-تركيا)", fa: "پایانه مرزی بازرگان (مرز ترکیه)", ps: "د بازرګان سرحد (ایران-ترکیه)" } },
  { country: "Iran", code: "IR-RMD", name: "Rimdan Border Crossing (IR-PK)", type: "road", trans: { ur: "ریمدان بارڈر کراسنگ (ایران-پاکستان)", ar: "معبر ريمدان الحدودي", fa: "پایانه مرزی ریمدان", ps: "د ریمدان سرحدي لاره" } },
  { country: "Iran", code: "IR-AST", name: "Astara Border (IR-AZ)", type: "road", trans: { ur: "آستارا بارڈر", ar: "معبر أستارا الحدودي", fa: "پایانه مرزی آستارا", ps: "د استارا سرحد" } },
  { country: "Iran", code: "IR-IKA", name: "Tehran Imam Khomeini Int'l Airport (IKA)", type: "air", trans: { ur: "تہران امام خمینی انٹرنیشنل ایئرپورٹ", ar: "مطار الإمام الخميني الدولي طهران", fa: "فرودگاه بین‌المللی امام خمینی تهران", ps: "د امام خمینی نړیوال هوایی ډګر تهران" } },
  { country: "Iran", code: "IR-MHD", name: "Mashhad Shahid Hasheminejad Airport (MHD)", type: "air", trans: { ur: "مشہد شہید ہاشمی نژاد ایئرپورٹ", ar: "مطار مشهد الدولي", fa: "فرودگاه بین‌المللی شهید هاشمی‌نژاد مشهد", ps: "د مشهد هوایی ډګر" } },

  // --- TURKIYE ---
  { country: "Turkiye", code: "TR-AMB", name: "Port of Ambarli (Istanbul)", type: "sea", trans: { ur: "امبارلی پورٹ (استنبول)", ar: "ميناء أمبارلي (إسطنبول)", fa: "بندر آمبارلی (استانبول)", ps: "د امبارلي بندر (استانبول)" } },
  { country: "Turkiye", code: "TR-MER", name: "Port of Mersin (MIP)", type: "sea", trans: { ur: "مرسین پورٹ", ar: "ميناء مرسين الدولي", fa: "بندر مرسین", ps: "د مرسین نړیوال بندر" } },
  { country: "Turkiye", code: "TR-IZM", name: "Port of Izmir (Alsancak)", type: "sea", trans: { ur: "ازمیر پورٹ (السانجاک)", ar: "ميناء إزمير", fa: "بندر ازمیر", ps: "د ازمیر بندر" } },
  { country: "Turkiye", code: "TR-GEM", name: "Port of Gemlik (Bursa)", type: "sea", trans: { ur: "گیملک پورٹ (برسا)", ar: "ميناء جمليك", fa: "بندر گملیک", ps: "د ګملیک بندر" } },
  { country: "Turkiye", code: "TR-ISK", name: "Port of Iskenderun", type: "sea", trans: { ur: "اسکندرون پورٹ", ar: "ميناء إسكندرون", fa: "بندر اسکندرون", ps: "د اسکندرون بندر" } },
  { country: "Turkiye", code: "TR-KPK", name: "Kapikule Border Crossing (TR-BG)", type: "road", trans: { ur: "کاپیکولے بارڈر (ترکیہ-بلغاریہ)", ar: "بوابة كابيكولي الحدودية", fa: "گذرگاه مرزی کاپیکوله", ps: "د کاپیکوله سرحدي دروازه" } },
  { country: "Turkiye", code: "TR-GRB", name: "Gurbulak / Bazargan Border (TR-IR)", type: "road", trans: { ur: "گربولاک / بازرگان بارڈر (ترکیہ-ایران)", ar: "معبر غوربولاك الحدودي (تركيا-إيران)", fa: "گذرگاه مرزی گوربولاغ (مرز ایران)", ps: "د ګوربولاک سرحد (ترکیه-ایران)" } },
  { country: "Turkiye", code: "TR-HBR", name: "Habur / Ibrahim Khalil Border (TR-IQ)", type: "road", trans: { ur: "خابور / ابراھیم خلیل بارڈر (ترکیہ-عراق)", ar: "معبر الخابور / إبراهيم الخليل", fa: "مرز خابور / ابراهیم خلیل", ps: "د خابور / ابراهیم خلیل سرحد" } },
  { country: "Turkiye", code: "TR-SRP", name: "Sarp Border (TR-Georgia)", type: "road", trans: { ur: "سارپ بارڈر (ترکیہ-جارجیا)", ar: "معبر سارب الحدودي (تركيا-جورجيا)", fa: "مرز سارپ (گرجستان)", ps: "د سارپ سرحد (ګرجستان)" } },
  { country: "Turkiye", code: "TR-IST", name: "Istanbul Airport (IST)", type: "air", trans: { ur: "استنبول گرینڈ ایئرپورٹ", ar: "مطار إسطنبول الدولي الجديد", fa: "فرودگاه بین‌المللی استانبول", ps: "د استانبول نړیوال هوایی ډګر" } },
  { country: "Turkiye", code: "TR-SAW", name: "Sabiha Gokcen Airport (SAW)", type: "air", trans: { ur: "صبیحہ گوکچن ایئرپورٹ استنبول", ar: "مطار صبيحة كوكجن الدولي", fa: "فرودگاه صبیحه گوکچن استانبول", ps: "د صبیحه ګوکچن هوایی ډګر" } },

  // --- INDIA ---
  { country: "India", code: "IN-NSA", name: "Nhava Sheva / JNPT Port (Mumbai)", type: "sea", trans: { ur: "نہوا شیوا / جے این پی ٹی پورٹ (ممبئی)", ar: "ميناء نهافا شيفا (مومباي)", fa: "بندر ناوا شوا / جی‌ان‌پی‌تی (بمبئی)", ps: "د نهوا شیوا بندر (ممبی)" } },
  { country: "India", code: "IN-MUN", name: "Mundra Port (Gujarat)", type: "sea", trans: { ur: "مندرا پورٹ (گجرات)", ar: "ميناء موندرا (غوجارات)", fa: "بندر موندرا (گجرات)", ps: "د موندرا بندر (ګجرات)" } },
  { country: "India", code: "IN-MAA", name: "Chennai Port (Madras)", type: "sea", trans: { ur: "چنائی پورٹ", ar: "ميناء تشيناي", fa: "بندر چنای", ps: "د چنای بندر" } },
  { country: "India", code: "IN-COK", name: "Cochin Port (Kochi)", type: "sea", trans: { ur: "کوچین پورٹ (کوچی)", ar: "ميناء كوتشين", fa: "بندر کوچین", ps: "د کوچین بندر" } },
  { country: "India", code: "IN-ATR", name: "Attari / Wagah Border Terminal (IN-PK)", type: "road", trans: { ur: "اٹاری / واہگہ بارڈر ٹرمینل (بھارت-پاکستان)", ar: "معبر أتاري / واغاه الحدودي", fa: "پایانه مرزی اتاری (هند-پاکستان)", ps: "د اټاري / واګه سرحدي ترمینل" } },
  { country: "India", code: "IN-DEL", name: "Indira Gandhi Int'l Airport Delhi (DEL)", type: "air", trans: { ur: "اندرا گاندھی انٹرنیشنل ایئرپورٹ دہلی", ar: "مطار أنديرا غاندي الدولي دلهي", fa: "فرودگاه بین‌المللی ایندیرا گاندی دهلی", ps: "د اندرا ګاندی نړیوال هوایی ډګر ډیلی" } },
  { country: "India", code: "IN-BOM", name: "Chhatrapati Shivaji Maharaj Airport (BOM)", type: "air", trans: { ur: "چھترپتی شیواجی مہاراج ایئرپورٹ ممبئی", ar: "مطار تشاتراباتي شيفاجي مومباي", fa: "فرودگاه بین‌المللی بمبئی", ps: "د ممبی نړیوال هوایی ډګر" } },

  // --- UZBEKISTAN ---
  { country: "Uzbekistan", code: "UZ-TRM", name: "Termez River Port & Border (UZ-AF)", type: "road", trans: { ur: "ترمذ بارڈر و ریور پورٹ (ازبکستان-افغانستان)", ar: "ميناء ومعبر ترمذ الحدودي", fa: "پایانه و بندر مرزی ترمز (ازبکستان-افغانستان)", ps: "د ترمذ سرحدي ترمینل او بندر" } },
  { country: "Uzbekistan", code: "UZ-GSH", name: "Gisht Kuprik / Chernyaevka Border (UZ-KZ)", type: "road", trans: { ur: "گشت کوپرک بارڈر (ازبکستان-قازق)", ar: "معبر غيشت كوبريك (أوزبكستان-كازاخستان)", fa: "مرز گیشت کوپریک / چرنیایوکا", ps: "د ګشت کوپریک سرحد" } },
  { country: "Uzbekistan", code: "UZ-ALT", name: "Alat / Farap Border (UZ-TM)", type: "road", trans: { ur: "الات / فاراپ بارڈر (ازبکستان-ترکمان)", ar: "معبر آلات / فاراب الحدودي", fa: "مرز آلات / فاراپ", ps: "د الات / فاراپ سرحد" } },
  { country: "Uzbekistan", code: "UZ-TAS", name: "Islam Karimov Tashkent Airport (TAS)", type: "air", trans: { ur: "تاشقند انٹرنیشنل ایئرپورٹ", ar: "مطار طشقند الدولي", fa: "فرودگاه بین‌المللی تاشکند", ps: "د تاشکند نړیوال هوایی ډګر" } },

  // --- KAZAKHSTAN ---
  { country: "Kazakhstan", code: "KZ-AKT", name: "Aktau Port (Caspian Sea)", type: "sea", trans: { ur: "اقتاؤ پورٹ (بحیرہ کیسپین)", ar: "ميناء أكتاو (بحر قزوين)", fa: "بندر بین‌المللی آکتائو", ps: "د اقتاؤ بندر" } },
  { country: "Kazakhstan", code: "KZ-KHO", name: "Nur Zholy / Khorgos Border (KZ-CN)", type: "road", trans: { ur: "نور ژولی / خورگوس بارڈر (قازق-چین)", ar: "معبر نور جولي / خورغوس الحدودي", fa: "پایانه مرزی نور ژولی / خورگوس", ps: "د نور ژولی / خورګوس سرحد" } },
  { country: "Kazakhstan", code: "KZ-ALA", name: "Almaty International Airport (ALA)", type: "air", trans: { ur: "الماتی انٹرنیشنل ایئرپورٹ", ar: "مطار ألماتي الدولي", fa: "فرودگاه بین‌المللی آلماتی", ps: "د الماتی نړیوال هوایی ډګر" } },
  { country: "Kazakhstan", code: "KZ-NQZ", name: "Nursultan Nazarbayev Airport Astana (NQZ)", type: "air", trans: { ur: "آستانہ انٹرنیشنل ایئرپورٹ", ar: "مطار أستانا الدولي", fa: "فرودگاه بین‌المللی نورسلطان نظربایف", ps: "د استانې نړیوال هوایی ډګر" } },

  // --- TAJIKISTAN ---
  { country: "Tajikistan", code: "TJ-NPN", name: "Nizhny Pyanj / Panji Poyon Border (TJ-AF)", type: "road", trans: { ur: "نچلا پنج بارڈر (تاجکستان-افغانستان)", ar: "معبر بنج سفلي / پنج پايان", fa: "مرز پنج پایان / پل دوستی (تاجیکستان-افغانستان)", ps: "د پنج پایان سرحد (تاجکستان-افغانستان)" } },
  { country: "Tajikistan", code: "TJ-KLM", name: "Kulma Pass Border (TJ-CN)", type: "road", trans: { ur: "قلمہ پاس بارڈر (تاجکستان-چین)", ar: "معبر ممر كولما (طاجيكستان-الصين)", fa: "گذرگاه مرزی کولما (مرز چین)", ps: "د کولما لار سرحد" } },
  { country: "Tajikistan", code: "TJ-DYU", name: "Dushanbe International Airport (DYU)", type: "air", trans: { ur: "دوشنبہ انٹرنیشنل ایئرپورٹ", ar: "مطار دوشنبه الدولي", fa: "فرودگاه بین‌المللی دوشنبه", ps: "د دوشنبې نړیوال هوایی ډګر" } },

  // --- TURKMENISTAN ---
  { country: "Turkmenistan", code: "TM-KRW", name: "Turkmenbashi International Seaport", type: "sea", trans: { ur: "ترکمان باشی انٹرنیشنل سی پورٹ", ar: "ميناء تركمانباشي البحري الدولي", fa: "بندر بین‌المللی ترکمن‌باشی", ps: "د ترکمنباشي نړیوال بندر" } },
  { country: "Turkmenistan", code: "TM-SRK", name: "Sarakhs Border Crossing (TM-IR)", type: "road", trans: { ur: "سرخس بارڈر کراسنگ (ترکمانستان-ایران)", ar: "معبر سرخس الحدودي", fa: "پایانه مرزی سرخس", ps: "د سرخس سرحدي لاره" } },
  { country: "Turkmenistan", code: "TM-IMN", name: "Imamnazar / Aqina Border (TM-AF)", type: "road", trans: { ur: "امام نظر / آقینہ بارڈر", ar: "معبر إمام نظر / آقينة", fa: "مرز امام‌نظر / آقینه", ps: "د امام نظر / اقینې سرحد" } },
  { country: "Turkmenistan", code: "TM-ASB", name: "Ashgabat Oguz Han Airport (ASB)", type: "air", trans: { ur: "عشق آباد انٹرنیشنل ایئرپورٹ", ar: "مطار عشق آباد الدولي", fa: "فرودگاه بین‌المللی عشق‌آباد", ps: "د عشق اباد نړیوال هوایی ډګر" } }
];

export async function runSeeder(sql) {
  console.log("Starting Multilingual Countries & Ports Seeder...");

  // 1. Ensure countries table has all countries
  const countryCols = (await sql`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'countries'
  `).map(c => c.column_name);

  const countryMap = {};
  for (const c of COUNTRIES_DATA) {
    let [existing] = await sql`
      SELECT id, name FROM countries 
      WHERE iso2 = ${c.iso2} OR name ILIKE ${c.name}
      LIMIT 1
    `;
    if (!existing) {
      const email = `contact.${c.iso2.toLowerCase()}@dgt.llc`;
      const row = {
        name: c.name,
        iso2: c.iso2,
        iso3: c.iso3,
        currency_code: c.currency,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (countryCols.includes("official_email")) row.official_email = email;
      if (countryCols.includes("admin_email")) row.admin_email = email;
      if (countryCols.includes("support_email")) row.support_email = email;
      if (countryCols.includes("default_language_code")) row.default_language_code = "en";
      if (countryCols.includes("status")) row.status = "active";

      const [inserted] = await sql`
        INSERT INTO countries ${sql(row)}
        RETURNING id, name
      `;
      existing = inserted;
      console.log(`+ Inserted Country: ${c.name} (${c.iso2})`);
    } else {
      await sql`
        UPDATE countries 
        SET iso2 = ${c.iso2}, iso3 = ${c.iso3}, currency_code = ${c.currency}, is_active = true, updated_at = NOW()
        WHERE id = ${existing.id}
      `;
      console.log(`✓ Updated Country: ${c.name} (${c.iso2})`);
    }
    countryMap[c.name] = existing.id;
  }

  // 2. Ensure schema columns exist on ports table
  try {
    await sql`ALTER TABLE ports ADD COLUMN IF NOT EXISTS port_name text`;
    await sql`ALTER TABLE ports ADD COLUMN IF NOT EXISTS port_code text`;
    await sql`ALTER TABLE ports ADD COLUMN IF NOT EXISTS transport_type text DEFAULT 'sea'`;
    await sql`ALTER TABLE ports ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true`;
  } catch (e) {
    console.log("Schema note:", e.message);
  }

  // 3. Upsert ports and multilingual translations
  let insertedCount = 0;
  let updatedCount = 0;

  for (const p of PORTS_DATA) {
    const countryId = countryMap[p.country] || null;

    let [existing] = await sql`
      SELECT id, port_name FROM ports 
      WHERE port_code = ${p.code} OR port_name ILIKE ${p.name}
      LIMIT 1
    `;

    let portId;
    if (!existing) {
      const [inserted] = await sql`
        INSERT INTO ports (port_name, port_code, country_id, transport_type, is_active, created_at, updated_at)
        VALUES (${p.name}, ${p.code}, ${countryId}, ${p.type}, true, NOW(), NOW())
        RETURNING id
      `;
      portId = inserted.id;
      insertedCount++;
      console.log(`+ Added Port: [${p.type.toUpperCase()}] ${p.name} (${p.country})`);
    } else {
      portId = existing.id;
      await sql`
        UPDATE ports
        SET port_name = ${p.name}, port_code = ${p.code}, country_id = ${countryId}, transport_type = ${p.type}, is_active = true, deleted_at = NULL, updated_at = NOW()
        WHERE id = ${portId}
      `;
      updatedCount++;
      console.log(`✓ Updated Port: [${p.type.toUpperCase()}] ${p.name} (${p.country})`);
    }

    // Insert Translations across 5 languages: en, ur, ar, fa, ps
    const langs = ["ur", "ar", "fa", "ps", "en"];
    for (const l of langs) {
      const transTable = `ports_${l}`;
      const transText = l === "en" ? p.name : (p.trans[l] || p.name);
      try {
        await sql`
          INSERT INTO ${sql(transTable)} (
            record_id, field_name, translated_text, original_text, 
            original_language_code, source, translation_status, translated_by_engine,
            created_at, updated_at
          )
          VALUES (
            ${portId}, 'port_name', ${transText}, ${p.name}, 
            'en', 'human_verified', 'approved', 'system_dictionary',
            NOW(), NOW()
          )
          ON CONFLICT (record_id, field_name) DO UPDATE 
          SET translated_text = EXCLUDED.translated_text, updated_at = NOW()
        `;
      } catch (err) {
        try {
          await sql`DELETE FROM ${sql(transTable)} WHERE record_id = ${portId} AND field_name = 'port_name'`;
          await sql`
            INSERT INTO ${sql(transTable)} (
              record_id, field_name, translated_text, original_text, 
              original_language_code, source, translation_status, translated_by_engine,
              created_at, updated_at
            )
            VALUES (
              ${portId}, 'port_name', ${transText}, ${p.name}, 
              'en', 'human_verified', 'approved', 'system_dictionary',
              NOW(), NOW()
            )
          `;
        } catch (e2) {}
      }
    }
  }

  console.log(`\n=================================================`);
  console.log(`✅ SEEDER FINISHED: Inserted ${insertedCount}, Updated ${updatedCount} ports.`);
  console.log(`=================================================\n`);
}

async function main() {
  const sql = postgres(localDbUrl, { max: 5 });
  try {
    await runSeeder(sql);
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("populate-ports-multilingual.mjs")) {
  main();
}
