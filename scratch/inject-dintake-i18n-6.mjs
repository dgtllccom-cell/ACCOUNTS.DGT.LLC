import fs from "node:fs";
const UI = "B:/accounts.dgt.llc.code_project/ACCOUNTS.DGT.LLC/lib/i18n/ui.ts";

const K = {
  "dintake.nav_handovers":   ["Business → Shipping Handovers", "بزنس ← شپنگ ہینڈ اوور", "تسليمات الأعمال ← الشحن", "تحویل کسب‌وکار ← حمل‌ونقل", "سوداګري ← بار سپارل"],
  "dintake.hi_nav":          ["Handover Inbox", "ہینڈ اوور اِن باکس", "صندوق التسليمات", "صندوق ورودی تحویل", "د سپارلو انباکس"],
  "dintake.hi_title":        ["Shipping Handover Inbox", "شپنگ ہینڈ اوور اِن باکس", "صندوق تسليمات الشحن", "صندوق ورودی تحویل حمل‌ونقل", "د بار سپارلو انباکس"],
  "dintake.hi_blurb":        ["Handovers a business team has authorised to your agency. Accept one to bring it into the shipment / BL workflow.", "وہ ہینڈ اوور جو ایک بزنس ٹیم نے آپ کی ایجنسی کو مجاز کیے ہیں۔ کسی کو قبول کر کے اسے شپمنٹ / بی ایل ورک فلو میں لائیں۔", "التسليمات التي فوّضها فريق الأعمال إلى وكالتك. اقبل واحداً لإدخاله في سير عمل الشحنة / بوليصة الشحن.", "تحویل‌هایی که یک تیم کسب‌وکار به نمایندگی شما مجاز کرده است. یکی را بپذیرید تا وارد گردش‌کار محموله / بارنامه شود.", "هغه سپارنې چې یوې سوداګریزې ډلې ستاسو اجنسۍ ته اجازه ورکړې. یوه یې ومنئ چې د بار / BL کاري بهیر ته یې راولئ."],
  "dintake.hi_back":         ["Handover Inbox", "ہینڈ اوور اِن باکس", "صندوق التسليمات", "صندوق ورودی تحویل", "د سپارلو انباکس"],
  "dintake.hi_reject_reason":["Reason for rejecting this handover:", "اس ہینڈ اوور کو مسترد کرنے کی وجہ:", "سبب رفض هذا التسليم:", "دلیل رد این تحویل:", "د دې سپارنې د ردولو لامل:"],
  "dintake.hi_st_submitted": ["Submitted", "جمع شدہ", "مُرسَل", "ارسال‌شده", "سپارل شوی"],
  "dintake.hi_st_accepted":  ["Accepted", "قبول شدہ", "مقبول", "پذیرفته‌شده", "منل شوی"],
  "dintake.hi_st_rejected":  ["Rejected", "مسترد", "مرفوض", "ردشده", "رد شوی"],
  "dintake.hi_st_cancelled": ["Cancelled", "منسوخ", "ملغى", "لغوشده", "لغوه شوی"],
  "dintake.hi_st_draft":     ["Draft", "مسودہ", "مسودة", "پیش‌نویس", "مسوده"],
  "dintake.hi_st_all":       ["All", "تمام", "الكل", "همه", "ټول"],
  "dintake.hi_action_create_shipping_request":   ["Create Shipping Request", "شپنگ درخواست بنائیں", "إنشاء طلب شحن", "ایجاد درخواست حمل", "د بار غوښتنه جوړول"],
  "dintake.hi_action_send_to_shipping_line":     ["Send to Shipping Line", "شپنگ لائن کو بھیجیں", "إرسال إلى خط الشحن", "ارسال به خط کشتیرانی", "بار لیکې ته لیږل"],
  "dintake.hi_action_assign_clearing_agent":     ["Assign Clearing Agent", "کلیئرنگ ایجنٹ تفویض کریں", "تعيين وكيل التخليص", "تخصیص نماینده ترخیص", "د ترخیص اجنټ ټاکل"],
  "dintake.hi_action_approve_shipping_handover": ["Approve Shipping Handover", "شپنگ ہینڈ اوور منظور کریں", "الموافقة على تسليم الشحن", "تأیید تحویل حمل", "د بار سپارنه تصویب"],
  "dintake.hi_contract":     ["Contract Reference", "معاہدہ حوالہ", "مرجع العقد", "مرجع قرارداد", "د تړون حواله"],
  "dintake.hi_bl":           ["B/L Reference", "بی ایل حوالہ", "مرجع بوليصة الشحن", "مرجع بارنامه", "د BL حواله"],
  "dintake.hi_supplier":     ["Shipper / Supplier", "بھیجنے والا / سپلائر", "الشاحن / المورد", "فرستنده / تأمین‌کننده", "لېږونکی / عرضه کوونکی"],
  "dintake.hi_consignee":    ["Consignee / Importer", "وصول کنندہ / درآمد کنندہ", "المرسل إليه / المستورد", "گیرنده / واردکننده", "ترلاسه کوونکی / واردوونکی"],
  "dintake.hi_pol":          ["Port of Loading", "بندرگاہِ بارگیری", "ميناء التحميل", "بندر بارگیری", "د بار پورټ"],
  "dintake.hi_pod":          ["Port of Discharge", "بندرگاہِ تخلیہ", "ميناء التفريغ", "بندر تخلیه", "د تخلیې پورټ"],
  "dintake.hi_vessel":       ["Vessel", "جہاز", "السفينة", "کشتی", "کښتۍ"],
  "dintake.hi_incoterm":     ["Delivery Terms", "ترسیل کی شرائط", "شروط التسليم", "شرایط تحویل", "د سپارلو شرطونه"],
  "dintake.hi_containers":   ["Containers", "کنٹینر", "الحاويات", "کانتینرها", "کانټینرونه"],
  "dintake.hi_goods":        ["Cargo", "مال", "البضائع", "محموله", "بار"],
  "dintake.hi_privacy":      ["This is the approved operational information only. Business prices, profit and ledgers are never shared with the shipping side.", "یہ صرف منظور شدہ آپریشنل معلومات ہے۔ بزنس قیمتیں، منافع اور لیجرز کبھی شپنگ سائیڈ کے ساتھ شیئر نہیں کیے جاتے۔", "هذه هي المعلومات التشغيلية المعتمدة فقط. أسعار الأعمال والأرباح ودفاتر الأستاذ لا تُشارَك أبداً مع جانب الشحن.", "این فقط اطلاعات عملیاتی تأییدشده است. قیمت‌ها، سود و دفاتر کسب‌وکار هرگز با طرف حمل‌ونقل به اشتراک گذاشته نمی‌شود.", "دا یوازې تصویب شوي عملیاتي معلومات دي. د سوداګرۍ بیې، ګټه او لیجرونه هیڅکله د بار له اړخ سره نه شریکیږي."],
  "dintake.hi_accept":       ["Accept Handover", "ہینڈ اوور قبول کریں", "قبول التسليم", "پذیرش تحویل", "سپارنه منل"],
  "dintake.hi_reject":       ["Reject", "مسترد کریں", "رفض", "رد", "ردول"],
  "dintake.hi_c_no":         ["Handover", "ہینڈ اوور", "التسليم", "تحویل", "سپارنه"],
  "dintake.hi_c_action":     ["Action", "کارروائی", "الإجراء", "اقدام", "کړنه"],
  "dintake.hi_c_ref":        ["Contract / B/L", "معاہدہ / بی ایل", "العقد / بوليصة الشحن", "قرارداد / بارنامه", "تړون / BL"],
  "dintake.hi_c_containers": ["Containers", "کنٹینر", "الحاويات", "کانتینرها", "کانټینرونه"],
  "dintake.hi_c_status":     ["Status", "حالت", "الحالة", "وضعیت", "حالت"],
  "dintake.hi_empty":        ["No handovers in this view.", "اس منظر میں کوئی ہینڈ اوور نہیں۔", "لا توجد تسليمات في هذا العرض.", "تحویلی در این نما نیست.", "پدې لید کې هیڅ سپارنه نشته."],
  "dintake.bh_title":        ["Business → Shipping Handovers", "بزنس ← شپنگ ہینڈ اوور", "تسليمات الأعمال ← الشحن", "تحویل کسب‌وکار ← حمل‌ونقل", "سوداګري ← بار سپارل"],
  "dintake.bh_blurb":        ["Authorise a Purchase / Sales record into the Shipping / Clearing workflow. Only operational information is shared — never price, profit or ledgers.", "خرید / فروخت ریکارڈ کو شپنگ / کلیئرنگ ورک فلو میں مجاز کریں۔ صرف آپریشنل معلومات شیئر ہوتی ہے — کبھی قیمت، منافع یا لیجرز نہیں۔", "فوّض سجل شراء / بيع إلى سير عمل الشحن / التخليص. تُشارَك المعلومات التشغيلية فقط — لا السعر أو الربح أو دفاتر الأستاذ.", "یک رکورد خرید / فروش را وارد گردش‌کار حمل‌ونقل / ترخیص کنید. فقط اطلاعات عملیاتی به اشتراک گذاشته می‌شود — نه قیمت، سود یا دفاتر.", "د پیرود / پلور ریکارډ د بار / ترخیص کاري بهیر ته اجازه ورکړئ. یوازې عملیاتي معلومات شریکیږي — هیڅکله بیه، ګټه یا لیجرونه نه."],
  "dintake.bh_new":          ["New Handover", "نیا ہینڈ اوور", "تسليم جديد", "تحویل جدید", "نوې سپارنه"],
  "dintake.bh_cancel_confirm":["Cancel this handover?", "یہ ہینڈ اوور منسوخ کریں؟", "إلغاء هذا التسليم؟", "این تحویل لغو شود؟", "دا سپارنه لغوه شي؟"],
  "dintake.bh_c_no":         ["Handover", "ہینڈ اوور", "التسليم", "تحویل", "سپارنه"],
  "dintake.bh_c_source":     ["Business Record", "بزنس ریکارڈ", "سجل الأعمال", "رکورد کسب‌وکار", "د سوداګرۍ ریکارډ"],
  "dintake.bh_c_action":     ["Action", "کارروائی", "الإجراء", "اقدام", "کړنه"],
  "dintake.bh_c_agent":      ["Agent", "ایجنٹ", "الوكيل", "نماینده", "اجنټ"],
  "dintake.bh_c_status":     ["Status", "حالت", "الحالة", "وضعیت", "حالت"],
  "dintake.bh_empty":        ["No handovers yet.", "ابھی کوئی ہینڈ اوور نہیں۔", "لا توجد تسليمات بعد.", "هنوز تحویلی نیست.", "تر اوسه هیڅ سپارنه نشته."],
  "dintake.bh_pick_record":  ["Choose a business record.", "ایک بزنس ریکارڈ منتخب کریں۔", "اختر سجل أعمال.", "یک رکورد کسب‌وکار انتخاب کنید.", "یو د سوداګرۍ ریکارډ وټاکئ."],
  "dintake.bh_f_module":     ["Business Domain", "بزنس ڈومین", "مجال الأعمال", "حوزه کسب‌وکار", "د سوداګرۍ برخه"],
  "dintake.bh_purchase":     ["Purchase Order", "خرید آرڈر", "أمر شراء", "سفارش خرید", "د پیرود امر"],
  "dintake.bh_sales":        ["Sales Order", "فروخت آرڈر", "أمر بيع", "سفارش فروش", "د پلور امر"],
  "dintake.bh_f_record":     ["Record", "ریکارڈ", "السجل", "رکورد", "ریکارډ"],
  "dintake.bh_choose":       ["Choose…", "منتخب کریں…", "اختر…", "انتخاب…", "وټاکئ…"],
  "dintake.bh_f_action":     ["Handover Action", "ہینڈ اوور کارروائی", "إجراء التسليم", "اقدام تحویل", "د سپارنې کړنه"],
  "dintake.bh_f_agent":      ["Clearing Agent", "کلیئرنگ ایجنٹ", "وكيل التخليص", "نماینده ترخیص", "د ترخیص اجنټ"],
  "dintake.bh_no_agent":     ["None", "کوئی نہیں", "لا شيء", "هیچ‌کدام", "هیڅ"],
  "dintake.bh_f_containers": ["Containers (optional)", "کنٹینر (اختیاری)", "الحاويات (اختياري)", "کانتینرها (اختیاری)", "کانټینرونه (اختیاري)"],
  "dintake.bh_submit":       ["Send Handover", "ہینڈ اوور بھیجیں", "إرسال التسليم", "ارسال تحویل", "سپارنه لیږل"],
};

const LANGS = ["en", "ur", "ar", "fa", "ps"];
const IDX = { en: 0, ur: 1, ar: 2, fa: 3, ps: 4 };
let src = fs.readFileSync(UI, "utf8");
for (const lang of LANGS) {
  const re = new RegExp(`(const ${lang}: Dict = \\{[\\s\\S]*?)(\\n\\};)`);
  const m = src.match(re);
  if (!m) throw new Error(`block not found: ${lang}`);
  const lines = Object.entries(K).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v[IDX[lang]])},`).join("\n");
  src = src.replace(re, `$1\n${lines}$2`);
}
fs.writeFileSync(UI, src);
console.log(`injected ${Object.keys(K).length} keys × 5`);
