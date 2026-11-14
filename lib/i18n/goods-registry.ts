// Goods registry feedback in the five supported ERP languages.
const messages = {
  en: {
    required: "Enter Goods Name and HS / PCT Code.",
    saved: "Goods saved successfully.",
    failed: "Could not save goods.",
    slow: "Saving is taking longer than expected. Please wait; do not submit again.",
    unconfirmed: "The save result could not be confirmed. Refresh the goods list before trying again.",
  },
  ur: {
    required: "سامان کا نام اور HS / PCT کوڈ درج کریں۔",
    saved: "سامان کامیابی سے محفوظ ہو گیا۔",
    failed: "سامان محفوظ نہیں ہو سکا۔",
    slow: "محفوظ ہونے میں وقت لگ رہا ہے۔ انتظار کریں؛ دوبارہ جمع نہ کریں۔",
    unconfirmed: "محفوظ ہونے کی تصدیق نہیں ہو سکی۔ دوبارہ کوشش سے پہلے سامان کی فہرست تازہ کریں۔",
  },
  ar: {
    required: "أدخل اسم البضاعة ورمز HS / PCT.",
    saved: "تم حفظ البضاعة بنجاح.",
    failed: "تعذر حفظ البضاعة.",
    slow: "يستغرق الحفظ وقتاً أطول من المتوقع. يرجى الانتظار وعدم الإرسال مجدداً.",
    unconfirmed: "تعذر تأكيد نتيجة الحفظ. حدّث قائمة البضائع قبل المحاولة مجدداً.",
  },
  fa: {
    required: "نام کالا و کد HS / PCT را وارد کنید.",
    saved: "کالا با موفقیت ذخیره شد.",
    failed: "ذخیره کالا انجام نشد.",
    slow: "ذخیره بیشتر از انتظار طول کشیده است. منتظر بمانید و دوباره ارسال نکنید.",
    unconfirmed: "نتیجه ذخیره تأیید نشد. پیش از تلاش دوباره، فهرست کالاها را تازه کنید.",
  },
  ps: {
    required: "د توکي نوم او HS / PCT کوډ ولیکئ.",
    saved: "توکی په بریالیتوب خوندي شو.",
    failed: "توکی خوندي نه شو.",
    slow: "خوندي کول له تمې ډېر وخت نیسي. انتظار وکړئ او بیا یې مه لېږئ.",
    unconfirmed: "د خوندي کېدو پایله تایید نه شوه. د بیا هڅې مخکې د توکو لېست تازه کړئ.",
  },
} as const;

export function goodsRegistryText(lang: string, key: keyof typeof messages.en): string {
  return messages[lang as keyof typeof messages]?.[key] ?? messages.en[key];
}
