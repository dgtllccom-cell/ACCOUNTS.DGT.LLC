import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    let query = supabase
      .from("erp_truck_master_options")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      // Fallback default options if table is loading
      return NextResponse.json({ options: getFallbackOptions(category) });
    }

    return NextResponse.json({ options: data && data.length > 0 ? data : getFallbackOptions(category) });
  } catch (error: any) {
    return NextResponse.json({ options: getFallbackOptions(null) });
  }
}

function getFallbackOptions(category: string | null) {
  const all = [
    // Truck Types
    { id: "1", category: "truck_type", code: "trailer", name_en: "Trailer", name_ur: "ٹریلر", name_ar: "مقطورة", name_fa: "تریلر", name_ps: "ټریلر" },
    { id: "2", category: "truck_type", code: "flatbed", name_en: "Flatbed Truck", name_ur: "فلیٹ باڈی", name_ar: "شاحنة مسطحة", name_fa: "کف تریلر", name_ps: "فلیټ ټراک" },
    { id: "3", category: "truck_type", code: "container_40ft", name_en: "Container (40ft)", name_ur: "کنٹینر (40 فٹ)", name_ar: "حاوية (40 قدم)", name_fa: "کانتینر (40 فوت)", name_ps: "کنټینر (40 فټ)" },
    { id: "4", category: "truck_type", code: "container_20ft", name_en: "Container (20ft)", name_ur: "کنٹینر (20 فٹ)", name_ar: "حاوية (20 قدم)", name_fa: "کانتینر (20 فوت)", name_ps: "کنټینر (20 فټ)" },
    { id: "5", category: "truck_type", code: "box_truck", name_en: "Box Truck", name_ur: "باکس ٹرک", name_ar: "شاحنة مغلقة", name_fa: "کامیون اتاقی", name_ps: "باکس ټراک" },
    { id: "6", category: "truck_type", code: "tanker", name_en: "Tanker", name_ur: "ٹینکر", name_ar: "صهريج", name_fa: "تانکر", name_ps: "ټینکر" },
    { id: "7", category: "truck_type", code: "lowbed", name_en: "Lowbed Trailer", name_ur: "لو بیڈ ٹریلر", name_ar: "مقطورة منخفضة", name_fa: "کف کم ارتفاع", name_ps: "لوبېډ ټریلر" },
    { id: "8", category: "truck_type", code: "tipper", name_en: "Dump Truck / Tipper", name_ur: "ڈمپر ٹرک", name_ar: "شاحنة قلابة", name_fa: "کمپرسور", name_ps: "ډمپر ټراک" },

    // Makes
    { id: "9", category: "make", code: "volvo", name_en: "Volvo", name_ur: "وولوو", name_ar: "فولفو", name_fa: "ولوو", name_ps: "وولوو" },
    { id: "10", category: "make", code: "scania", name_en: "Scania", name_ur: "اسکانیا", name_ar: "سكانيا", name_fa: "اسکانیا", name_ps: "اسکانیا" },
    { id: "11", category: "make", code: "mercedes", name_en: "Mercedes-Benz", name_ur: "مرسڈیز بینز", name_ar: "مرسيدس بنز", name_fa: "مرسدس بنز", name_ps: "مرسڈیز بینز" },
    { id: "12", category: "make", code: "man", name_en: "MAN", name_ur: "مین", name_ar: "مان", name_fa: "مان", name_ps: "مین" },
    { id: "13", category: "make", code: "isuzu", name_en: "ISUZU", name_ur: "ائسوزو", name_ar: "إيسوزو", name_fa: "ایسوزو", name_ps: "ائسوزو" },
    { id: "14", category: "make", code: "hino", name_en: "Hino", name_ur: "ہینو", name_ar: "هينو", name_fa: "هینو", name_ps: "ہینو" },

    // Fuel Types
    { id: "15", category: "fuel_type", code: "diesel", name_en: "Diesel", name_ur: "ڈیزل", name_ar: "ديزل", name_fa: "دیزل", name_ps: "ڈیزل" },
    { id: "16", category: "fuel_type", code: "petrol", name_en: "Petrol", name_ur: "پیٹرول", name_ar: "بنزين", name_fa: "بنزین", name_ps: "پیٹرول" },
    { id: "17", category: "fuel_type", code: "cng", name_en: "CNG", name_ur: "سی این جی", name_ar: "غاز طبيعي", name_fa: "سی ان جی", name_ps: "سی این جی" },

    // Document Types
    { id: "18", category: "document_type", code: "reg_book", name_en: "Registration Book", name_ur: "رجسٹریشن بک", name_ar: "دفتر التسجيل", name_fa: "دفترچه ثبت", name_ps: "رجسٹریشن کتاب" },
    { id: "19", category: "document_type", code: "insurance", name_en: "Insurance Policy", name_ur: "انشورنس پالیسی", name_ar: "بوليصة التأمين", name_fa: "بیمه نامه", name_ps: "انشورنس پالیسی" },
    { id: "20", category: "document_type", code: "fitness", name_en: "Fitness Certificate", name_ur: "فٹنس سرٹیفکیٹ", name_ar: "شهادة اللياقة", name_fa: "گواهی سلامت", name_ps: "فټنس سند" },
    { id: "21", category: "document_type", code: "route_permit", name_en: "Route Permit", name_ur: "روٹ پرمٹ", name_ar: "تصريح المسار", name_fa: "مجوز مسیر", name_ps: "روټ پرمټ" },
    { id: "22", category: "document_type", code: "driver_license", name_en: "Driver License", name_ur: "ڈرائیونگ لائسنس", name_ar: "رخصة القيادة", name_fa: "گواهینامه رانندگی", name_ps: "ډرایور لایسنس" },
    { id: "23", category: "document_type", code: "owner_cnic", name_en: "Owner CNIC / Passport", name_ur: "مالک قومی شناختی کارڈ / پاسپورٹ", name_ar: "هوية المالك / الجواز", name_fa: "شناسنامه مالک / پاسپورت", name_ps: "د مالک پیژندپاڼه" },

    // Contract Types
    { id: "24", category: "contract_type", code: "long_term", name_en: "Long-Term Transport Contract", name_ur: "طویل المدتی ٹرانسپورٹ معاہدہ", name_ar: "عقد نقل طويل الأجل", name_fa: "قرارداد حمل و نقل بلند مدت", name_ps: "اوږد مهاله ټرانسپورټ تړون" },
    { id: "25", category: "contract_type", code: "spot", name_en: "Spot Transport Agreement", name_ur: "اسپاٹ ٹرانسپورٹ معاہدہ", name_ar: "اتفاقية نقل فوري", name_fa: "قرارداد حمل و نقل موردی", name_ps: "سمدستي ټرانسپورټ تړون" },
    { id: "26", category: "contract_type", code: "border_crossing", name_en: "Border Crossing Transit Permit", name_ur: "بارڈر کراسنگ ٹرانزٹ پرمٹ", name_ar: "تصريح عبور الحدود", name_fa: "مجوز عبور از مرز", name_ps: "د سرحد کراسنګ پرمټ" }
  ];

  if (!category) return all;
  return all.filter(o => o.category === category);
}
