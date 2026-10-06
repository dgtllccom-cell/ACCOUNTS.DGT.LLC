import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const dbUrl = process.env.DATABASE_URL || env.DATABASE_URL;
if (!dbUrl) {
  console.error("No DATABASE_URL found!");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 2, prepare: false });

export const GOODS_DATA = [
  // ── 1. Dry Fruits (24 items) ──
  {
    name: "Walnut Kernel",
    hsCode: "080232",
    type: "Dry Fruit",
    detail: "Walnut tree kernel",
    nameI18n: { en: "Walnut Kernel", ur: "اخروٹ گری", ar: "لب الجوز", fa: "مغز گردو", ps: "د غوزانو مغز" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Walnut tree kernel", ur: "اخروٹ کے درخت کا مغز", ar: "لب شجرة الجوز", fa: "مغز درخت گردو", ps: "د غوزانو د ونې مغز" }
  },
  {
    name: "Walnut In-Shell",
    hsCode: "080231",
    type: "Dry Fruit",
    detail: "Walnut tree nut",
    nameI18n: { en: "Walnut In-Shell", ur: "اخروٹ چھلکے سمیت", ar: "جوز بقشره", fa: "گردو با پوست", ps: "پوستکي لرونکي غوزان" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Walnut tree nut", ur: "اخروٹ کا خشک پھل", ar: "ثمرة شجرة الجوز", fa: "میوه درخت گردو", ps: "د غوزانو د ونې میوه" }
  },
  {
    name: "Almond Kernel",
    hsCode: "080212",
    type: "Dry Fruit",
    detail: "Almond tree kernel",
    nameI18n: { en: "Almond Kernel", ur: "بادام گری", ar: "لب اللوز", fa: "مغز بادام", ps: "د بادامو مغز" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Almond tree kernel", ur: "بادام کے درخت کا مغز", ar: "لب شجرة اللوز", fa: "مغز درخت بادام", ps: "د بادامو د ونې مغز" }
  },
  {
    name: "Almond In-Shell",
    hsCode: "080211",
    type: "Dry Fruit",
    detail: "Almond tree nut",
    nameI18n: { en: "Almond In-Shell", ur: "بادام چھلکے سمیت", ar: "لوز بقشره", fa: "بادام با پوست", ps: "پوستکي لرونکي بادام" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Almond tree nut", ur: "بادام کا خشک پھل", ar: "ثمرة شجرة اللوز", fa: "میوه درخت بادام", ps: "د بادامو د ونې میوه" }
  },
  {
    name: "Pistachio Kernel",
    hsCode: "080252",
    type: "Dry Fruit",
    detail: "Pistachio tree kernel",
    nameI18n: { en: "Pistachio Kernel", ur: "پستہ گری", ar: "لب الفستق", fa: "مغز پسته", ps: "د پستې مغز" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Pistachio tree kernel", ur: "پستے کے درخت کا مغز", ar: "لب شجرة الفستق", fa: "مغز درخت پسته", ps: "د پستې د ونې مغز" }
  },
  {
    name: "Pistachio In-Shell",
    hsCode: "080251",
    type: "Dry Fruit",
    detail: "Pistachio tree nut",
    nameI18n: { en: "Pistachio In-Shell", ur: "پستہ چھلکے سمیت", ar: "فستق بقشره", fa: "پسته با پوست", ps: "پوستکي لرونکې پسته" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Pistachio tree nut", ur: "پستے کا خشک پھل", ar: "ثمرة شجرة الفستق", fa: "میوه درخت پسته", ps: "د پستې د ونې میوه" }
  },
  {
    name: "Cashew Kernel",
    hsCode: "080132",
    type: "Dry Fruit",
    detail: "Cashew tree kernel",
    nameI18n: { en: "Cashew Kernel", ur: "کاجو گری", ar: "لب الكاجو", fa: "مغز بادام هندی", ps: "د کاجو مغز" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Cashew tree kernel", ur: "کاجو کے درخت کا مغز", ar: "لب شجرة الكاجو", fa: "مغز درخت بادام هندی", ps: "د کاجو د ونې مغز" }
  },
  {
    name: "Cashew In-Shell",
    hsCode: "080131",
    type: "Dry Fruit",
    detail: "Cashew tree nut",
    nameI18n: { en: "Cashew In-Shell", ur: "کاجو چھلکے سمیت", ar: "كاجو بقشره", fa: "بادام هندی با پوست", ps: "پوستکي لرونکی کاجو" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Cashew tree nut", ur: "کاجو کا خشک پھل", ar: "ثمرة شجرة الكاجو", fa: "میوه درخت بادام هندی", ps: "د کاجو د ونې میوه" }
  },
  {
    name: "Hazelnut Kernel",
    hsCode: "080222",
    type: "Dry Fruit",
    detail: "Hazel tree kernel",
    nameI18n: { en: "Hazelnut Kernel", ur: "فندق گری", ar: "لب البندق", fa: "مغز فندق", ps: "د فندق مغز" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Hazel tree kernel", ur: "فندق کے درخت کا مغز", ar: "لب شجرة البندق", fa: "مغز درخت فندق", ps: "د فندق د ونې مغز" }
  },
  {
    name: "Hazelnut In-Shell",
    hsCode: "080221",
    type: "Dry Fruit",
    detail: "Hazel tree nut",
    nameI18n: { en: "Hazelnut In-Shell", ur: "فندق چھلکے سمیت", ar: "بندق بقشره", fa: "فندق با پوست", ps: "پوستکي لرونکی فندق" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Hazel tree nut", ur: "فندق کا خشک پھل", ar: "ثمرة شجرة البندق", fa: "میوه درخت فندق", ps: "د فندق د ونې میوه" }
  },
  {
    name: "Chestnut Kernel",
    hsCode: "080242",
    type: "Dry Fruit",
    detail: "Chestnut tree kernel",
    nameI18n: { en: "Chestnut Kernel", ur: "شاہ بلوط گری", ar: "لب الكستناء", fa: "مغز شاه‌بلوط", ps: "د شاه بلوط مغز" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Chestnut tree kernel", ur: "شاہ بلوط کا مغز", ar: "لب شجرة الكستناء", fa: "مغز درخت شاه‌بلوط", ps: "د شاه بلوط د ونې مغز" }
  },
  {
    name: "Chestnut In-Shell",
    hsCode: "080241",
    type: "Dry Fruit",
    detail: "Chestnut tree nut",
    nameI18n: { en: "Chestnut In-Shell", ur: "شاہ بلوط چھلکے سمیت", ar: "كستناء بقشرها", fa: "شاه‌بلوط با پوست", ps: "پوستکي لرونکی شاه بلوط" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Chestnut tree nut", ur: "شاہ بلوط کا پھل", ar: "ثمرة شجرة الكستناء", fa: "میوه درخت شاه‌بلوط", ps: "د شاه بلوط د ونې میوه" }
  },
  {
    name: "Brazil Nut Kernel",
    hsCode: "080122",
    type: "Dry Fruit",
    detail: "Brazil nut tree kernel",
    nameI18n: { en: "Brazil Nut Kernel", ur: "برازیلین نٹ گری", ar: "لب الجوز البرازيلي", fa: "مغز آجیل برزیلی", ps: "د برازیلي مغز مغز" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Brazil nut tree kernel", ur: "برازیلین نٹ درخت کا مغز", ar: "لب شجرة الجوز البرازيلي", fa: "مغز درخت آجیل برزیلی", ps: "د برازیلي مغز د ونې مغز" }
  },
  {
    name: "Brazil Nut In-Shell",
    hsCode: "080121",
    type: "Dry Fruit",
    detail: "Brazil nut tree nut",
    nameI18n: { en: "Brazil Nut In-Shell", ur: "برازیلین نٹ چھلکے سمیت", ar: "جوز برازيلي بقشره", fa: "آجیل برزیلی با پوست", ps: "پوستکي لرونکی برازیلي مغز" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Brazil nut tree nut", ur: "برازیلین نٹ کا پھل", ar: "ثمرة شجرة الجوز البرازيلي", fa: "میوه درخت آجیل برزیلی", ps: "د برازیلي مغز د ونې میوه" }
  },
  {
    name: "Macadamia Kernel",
    hsCode: "080262",
    type: "Dry Fruit",
    detail: "Macadamia tree kernel",
    nameI18n: { en: "Macadamia Kernel", ur: "مکادامیا گری", ar: "لب المكاديميا", fa: "مغز ماکادمیا", ps: "د مکادامیا مغز" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Macadamia tree kernel", ur: "مکادامیا درخت کا مغز", ar: "لب شجرة المكاديميا", fa: "مغز درخت ماکادمیا", ps: "د مکادامیا د ونې مغز" }
  },
  {
    name: "Macadamia In-Shell",
    hsCode: "080261",
    type: "Dry Fruit",
    detail: "Macadamia tree nut",
    nameI18n: { en: "Macadamia In-Shell", ur: "مکادامیا چھلکے سمیت", ar: "مكاديميا بقشرها", fa: "ماکادمیا با پوست", ps: "پوستکي لرونکی مکادامیا" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Macadamia tree nut", ur: "مکادامیا کا خشک پھل", ar: "ثمرة شجرة المكاديميا", fa: "میوه درخت ماکادمیا", ps: "د مکادامیا د ونې میوه" }
  },
  {
    name: "Pine Nut Kernel",
    hsCode: "080292",
    type: "Dry Fruit",
    detail: "Pine tree seed/kernel",
    nameI18n: { en: "Pine Nut Kernel", ur: "چلغوزہ گری", ar: "لب الصنوبر", fa: "مغز چلغوزه", ps: "د جلغوزي مغز" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Pine tree seed/kernel", ur: "صنوبر کے درخت کا بیج/مغز", ar: "بذرة/لب شجرة الصنوبر", fa: "دانه/مغز درخت کاج", ps: "د جلغوزي د ونې زړی/مغز" }
  },
  {
    name: "Pine Nut In-Shell",
    hsCode: "080291",
    type: "Dry Fruit",
    detail: "Pine tree seed",
    nameI18n: { en: "Pine Nut In-Shell", ur: "چلغوزہ چھلکے سمیت", ar: "صنوبر بقشره", fa: "چلغوزه با پوست", ps: "پوستکي لرونکی جلغوزی" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Pine tree seed", ur: "صنوبر کے درخت کا بیج", ar: "بذرة شجرة الصنوبر", fa: "بذر درخت کاج", ps: "د جلغوزي د ونې زړی" }
  },
  {
    name: "Raisins",
    hsCode: "080620",
    type: "Dry Fruit",
    detail: "Dried grapes",
    nameI18n: { en: "Raisins", ur: "کشمش", ar: "زبيب", fa: "کشمش", ps: "کشمش" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Dried grapes", ur: "خشک انگور", ar: "عنب مجفف", fa: "انگور خشک شده", ps: "وچ انګور" }
  },
  {
    name: "Dried Figs",
    hsCode: "080420",
    type: "Dry Fruit",
    detail: "Dried fig fruit",
    nameI18n: { en: "Dried Figs", ur: "خشک انجیر", ar: "تين مجفف", fa: "انجیر خشک", ps: "وچ انځر" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Dried fig fruit", ur: "خشک انجیر کا پھل", ar: "ثمار التين المجفف", fa: "میوه انجیر خشک", ps: "د وچ انځر میوه" }
  },
  {
    name: "Dates",
    hsCode: "080410",
    type: "Dry Fruit",
    detail: "Date palm fruit",
    nameI18n: { en: "Dates", ur: "کھجور", ar: "تمور", fa: "خرما", ps: "خرما" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Date palm fruit", ur: "کھجور کے درخت کا پھل", ar: "ثمار نخلة التمر", fa: "میوه نخل خرما", ps: "د خرما د ونې میوه" }
  },
  {
    name: "Dried Apricot",
    hsCode: "081310",
    type: "Dry Fruit",
    detail: "Dried apricot fruit",
    nameI18n: { en: "Dried Apricot", ur: "خشک خوبانی", ar: "مشمش مجفف", fa: "برگه زردآلو", ps: "وچه زردالو" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Dried apricot fruit", ur: "خشک خوبانی کا پھل", ar: "ثمار المشمش المجفف", fa: "میوه زردآلو خشک", ps: "د وچې زردالو میوه" }
  },
  {
    name: "Prunes",
    hsCode: "081320",
    type: "Dry Fruit",
    detail: "Dried plum fruit",
    nameI18n: { en: "Prunes", ur: "آلو بخارا", ar: "برقوق مجفف", fa: "آلو خشک", ps: "وچ الوبخارا" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Dried plum fruit", ur: "خشک آلوچے کا پھل", ar: "ثمار البرقوق المجفف", fa: "میوه آلو خشک", ps: "د وچ الوبخارا میوه" }
  },
  {
    name: "Dried Apple",
    hsCode: "081330",
    type: "Dry Fruit",
    detail: "Dried apple fruit",
    nameI18n: { en: "Dried Apple", ur: "خشک سیب", ar: "تفاح مجفف", fa: "سیب خشک", ps: "وچه مڼه" },
    typeI18n: { en: "Dry Fruit", ur: "خشک میوہ", ar: "فواكه مجففة", fa: "میوه خشک", ps: "وچه میوه" },
    detailI18n: { en: "Dried apple fruit", ur: "خشک سیب کا پھل", ar: "ثمار التفاح المجفف", fa: "میوه سیب خشک", ps: "د وچې مڼې میوه" }
  },

  // ── 2. Pulses (26 items) ──
  {
    name: "Dry Peas",
    hsCode: "071310",
    type: "Dry Pulses",
    detail: "Pea plant seeds",
    nameI18n: { en: "Dry Peas", ur: "خشک مٹر", ar: "بازلاء جافة", fa: "نخودفرنگی خشک", ps: "وچ مټران" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Pea plant seeds", ur: "مٹر کے پودے کے بیج", ar: "بذور نبات البازلاء", fa: "بذر گیاه نخودفرنگی", ps: "د مټر د بوټي تخم" }
  },
  {
    name: "Yellow Peas",
    hsCode: "071310.10",
    type: "Dry Pulses",
    detail: "Yellow pea seeds",
    nameI18n: { en: "Yellow Peas", ur: "پیلے مٹر", ar: "بازلاء صفراء", fa: "نخود زرد", ps: "ژېړ مټران" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Yellow pea seeds", ur: "پیلے مٹر کے بیج", ar: "بذور البازلاء الصفراء", fa: "دانه‌های نخود زرد", ps: "د ژېړو مټرو تخم" }
  },
  {
    name: "Green Peas",
    hsCode: "071310.20",
    type: "Dry Pulses",
    detail: "Green pea seeds",
    nameI18n: { en: "Green Peas", ur: "سبز مٹر", ar: "بازلاء خضراء", fa: "نخود سبز", ps: "شنه مټران" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Green pea seeds", ur: "سبز مٹر کے بیج", ar: "بذور البازلاء الخضراء", fa: "دانه‌های نخود سبز", ps: "د شنو مټرو تخم" }
  },
  {
    name: "Chickpeas",
    hsCode: "071320",
    type: "Dry Pulses",
    detail: "Chickpea plant seeds",
    nameI18n: { en: "Chickpeas", ur: "چنے", ar: "حمص", fa: "نخود", ps: "چڼې" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Chickpea plant seeds", ur: "چنے کے پودے کے بیج", ar: "بذور نبات الحمص", fa: "بذر گیاه نخود", ps: "د چڼو د بوټي تخم" }
  },
  {
    name: "Kabuli Chickpeas",
    hsCode: "071320.10",
    type: "Dry Pulses",
    detail: "Large chickpea seeds",
    nameI18n: { en: "Kabuli Chickpeas", ur: "کابلی چنے", ar: "حمص كابولي", fa: "نخود کابلی", ps: "کابلي چڼې" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Large chickpea seeds", ur: "بڑے سفید چنے کے بیج", ar: "بذور الحمص الكبيرة", fa: "دانه‌های بزرگ نخود", ps: "د غټو چڼو تخم" }
  },
  {
    name: "Desi Chickpeas",
    hsCode: "071320.20",
    type: "Dry Pulses",
    detail: "Small chickpea seeds",
    nameI18n: { en: "Desi Chickpeas", ur: "دیسی چنے", ar: "حمص بلدي", fa: "نخود سیاه / بومی", ps: "وطني چڼې" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Small chickpea seeds", ur: "چھوٹے دیسی چنے کے بیج", ar: "بذور الحمص الصغيرة", fa: "دانه‌های کوچک نخود", ps: "د وړو چڼو تخم" }
  },
  {
    name: "Mung Beans",
    hsCode: "071331",
    type: "Dry Pulses",
    detail: "Mung plant seeds",
    nameI18n: { en: "Mung Beans", ur: "مونگ دال", ar: "فول المونج", fa: "ماش", ps: "ماښ" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Mung plant seeds", ur: "مونگ کے پودے کے بیج", ar: "بذور نبات الماش", fa: "بذر گیاه ماش", ps: "د ماښو د بوټي تخم" }
  },
  {
    name: "Urad / Black Gram",
    hsCode: "071331.10",
    type: "Dry Pulses",
    detail: "Black gram seeds",
    nameI18n: { en: "Urad / Black Gram", ur: "ماش / اڑد دال", ar: "فول الماش الأسود", fa: "ماش سیاه / اوراد", ps: "توره ماش" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Black gram seeds", ur: "کالی دال کے بیج", ar: "بذور الماش الأسود", fa: "دانه‌های ماش سیاه", ps: "د تورې ماښې تخم" }
  },
  {
    name: "Adzuki Beans",
    hsCode: "071332",
    type: "Dry Pulses",
    detail: "Adzuki plant seeds",
    nameI18n: { en: "Adzuki Beans", ur: "ایڈزوکی لوبیا", ar: "فاصولياء أدزوكي", fa: "لوبیا آزوکی", ps: "ادزوکی لوبیا" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Adzuki plant seeds", ur: "ایڈزوکی پودے کے بیج", ar: "بذور نبات الأدزوكي", fa: "بذر گیاه آزوکی", ps: "د ادزوکی بوټي تخم" }
  },
  {
    name: "Kidney Beans",
    hsCode: "071333",
    type: "Dry Pulses",
    detail: "Bean plant seeds",
    nameI18n: { en: "Kidney Beans", ur: "لوبیا", ar: "فاصولياء حمراء", fa: "لوبیا قرمز", ps: "لوبیا" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Bean plant seeds", ur: "لوبیا کے پودے کے بیج", ar: "بذور نبات الفاصولياء", fa: "بذر گیاه لوبیا", ps: "د لوبیا د بوټي تخم" }
  },
  {
    name: "Red Kidney Beans",
    hsCode: "071333.10",
    type: "Dry Pulses",
    detail: "Red bean seeds",
    nameI18n: { en: "Red Kidney Beans", ur: "سرخ لوبیا", ar: "فاصولياء حمراء داكنة", fa: "لوبیا قرمز دانه درشت", ps: "سره لوبیا" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Red bean seeds", ur: "سرخ لوبیا کے بیج", ar: "بذور الفاصولياء الحمراء", fa: "دانه‌های لوبیا قرمز", ps: "د سرې لوبیا تخم" }
  },
  {
    name: "White Kidney Beans",
    hsCode: "071333.20",
    type: "Dry Pulses",
    detail: "White bean seeds",
    nameI18n: { en: "White Kidney Beans", ur: "سفید لوبیا", ar: "فاصولياء بيضاء", fa: "لوبیا سفید", ps: "سپینه لوبیا" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "White bean seeds", ur: "سفید لوبیا کے بیج", ar: "بذور الفاصولياء البيضاء", fa: "دانه‌های لوبیا سفید", ps: "د سپینې لوبیا تخم" }
  },
  {
    name: "Navy Beans",
    hsCode: "071333.30",
    type: "Dry Pulses",
    detail: "Small white bean seeds",
    nameI18n: { en: "Navy Beans", ur: "چھوٹی سفید لوبیا", ar: "فاصولياء بحرية بيضاء", fa: "لوبیا سفید ریز", ps: "کوچنۍ سپینه لوبیا" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Small white bean seeds", ur: "چھوٹی سفید لوبیا کے بیج", ar: "بذور الفاصولياء البيضاء الصغيرة", fa: "دانه‌های لوبیا سفید کوچک", ps: "د کوچنۍ سپینې لوبیا تخم" }
  },
  {
    name: "Pinto Beans",
    hsCode: "071339",
    type: "Dry Pulses",
    detail: "Pinto bean seeds",
    nameI18n: { en: "Pinto Beans", ur: "چتکبری لوبیا", ar: "فاصولياء بينتو", fa: "لوبیا چیتی", ps: "پینټو لوبیا" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Pinto bean seeds", ur: "چتکبری لوبیا کے بیج", ar: "بذور فاصولياء بينتو", fa: "دانه‌های لوبیا چیتی", ps: "د پینټو لوبیا تخم" }
  },
  {
    name: "Black Beans",
    hsCode: "071339.10",
    type: "Dry Pulses",
    detail: "Black bean seeds",
    nameI18n: { en: "Black Beans", ur: "سیاہ لوبیا", ar: "فاصولياء سوداء", fa: "لوبیا سیاه", ps: "توره لوبیا" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Black bean seeds", ur: "کالی لوبیا کے بیج", ar: "بذور الفاصولياء السوداء", fa: "دانه‌های لوبیا سیاه", ps: "د تورې لوبیا تخم" }
  },
  {
    name: "Lima Beans",
    hsCode: "071339.20",
    type: "Dry Pulses",
    detail: "Lima bean seeds",
    nameI18n: { en: "Lima Beans", ur: "لیما لوبیا", ar: "فاصولياء ليما", fa: "لوبیا لیما", ps: "لیما لوبیا" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Lima bean seeds", ur: "لیما بین کے بیج", ar: "بذور فاصولياء ليما", fa: "دانه‌های لوبیا لیما", ps: "د لیما لوبیا تخم" }
  },
  {
    name: "Cowpeas",
    hsCode: "071335",
    type: "Dry Pulses",
    detail: "Cowpea plant seeds",
    nameI18n: { en: "Cowpeas", ur: "روانگی / چولی", ar: "لوبياء", fa: "لوبیا چشم‌بلبلی", ps: "چولۍ" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Cowpea plant seeds", ur: "روانگی کے پودے کے بیج", ar: "بذور نبات اللوبياء", fa: "بذر گیاه لوبیا چشم‌بلبلی", ps: "د چولۍ د بوټي تخم" }
  },
  {
    name: "Black-Eyed Peas",
    hsCode: "071335.10",
    type: "Dry Pulses",
    detail: "Cowpea seeds",
    nameI18n: { en: "Black-Eyed Peas", ur: "بلیک آئیڈ لوبیا", ar: "لوبياء سوداء العين", fa: "لوبیا چشم‌بلبلی دانه‌دار", ps: "توره سترګه چولۍ" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Cowpea seeds", ur: "چولی کے بیج", ar: "بذور اللوبياء", fa: "دانه‌های لوبیا چشم‌بلبلی", ps: "د چولۍ تخم" }
  },
  {
    name: "Lentils",
    hsCode: "071340",
    type: "Dry Pulses",
    detail: "Lentil plant seeds",
    nameI18n: { en: "Lentils", ur: "مسور دال", ar: "عدس", fa: "عدس", ps: "نسک" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Lentil plant seeds", ur: "مسور کے پودے کے بیج", ar: "بذور نبات العدس", fa: "بذر گیاه عدس", ps: "د نسکو د بوټي تخم" }
  },
  {
    name: "Red Lentils",
    hsCode: "071340.10",
    type: "Dry Pulses",
    detail: "Red lentil seeds",
    nameI18n: { en: "Red Lentils", ur: "لال مسور", ar: "عدس أحمر", fa: "عدس قرمز / دال عدس", ps: "سره نسک" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Red lentil seeds", ur: "لال مسور کے بیج", ar: "بذور العدس الأحمر", fa: "دانه‌های عدس قرمز", ps: "د سرو نسکو تخم" }
  },
  {
    name: "Green Lentils",
    hsCode: "071340.20",
    type: "Dry Pulses",
    detail: "Green lentil seeds",
    nameI18n: { en: "Green Lentils", ur: "ہری مسور", ar: "عدس أخضر", fa: "عدس سبز", ps: "شنه نسک" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Green lentil seeds", ur: "ہری مسور کے بیج", ar: "بذور العدس الأخضر", fa: "دانه‌های عدس سبز", ps: "د شنو نسکو تخم" }
  },
  {
    name: "Brown Lentils",
    hsCode: "071340.30",
    type: "Dry Pulses",
    detail: "Brown lentil seeds",
    nameI18n: { en: "Brown Lentils", ur: "براؤن مسور", ar: "عدس بني", fa: "عدس قهوه‌ای", ps: "نسواري نسک" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Brown lentil seeds", ur: "براؤن مسور کے بیج", ar: "بذور العدس البني", fa: "دانه‌های عدس قهوه‌ای", ps: "د نسواري نسکو تخم" }
  },
  {
    name: "Yellow Lentils",
    hsCode: "071340.40",
    type: "Dry Pulses",
    detail: "Yellow lentil seeds",
    nameI18n: { en: "Yellow Lentils", ur: "پیلی مسور", ar: "عدس أصفر", fa: "عدس زرد", ps: "ژېړ نسک" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Yellow lentil seeds", ur: "پیلی مسور کے بیج", ar: "بذور العدس الأصفر", fa: "دانه‌های عدس زرد", ps: "د ژېړو نسکو تخم" }
  },
  {
    name: "Black Lentils",
    hsCode: "071340.50",
    type: "Dry Pulses",
    detail: "Black lentil seeds",
    nameI18n: { en: "Black Lentils", ur: "کالی مسور", ar: "عدس أسود", fa: "عدس سیاه / بلک لنتل", ps: "تور نسک" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Black lentil seeds", ur: "کالی مسور کے بیج", ar: "بذور العدس الأسود", fa: "دانه‌های عدس سیاه", ps: "د تورو نسکو تخم" }
  },
  {
    name: "Broad / Fava Beans",
    hsCode: "071350",
    type: "Dry Pulses",
    detail: "Fava plant seeds",
    nameI18n: { en: "Broad / Fava Beans", ur: "باقلا / فاوا بینز", ar: "فول عريض / باقلاء", fa: "باقلا", ps: "باقلا" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Fava plant seeds", ur: "باقلا کے پودے کے بیج", ar: "بذور نبات الفول", fa: "بذر گیاه باقلا", ps: "د باقلا د بوټي تخم" }
  },
  {
    name: "Pigeon Peas / Toor",
    hsCode: "071360",
    type: "Dry Pulses",
    detail: "Pigeon pea seeds",
    nameI18n: { en: "Pigeon Peas / Toor", ur: "ارہر / تور دال", ar: "بازلاء الحمام / تور", fa: "نخود کفتری / تور", ps: "تور دال" },
    typeI18n: { en: "Dry Pulses", ur: "خشک دالیں", ar: "بقوليات جافة", fa: "حبوبات خشک", ps: "وچ دالونه" },
    detailI18n: { en: "Pigeon pea seeds", ur: "ارہر کے بیج", ar: "بذور بازلاء الحمام", fa: "دانه‌های نخود کفتری", ps: "د تور دال تخم" }
  },

  // ── 3. Roots & Tubers (9 items) ──
  {
    name: "Cassava",
    hsCode: "071410",
    type: "Dry Roots",
    detail: "Starchy plant root",
    nameI18n: { en: "Cassava", ur: "کساوا / سملو", ar: "كسافا", fa: "کاساوا", ps: "کساوا" },
    typeI18n: { en: "Dry Roots", ur: "خشک جڑیں", ar: "جذور جافة", fa: "ریشه‌های خشک", ps: "وچ بېخونه" },
    detailI18n: { en: "Starchy plant root", ur: "نشاستہ دار پودے کی جڑ", ar: "جذر نبات نشوي", fa: "ریشه گیاه نشاسته‌ای", ps: "د نشایسته لرونکي بوټي بېخ" }
  },
  {
    name: "Sweet Potato",
    hsCode: "071420",
    type: "Dry Roots",
    detail: "Sweet storage root",
    nameI18n: { en: "Sweet Potato", ur: "شکرقندی", ar: "بطاطا حلوة", fa: "سیب‌زمینی شیرین", ps: "خواږه کچالو" },
    typeI18n: { en: "Dry Roots", ur: "خشک جڑیں", ar: "جذور جافة", fa: "ریشه‌های خشک", ps: "وچ بېخونه" },
    detailI18n: { en: "Sweet storage root", ur: "میٹھی خوراکی جڑ", ar: "جذر تخزين حلو", fa: "ریشه ذخیره‌ای شیرین", ps: "خواږه زېرمه شوي بېخ" }
  },
  {
    name: "Yam",
    hsCode: "071430",
    type: "Dry Roots",
    detail: "Underground tuber",
    nameI18n: { en: "Yam", ur: "رتالو / یام", ar: "يام", fa: "سیب‌زمینی هندی / یام", ps: "رتالو / یام" },
    typeI18n: { en: "Dry Roots", ur: "خشک جڑیں", ar: "جذور جافة", fa: "ریشه‌های خشک", ps: "وچ بېخونه" },
    detailI18n: { en: "Underground tuber", ur: "زیر زمین کندھ", ar: "درنة تحت الأرض", fa: "غده زیرزمینی", ps: "تر ځمکې لاندې تیوبر" }
  },
  {
    name: "Taro",
    hsCode: "071440",
    type: "Dry Roots",
    detail: "Underground corm",
    nameI18n: { en: "Taro", ur: "اروی", ar: "قلقاس", fa: "تارو / گوش‌فیلی", ps: "اروي" },
    typeI18n: { en: "Dry Roots", ur: "خشک جڑیں", ar: "جذور جافة", fa: "ریشه‌های خشک", ps: "وچ بېخونه" },
    detailI18n: { en: "Underground corm", ur: "زیر زمین گانٹھ", ar: "كورمة تحت الأرض", fa: "ساقه پیازی زیرزمینی", ps: "تر ځمکې لاندې غوټه" }
  },
  {
    name: "Yautia / Cocoyam",
    hsCode: "071450",
    type: "Dry Roots",
    detail: "Underground corm",
    nameI18n: { en: "Yautia / Cocoyam", ur: "یاوتیا / کوکو یام", ar: "ياوتيا / كوكويام", fa: "یائوتیا / کوکویام", ps: "یاوتیا / کوکویام" },
    typeI18n: { en: "Dry Roots", ur: "خشک جڑیں", ar: "جذور جافة", fa: "ریشه‌های خشک", ps: "وچ بېخونه" },
    detailI18n: { en: "Underground corm", ur: "زیر زمین گانٹھ", ar: "كورمة تحت الأرض", fa: "ساقه پیازی زیرزمینی", ps: "تر ځمکې لاندې غوټه" }
  },
  {
    name: "Arrowroot",
    hsCode: "071490",
    type: "Dry Roots",
    detail: "Starchy rhizome",
    nameI18n: { en: "Arrowroot", ur: "اراروٹ", ar: "أروروت", fa: "مارانتا / نشاسته اروت", ps: "اراروت" },
    typeI18n: { en: "Dry Roots", ur: "خشک جڑیں", ar: "جذور جافة", fa: "ریشه‌های خشک", ps: "وچ بېخونه" },
    detailI18n: { en: "Starchy rhizome", ur: "نشاستہ دار تنے کی جڑ", ar: "جذمور نشوي", fa: "ریزوم نشاسته‌ای", ps: "نشایسته لرونکی ریزوم" }
  },
  {
    name: "Jerusalem Artichoke",
    hsCode: "071490.10",
    type: "Dry Roots",
    detail: "Underground tuber",
    nameI18n: { en: "Jerusalem Artichoke", ur: "یروشلم آرٹچوک / ہاتھیکندھ", ar: "خرشوف القدس", fa: "سیب‌زمینی ترش", ps: "د بیت المقدس آرټیچوک" },
    typeI18n: { en: "Dry Roots", ur: "خشک جڑیں", ar: "جذور جافة", fa: "ریشه‌های خشک", ps: "وچ بېخونه" },
    detailI18n: { en: "Underground tuber", ur: "زیر زمین کندھ", ar: "درنة تحت الأرض", fa: "غده زیرزمینی", ps: "تر ځمکې لاندې تیوبر" }
  },
  {
    name: "Salep Root",
    hsCode: "071490.20",
    type: "Dry Roots",
    detail: "Orchid tuber",
    nameI18n: { en: "Salep Root", ur: "ثعلب مصری", ar: "جذر السحلب", fa: "ریشه ثعلب", ps: "د ثعلب بېخ" },
    typeI18n: { en: "Dry Roots", ur: "خشک جڑیں", ar: "جذور جافة", fa: "ریشه‌های خشک", ps: "وچ بېخونه" },
    detailI18n: { en: "Orchid tuber", ur: "آرکڈ پھول کا کندھ", ar: "درنة الأوركيد", fa: "غده گل ارکیده", ps: "د ارکید د ګل غوټه" }
  },
  {
    name: "Other Roots & Tubers",
    hsCode: "071490.90",
    type: "Dry Roots",
    detail: "Other edible roots",
    nameI18n: { en: "Other Roots & Tubers", ur: "دیگر جڑیں اور کندھ", ar: "جذور ودرنات أخرى", fa: "سایر ریشه‌ها و غده‌ها", ps: "نور بېخونه او تیوبرونه" },
    typeI18n: { en: "Dry Roots", ur: "خشک جڑیں", ar: "جذور جافة", fa: "ریشه‌های خشک", ps: "وچ بېخونه" },
    detailI18n: { en: "Other edible roots", ur: "دیگر کھانے کے قابل جڑیں", ar: "جذور صالحة للأكل أخرى", fa: "سایر ریشه‌های خوراکی", ps: "نور خوړل کېدونکي بېخونه" }
  },

  // ── 4. Spices / Garam Masala (40 items) ──
  {
    name: "Black Pepper Whole",
    hsCode: "090411",
    type: "Dry Spice",
    detail: "Pepper vine dried fruit",
    nameI18n: { en: "Black Pepper Whole", ur: "کالی مرچ ثابت", ar: "فلفل أسود حب", fa: "فلفل سیاه درسته", ps: "تور مرچ روغ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Pepper vine dried fruit", ur: "مرچ کی بیل کا خشک پھل", ar: "ثمار مجففة لنبات الفلفل", fa: "میوه خشک شده بوته فلفل", ps: "د مرچو د بوټي وچه میوه" }
  },
  {
    name: "Black Pepper Ground",
    hsCode: "090412",
    type: "Dry Spice",
    detail: "Ground pepper fruit",
    nameI18n: { en: "Black Pepper Ground", ur: "کالی مرچ پسی ہوئی", ar: "فلفل أسود مطحون", fa: "فلفل سیاه پودر", ps: "میده شوي تور مرچ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground pepper fruit", ur: "پسی ہوئی کالی مرچ", ar: "ثمار فلفل مطحونة", fa: "میوه فلفل آسیاب شده", ps: "میده شوې د مرچو میوه" }
  },
  {
    name: "Red Chilli Whole",
    hsCode: "090421",
    type: "Dry Spice",
    detail: "Dried chilli fruit",
    nameI18n: { en: "Red Chilli Whole", ur: "لال مرچ ثابت", ar: "فلفل أحمر حار حب", fa: "فلفل قرمز درسته", ps: "سره مرچ روغ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Dried chilli fruit", ur: "خشک لال مرچ", ar: "ثمار الفلفل الحار المجفف", fa: "میوه فلفل تند خشک شده", ps: "د تودو سرو مرچو وچه میوه" }
  },
  {
    name: "Red Chilli Powder",
    hsCode: "090422",
    type: "Dry Spice",
    detail: "Ground chilli fruit",
    nameI18n: { en: "Red Chilli Powder", ur: "لال مرچ پسی ہوئی", ar: "فلفل أحمر حار مطحون", fa: "پودر فلفل قرمز", ps: "میده شوي سره مرچ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground chilli fruit", ur: "پسی ہوئی سرخ مرچ", ar: "ثمار فلفل حار مطحونة", fa: "میوه فلفل قرمز آسیاب شده", ps: "میده شوي سره مرچ" }
  },
  {
    name: "Paprika Whole",
    hsCode: "090421.10",
    type: "Dry Spice",
    detail: "Dried Capsicum fruit",
    nameI18n: { en: "Paprika Whole", ur: "شملہ / پپریکا مرچ ثابت", ar: "بابريكا حب", fa: "پاپریکا درسته", ps: "پاپریکا روغ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Dried Capsicum fruit", ur: "خشک کیپسیکم پھل", ar: "ثمار الفليفلة المجففة", fa: "میوه کپسیکوم خشک شده", ps: "د کیپسیکم وچه میوه" }
  },
  {
    name: "Paprika Powder",
    hsCode: "090422.10",
    type: "Dry Spice",
    detail: "Ground Capsicum fruit",
    nameI18n: { en: "Paprika Powder", ur: "پپریکا پاؤڈر", ar: "مسحوق البابريكا", fa: "پودر پاپریکا", ps: "د پاپریکا پوډر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground Capsicum fruit", ur: "پسی ہوئی شملہ مرچ", ar: "ثمار فليفلة مطحونة", fa: "میوه کپسیکوم آسیاب شده", ps: "میده شوې کیپسیکم میوه" }
  },
  {
    name: "Cinnamon Whole",
    hsCode: "090611",
    type: "Dry Spice",
    detail: "Cinnamon tree bark",
    nameI18n: { en: "Cinnamon Whole", ur: "دارچینی ثابت", ar: "قرفة أعواد", fa: "دارچین چوب", ps: "دارچیني روغه" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Cinnamon tree bark", ur: "دارچینی کے درخت کی چھال", ar: "لحاء شجرة القرفة", fa: "پوست درخت دارچین", ps: "د دارچینۍ د ونې پوټکی" }
  },
  {
    name: "Cinnamon Powder",
    hsCode: "090620",
    type: "Dry Spice",
    detail: "Ground tree bark",
    nameI18n: { en: "Cinnamon Powder", ur: "دارچینی پاؤڈر", ar: "قرفة مطحونة", fa: "پودر دارچین", ps: "د دارچینۍ پوډر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground tree bark", ur: "پسی ہوئی دارچینی", ar: "لحاء شجرة مطحون", fa: "پوست درخت آسیاب شده", ps: "میده شوی د ونې پوټکی" }
  },
  {
    name: "Cloves Whole",
    hsCode: "090710",
    type: "Dry Spice",
    detail: "Dried flower buds",
    nameI18n: { en: "Cloves Whole", ur: "لونگ ثابت", ar: "قرنفل حب", fa: "میخک درسته", ps: "لونګ روغ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Dried flower buds", ur: "خشک پھولوں کی کلیاں", ar: "براعم أزهار مجففة", fa: "غنچه‌های گل خشک شده", ps: "د ګلانو وچې غوټۍ" }
  },
  {
    name: "Cloves Ground",
    hsCode: "090720",
    type: "Dry Spice",
    detail: "Ground clove buds",
    nameI18n: { en: "Cloves Ground", ur: "لونگ پاؤڈر", ar: "قرنفل مطحون", fa: "پودر میخک", ps: "میده شوي لونګ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground clove buds", ur: "پسی ہوئی لونگ کی کلیاں", ar: "براعم قرنفل مطحونة", fa: "غنچه‌های میخک آسیاب شده", ps: "میده شوې د لونګو غوټۍ" }
  },
  {
    name: "Nutmeg Whole",
    hsCode: "090811",
    type: "Dry Spice",
    detail: "Nutmeg tree seed",
    nameI18n: { en: "Nutmeg Whole", ur: "جائفل ثابت", ar: "جوزة الطيب حب", fa: "جوز هندی درسته", ps: "جایفل روغ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Nutmeg tree seed", ur: "جائفل کے درخت کا بیج", ar: "بذرة شجرة جوزة الطيب", fa: "بذر درخت جوز هندی", ps: "د جایفل د ونې زړی" }
  },
  {
    name: "Nutmeg Ground",
    hsCode: "090812",
    type: "Dry Spice",
    detail: "Ground nutmeg seed",
    nameI18n: { en: "Nutmeg Ground", ur: "جائفل پاؤڈر", ar: "جوزة الطيب مطحونة", fa: "پودر جوز هندی", ps: "میده شوی جایفل" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground nutmeg seed", ur: "پسا ہوا جائفل", ar: "بذور جوزة الطيب مطحونة", fa: "دانه جوز هندی آسیاب شده", ps: "میده شوی د جایفل زړی" }
  },
  {
    name: "Mace Whole",
    hsCode: "090821",
    type: "Dry Spice",
    detail: "Nutmeg seed covering",
    nameI18n: { en: "Mace Whole", ur: "جاوتری ثابت", ar: "بسباسة حب", fa: "اطراف جوز هندی / ماچیس درسته", ps: "جاوتري روغه" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Nutmeg seed covering", ur: "جائفل کے بیج کا خول", ar: "غلاف بذور جوزة الطيب", fa: "پوشش دانه جوز هندی", ps: "د جایفل د زړي پوښ" }
  },
  {
    name: "Mace Ground",
    hsCode: "090822",
    type: "Dry Spice",
    detail: "Ground seed covering",
    nameI18n: { en: "Mace Ground", ur: "جاوتری پاؤڈر", ar: "بسباسة مطحونة", fa: "پودر ماچیس", ps: "میده شوې جاوتري" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground seed covering", ur: "پسی ہوئی جاوتری", ar: "غلاف بذور مطحون", fa: "پوشش دانه آسیاب شده", ps: "میده شوی د زړي پوښ" }
  },
  {
    name: "Cardamom Whole",
    hsCode: "090831",
    type: "Dry Spice",
    detail: "Cardamom plant pods",
    nameI18n: { en: "Cardamom Whole", ur: "چھوٹی الائچی ثابت", ar: "هيل حب", fa: "هل درسته", ps: "شنه الائچي روغه" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Cardamom plant pods", ur: "الائچی کے پودے کی پھلیاں", ar: "قرون نبات الهيل", fa: "غلاف‌های گیاه هل", ps: "د الائچۍ د بوټي غوټۍ" }
  },
  {
    name: "Cardamom Ground",
    hsCode: "090832",
    type: "Dry Spice",
    detail: "Ground cardamom pods",
    nameI18n: { en: "Cardamom Ground", ur: "الائچی پاؤڈر", ar: "هيل مطحون", fa: "پودر هل", ps: "میده شوې الائچي" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground cardamom pods", ur: "پسی ہوئی الائچی", ar: "قرون هيل مطحونة", fa: "غلاف‌های هل آسیاب شده", ps: "میده شوې د الائچۍ غوټۍ" }
  },
  {
    name: "Coriander Seeds",
    hsCode: "090921",
    type: "Dry Spice",
    detail: "Coriander plant seeds",
    nameI18n: { en: "Coriander Seeds", ur: "خشک دھنیا ثابت", ar: "كزبرة حب", fa: "تخم گشنیز درسته", ps: "د کوتنۍ زړي" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Coriander plant seeds", ur: "دھنیا کے پودے کے بیج", ar: "بذور نبات الكزبرة", fa: "بذر گیاه گشنیز", ps: "د کوتنۍ د بوټي تخم" }
  },
  {
    name: "Coriander Powder",
    hsCode: "090922",
    type: "Dry Spice",
    detail: "Ground coriander seeds",
    nameI18n: { en: "Coriander Powder", ur: "خشک دھنیا پاؤڈر", ar: "كزبرة مطحونة", fa: "پودر گشنیز", ps: "د کوتنۍ پوډر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground coriander seeds", ur: "پسا ہوا دھنیا", ar: "بذور كزبرة مطحونة", fa: "تخم گشنیز آسیاب شده", ps: "میده شوي د کوتنۍ زړي" }
  },
  {
    name: "Cumin Seeds",
    hsCode: "090931",
    type: "Dry Spice",
    detail: "Cumin plant seeds",
    nameI18n: { en: "Cumin Seeds", ur: "سفید زیرہ ثابت", ar: "كمون حب", fa: "زیره سبز درسته", ps: "سپین زیری روغ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Cumin plant seeds", ur: "زیرہ کے پودے کے بیج", ar: "بذور نبات الكمون", fa: "بذر گیاه زیره", ps: "د زیري د بوټي تخم" }
  },
  {
    name: "Cumin Powder",
    hsCode: "090932",
    type: "Dry Spice",
    detail: "Ground cumin seeds",
    nameI18n: { en: "Cumin Powder", ur: "زیرہ پاؤڈر", ar: "كمون مطحون", fa: "پودر زیره", ps: "د زیري پوډر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground cumin seeds", ur: "پسا ہوا زیرہ", ar: "بذور كمون مطحونة", fa: "تخم زیره آسیاب شده", ps: "میده شوی د زیري تخم" }
  },
  {
    name: "Fennel Seeds",
    hsCode: "090961",
    type: "Dry Spice",
    detail: "Fennel plant seeds",
    nameI18n: { en: "Fennel Seeds", ur: "سونف ثابت", ar: "شمر حب", fa: "رازیانه درسته", ps: "وږه / بادیان روغ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Fennel plant seeds", ur: "سونف کے پودے کے بیج", ar: "بذور نبات الشمر", fa: "بذر گیاه رازیانه", ps: "د بادیانو د بوټي تخم" }
  },
  {
    name: "Fennel Powder",
    hsCode: "090962",
    type: "Dry Spice",
    detail: "Ground fennel seeds",
    nameI18n: { en: "Fennel Powder", ur: "سونف پاؤڈر", ar: "شمر مطحون", fa: "پودر رازیانه", ps: "د بادیانو پوډر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground fennel seeds", ur: "پسی ہوئی سونف", ar: "بذور شمر مطحونة", fa: "تخم رازیانه آسیاب شده", ps: "میده شوي بادیان" }
  },
  {
    name: "Anise Seeds",
    hsCode: "090961.10",
    type: "Dry Spice",
    detail: "Anise plant seeds",
    nameI18n: { en: "Anise Seeds", ur: "انیسون کے بیج", ar: "يانسون حب", fa: "انیسون درسته", ps: "د انیسون زړي" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Anise plant seeds", ur: "انیسون پودے کے بیج", ar: "بذور نبات اليانسون", fa: "بذر گیاه انیسون", ps: "د انیسون بوټي تخم" }
  },
  {
    name: "Anise Powder",
    hsCode: "090962.10",
    type: "Dry Spice",
    detail: "Ground anise seeds",
    nameI18n: { en: "Anise Powder", ur: "انیسون پاؤڈر", ar: "يانسون مطحون", fa: "پودر انیسون", ps: "د انیسون پوډر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground anise seeds", ur: "پسا ہوا انیسون", ar: "بذور يانسون مطحونة", fa: "تخم انیسون آسیاب شده", ps: "میده شوی د انیسون تخم" }
  },
  {
    name: "Star Anise",
    hsCode: "090961.20",
    type: "Dry Spice",
    detail: "Dried star-shaped fruit",
    nameI18n: { en: "Star Anise", ur: "بادیان خطائی", ar: "يانسون نجمي", fa: "انیسون ستاره‌ای", ps: "ستوری بادیان" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Dried star-shaped fruit", ur: "ستارے کی شکل کا خشک پھل", ar: "ثمار مجففة على شكل نجمة", fa: "میوه ستاره‌ای شکل خشک شده", ps: "د ستوري په بڼه وچه میوه" }
  },
  {
    name: "Star Anise Powder",
    hsCode: "090962.20",
    type: "Dry Spice",
    detail: "Ground star anise",
    nameI18n: { en: "Star Anise Powder", ur: "بادیان خطائی پاؤڈر", ar: "يانسون نجمي مطحون", fa: "پودر انیسون ستاره‌ای", ps: "د ستوري بادیانو پوډر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground star anise", ur: "پسا ہوا بادیان خطائی", ar: "يانسون نجمي مطحون", fa: "انیسون ستاره‌ای آسیاب شده", ps: "میده شوی ستوری بادیان" }
  },
  {
    name: "Caraway Seeds",
    hsCode: "090961.30",
    type: "Dry Spice",
    detail: "Caraway plant seeds",
    nameI18n: { en: "Caraway Seeds", ur: "شاہ زیرہ / سیاہ زیرہ", ar: "كراوية حب", fa: "زیره سیاه / کرویه", ps: "توره زیره" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Caraway plant seeds", ur: "سیاہ زیرہ کے بیج", ar: "بذور نبات الكراوية", fa: "بذر گیاه کرویه", ps: "د تورې زیرې د بوټي تخم" }
  },
  {
    name: "Caraway Powder",
    hsCode: "090962.30",
    type: "Dry Spice",
    detail: "Ground caraway seeds",
    nameI18n: { en: "Caraway Powder", ur: "سیاہ زیرہ پاؤڈر", ar: "كراوية مطحونة", fa: "پودر کرویه", ps: "د تورې زیرې پوډر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground caraway seeds", ur: "پسا ہوا سیاہ زیرہ", ar: "بذور كراوية مطحونة", fa: "تخم کرویه آسیاب شده", ps: "میده شوې توره زیره" }
  },
  {
    name: "Juniper Berries",
    hsCode: "090961.40",
    type: "Dry Spice",
    detail: "Juniper shrub berries",
    nameI18n: { en: "Juniper Berries", ur: "ہوبیر / جونیپر بیریاں", ar: "توت العرعر", fa: "میوه ارس / ارعر", ps: "د جونیپر دانې" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Juniper shrub berries", ur: "جونیپر جھاڑی کے پھل", ar: "ثمار شجيرات العرعر", fa: "توت‌های درختچه ارس", ps: "د ارعر بوټي میوه" }
  },
  {
    name: "Ginger Whole / Dry",
    hsCode: "091011",
    type: "Dry Spice",
    detail: "Dried ginger rhizome",
    nameI18n: { en: "Ginger Whole / Dry", ur: "سونٹھ / خشک ادرک", ar: "زنجبيل جاف كامل", fa: "زنجبیل خشک درسته", ps: "وچ زنجبیل / سونټ" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Dried ginger rhizome", ur: "خشک ادرک کی گانٹھ", ar: "جذمور زنجبيل مجفف", fa: "ریزوم زنجبیل خشک شده", ps: "د وچ زنجبیل غوټه" }
  },
  {
    name: "Ginger Powder",
    hsCode: "091012",
    type: "Dry Spice",
    detail: "Ground ginger rhizome",
    nameI18n: { en: "Ginger Powder", ur: "سونٹھ پاؤڈر", ar: "زنجبيل مطحون", fa: "پودر زنجبیل", ps: "د زنجبیل پوډر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground ginger rhizome", ur: "پسی ہوئی سونٹھ", ar: "جذمور زنجبيل مطحون", fa: "ریزوم زنجبیل آسیاب شده", ps: "میده شوی زنجبیل" }
  },
  {
    name: "Saffron",
    hsCode: "091020",
    type: "Dry Spice",
    detail: "Crocus flower stigma",
    nameI18n: { en: "Saffron", ur: "زعفران", ar: "زعفران", fa: "زعفران", ps: "زعفران" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Crocus flower stigma", ur: "زعفران کے پھول کے تار", ar: "مياسم زهرة الزعفران", fa: "کلاله گل زعفران", ps: "د زعفرانو د ګل تاری" }
  },
  {
    name: "Turmeric Whole",
    hsCode: "091030",
    type: "Dry Spice",
    detail: "Turmeric rhizome",
    nameI18n: { en: "Turmeric Whole", ur: "ہلدی ثابت", ar: "كركم حب", fa: "زردچوبه درسته", ps: "کورکمه روغه" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Turmeric rhizome", ur: "ہلدی کی خشک گانٹھ", ar: "جذمور الكركم", fa: "ریزوم زردچوبه", ps: "د کورکمې غوټه" }
  },
  {
    name: "Turmeric Powder",
    hsCode: "091030.10",
    type: "Dry Spice",
    detail: "Ground turmeric rhizome",
    nameI18n: { en: "Turmeric Powder", ur: "ہلدی پاؤڈر", ar: "كركم مطحون", fa: "پودر زردچوبه", ps: "د کورکمې پوډر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Ground turmeric rhizome", ur: "پسی ہوئی ہلدی", ar: "جذمور كركم مطحون", fa: "ریزوم زردچوبه آسیاب شده", ps: "میده شوې کورکمه" }
  },
  {
    name: "Thyme",
    hsCode: "091099",
    type: "Dry Spice",
    detail: "Dried herb leaves",
    nameI18n: { en: "Thyme", ur: "آویشن / تھائم", ar: "زعتر جاف", fa: "آویشن خشک", ps: "شینکی / زعتر" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Dried herb leaves", ur: "خشک جڑی بوٹی کے پتے", ar: "أوراق أعشاب مجففة", fa: "برگ‌های گیاهی خشک", ps: "د وچ بوټي پاڼې" }
  },
  {
    name: "Bay Leaves",
    hsCode: "091099.10",
    type: "Dry Spice",
    detail: "Laurel tree leaves",
    nameI18n: { en: "Bay Leaves", ur: "تیز پات", ar: "ورق غار", fa: "برگ بو", ps: "تیز پات" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Laurel tree leaves", ur: "تیز پات کے درخت کے پتے", ar: "أوراق شجرة الغار", fa: "برگ‌های درخت غار", ps: "د تیزپات د ونې پاڼې" }
  },
  {
    name: "Curry Spice Mix",
    hsCode: "091091",
    type: "Dry Spice Mix",
    detail: "Mixed dried spices",
    nameI18n: { en: "Curry Spice Mix", ur: "کری پاؤڈر مکس", ar: "خلطة بهارات كاري", fa: "ادویه مخلوط کاری", ps: "د کړي مصالحو مخلوط" },
    typeI18n: { en: "Dry Spice Mix", ur: "مخلوط خشک مصالحہ", ar: "خلطة توابل جافة", fa: "مخلوط ادویه خشک", ps: "د وچو مصالحو مخلوط" },
    detailI18n: { en: "Mixed dried spices", ur: "مخلوط خشک مصالحہ جات", ar: "توابل مجففة مشكلة", fa: "مخلوط ادویه‌های خشک", ps: "ګډې شوې وچې مصالحې" }
  },
  {
    name: "Garam Masala Mix",
    hsCode: "091091.10",
    type: "Dry Spice Mix",
    detail: "Mixed whole/ground spices",
    nameI18n: { en: "Garam Masala Mix", ur: "گرم مصالحہ مکس", ar: "خلطة جارام ماسالا", fa: "ادویه مخلوط گرم ماسالا", ps: "د ګرم مصالحې مخلوط" },
    typeI18n: { en: "Dry Spice Mix", ur: "مخلوط خشک مصالحہ", ar: "خلطة توابل جافة", fa: "مخلوط ادویه خشک", ps: "د وچو مصالحو مخلوط" },
    detailI18n: { en: "Mixed whole/ground spices", ur: "ثابت اور پسے ہوئے مصالحہ جات", ar: "توابل مشكلة كاملة ومطحونة", fa: "مخلوط ادویه‌های درسته و پودر", ps: "ګډې شوې روغې او میده مصالحې" }
  },
  {
    name: "Other Mixed Spices",
    hsCode: "091091.90",
    type: "Dry Spice Mix",
    detail: "Mixed spices",
    nameI18n: { en: "Other Mixed Spices", ur: "دیگر مخلوط مصالحہ جات", ar: "توابل مشكلة أخرى", fa: "سایر ادویه‌های مخلوط", ps: "نورې مخلوطې مصالحې" },
    typeI18n: { en: "Dry Spice Mix", ur: "مخلوط خشک مصالحہ", ar: "خلطة توابل جافة", fa: "مخلوط ادویه خشک", ps: "د وچو مصالحو مخلوط" },
    detailI18n: { en: "Mixed spices", ur: "دیگر مکس مصالحے", ar: "توابل مشكلة", fa: "ادویه‌های مخلوط", ps: "مخلوطې مصالحې" }
  },
  {
    name: "Other Single Spice",
    hsCode: "091099.90",
    type: "Dry Spice",
    detail: "Other dried spice",
    nameI18n: { en: "Other Single Spice", ur: "دیگر واحد مصالحہ", ar: "توابل مفردة أخرى", fa: "سایر ادویه‌های تکی", ps: "نورې جلا مصالحې" },
    typeI18n: { en: "Dry Spice", ur: "خشک مصالحہ", ar: "توابل جافة", fa: "ادویه خشک", ps: "وچ مصالحې" },
    detailI18n: { en: "Other dried spice", ur: "دیگر خشک مصالحہ", ar: "توابل مجففة أخرى", fa: "سایر ادویه خشک", ps: "نورې وچې مصالحې" }
  }
];

async function seedGoods() {
  console.log("=================================================================");
  console.log(` POPULATING 99 GOODS MASTER RECORDS WITH 5-LANGUAGE TRANSLATIONS`);
  console.log(` Target DB: ${dbUrl.replace(/:[^:@]+@/, ":***@")}`);
  console.log("=================================================================\n");

  // 1. Pre-load all existing goods in memory
  console.log("Pre-loading existing goods, translations, and dictionary entries...");
  const existingGoods = await sql`
    SELECT id, lower(trim(goods_name)) AS name_lower, chs_code
    FROM public.goods
    WHERE deleted_at IS NULL;
  `;
  const goodsMap = new Map(existingGoods.map((g) => [g.name_lower, g]));

  // 2. Pre-load all existing goods translations
  const existingTrans = await sql`
    SELECT id, record_id, field_name
    FROM public.record_translations
    WHERE record_table = 'goods' AND deleted_at IS NULL;
  `;
  const transMap = new Map(existingTrans.map((t) => [`${t.record_id}:${t.field_name}`, t.id]));

  // 3. Pre-load system dictionary
  const existingDict = await sql`
    SELECT id, lower(trim(coalesce(english_text, original_text))) AS term_lower
    FROM public.record_translations
    WHERE record_table = 'system_dictionary' AND deleted_at IS NULL;
  `;
  const dictMap = new Map(existingDict.map((d) => [d.term_lower, d.id]));
  console.log(`Loaded ${goodsMap.size} existing goods, ${transMap.size} translations, ${dictMap.size} dictionary terms.\n`);

  let insertedGoods = 0;
  let updatedGoods = 0;
  let totalTranslations = 0;

  let count = 0;
  for (const item of GOODS_DATA) {
    count++;
    // Clean HS Code: ensure numeric string without sub-decimal suffix
    const cleanHsCode = item.hsCode.replace(/\.\d+$/, "").trim();
    const nameLower = item.name.trim().toLowerCase();

    let goodsId;
    const existing = goodsMap.get(nameLower);

    if (existing) {
      goodsId = existing.id;
      await sql`
        UPDATE public.goods
        SET category = ${item.type},
            extra_details = ${item.detail},
            chs_code = ${cleanHsCode},
            updated_at = NOW()
        WHERE id = ${goodsId};
      `;
      updatedGoods++;
    } else {
      const inserted = await sql`
        INSERT INTO public.goods (
          id, goods_name, chs_code, category, extra_details,
          original_language_code, is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${item.name}, ${cleanHsCode}, ${item.type}, ${item.detail},
          'en', true, NOW(), NOW()
        )
        RETURNING id;
      `;
      goodsId = inserted[0].id;
      goodsMap.set(nameLower, { id: goodsId, name_lower: nameLower, chs_code: cleanHsCode });
      insertedGoods++;
    }

    // Upsert translations for goods_name, category, extra_details
    await fastUpsertTranslation(transMap, goodsId, "goods", "goods_name", item.name, item.nameI18n);
    totalTranslations++;

    await fastUpsertTranslation(transMap, goodsId, "goods", "category", item.type, item.typeI18n);
    totalTranslations++;

    await fastUpsertTranslation(transMap, goodsId, "goods", "extra_details", item.detail, item.detailI18n);
    totalTranslations++;

    // Upsert into system dictionary
    await fastUpsertDict(dictMap, item.name, item.nameI18n);
    await fastUpsertDict(dictMap, item.type, item.typeI18n);
    await fastUpsertDict(dictMap, item.detail, item.detailI18n);

    if (count % 15 === 0 || count === GOODS_DATA.length) {
      console.log(`[${count}/${GOODS_DATA.length}] Processed: ${item.name} (HS: ${cleanHsCode}, Category: ${item.type})`);
    }
  }

  console.log(`\n=================================================================`);
  console.log(`✅ Goods Seeding Complete:`);
  console.log(`   - Goods Inserted: ${insertedGoods}`);
  console.log(`   - Goods Updated: ${updatedGoods}`);
  console.log(`   - Total Processed: ${GOODS_DATA.length}`);
  console.log(`   - Total Translations Created/Updated: ${totalTranslations}`);
  console.log(`=================================================================\n`);

  await sql.end();
}

async function fastUpsertTranslation(transMap, recordId, tableName, fieldName, originalText, i18n) {
  const mapKey = `${recordId}:${fieldName}`;
  const existingId = transMap.get(mapKey);
  const langTextsJson = JSON.stringify({
    en: i18n.en,
    ur: i18n.ur,
    ar: i18n.ar,
    fa: i18n.fa,
    ps: i18n.ps,
  });

  if (existingId) {
    await sql`
      UPDATE public.record_translations
      SET original_text = ${originalText},
          english_text = ${i18n.en},
          urdu_text = ${i18n.ur},
          arabic_text = ${i18n.ar},
          persian_text = ${i18n.fa},
          pashto_text = ${i18n.ps},
          language_texts = ${langTextsJson}::jsonb,
          translation_status = 'verified',
          translated_by_engine = 'verified',
          updated_at = NOW()
      WHERE id = ${existingId};
    `;
  } else {
    const inserted = await sql`
      INSERT INTO public.record_translations (
        id, record_table, record_id, field_name, original_text, original_language_code,
        english_text, urdu_text, arabic_text, persian_text, pashto_text,
        language_texts, source, translation_status, translated_by_engine, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${tableName}, ${recordId}, ${fieldName}, ${originalText}, 'en',
        ${i18n.en}, ${i18n.ur}, ${i18n.ar}, ${i18n.fa}, ${i18n.ps},
        ${langTextsJson}::jsonb, 'manual', 'verified', 'verified', NOW(), NOW()
      )
      RETURNING id;
    `;
    transMap.set(mapKey, inserted[0].id);
  }
}

async function fastUpsertDict(dictMap, englishTerm, i18n) {
  if (!englishTerm || !englishTerm.trim()) return;
  const termLower = englishTerm.trim().toLowerCase();
  const existingId = dictMap.get(termLower);
  const langTextsJson = JSON.stringify({
    en: i18n.en,
    ur: i18n.ur,
    ar: i18n.ar,
    fa: i18n.fa,
    ps: i18n.ps,
  });

  if (existingId) {
    await sql`
      UPDATE public.record_translations
      SET original_text = ${englishTerm},
          english_text = ${i18n.en},
          urdu_text = ${i18n.ur},
          arabic_text = ${i18n.ar},
          persian_text = ${i18n.fa},
          pashto_text = ${i18n.ps},
          language_texts = ${langTextsJson}::jsonb,
          translation_status = 'verified',
          translated_by_engine = 'verified',
          updated_at = NOW()
      WHERE id = ${existingId};
    `;
  } else {
    const inserted = await sql`
      INSERT INTO public.record_translations (
        id, record_table, record_id, field_name, original_text, original_language_code,
        english_text, urdu_text, arabic_text, persian_text, pashto_text,
        language_texts, source, translation_status, translated_by_engine, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), 'system_dictionary', gen_random_uuid(), 'term', ${englishTerm}, 'en',
        ${i18n.en}, ${i18n.ur}, ${i18n.ar}, ${i18n.fa}, ${i18n.ps},
        ${langTextsJson}::jsonb, 'manual', 'verified', 'verified', NOW(), NOW()
      )
      RETURNING id;
    `;
    dictMap.set(termLower, inserted[0].id);
  }
}

seedGoods().catch((err) => {
  console.error("Error populating goods:", err);
  process.exit(1);
});
