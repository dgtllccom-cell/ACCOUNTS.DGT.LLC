import type { SupportedLanguage } from "@/lib/i18n/languages";

export interface LoginI18n {
  brandTitle: string;
  brandSubtitle: string;
  identifierPlaceholder: string;
  passwordPlaceholder: string;
  rememberMe: string;
  forgotPassword: string;
  signInSecurely: string;
  faceIdFingerprint: string;
  sandboxMode: string;
  heroTitle: string;
  featMultiCountryTitle: string;
  featMultiCountryDesc: string;
  featRoleAccessTitle: string;
  featRoleAccessDesc: string;
  featLanguagesTitle: string;
  featLanguagesDesc: string;
  selectLanguage: string;
  biometricNotEnrolled: string;
  biometricSuccess: string;
  passkeyPromptTitle: string;
  passkeyPromptDesc: string;
  close: string;
  demoCredentialsTitle: string;
  forgotPasswordTitle: string;
  forgotPasswordDesc: string;
  resetViaAdmin: string;
  authenticating: string;
  fillCreds: string;
}

export const LOGIN_TRANSLATIONS: Record<SupportedLanguage, LoginI18n> = {
  en: {
    brandTitle: "DGT ACCOUNTS ERP",
    brandSubtitle: "Secure Enterprise Access",
    identifierPlaceholder: "Email / User Code",
    passwordPlaceholder: "Password",
    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",
    signInSecurely: "SIGN IN SECURELY",
    faceIdFingerprint: "Face ID / Fingerprint",
    sandboxMode: "Preview / Sandbox Mode",
    heroTitle: "A Smarter Way to Manage Global Operations",
    featMultiCountryTitle: "Multi-Country",
    featMultiCountryDesc: "Manage operations across multiple countries",
    featRoleAccessTitle: "Role-Based Access",
    featRoleAccessDesc: "Secure and flexible team permissions",
    featLanguagesTitle: "Five Languages",
    featLanguagesDesc: "Work in your preferred language",
    selectLanguage: "Language",
    biometricNotEnrolled: "No biometric passkey enrolled on this device. Sign in using your Email / User Code and Password.",
    biometricSuccess: "Biometric authentication verified.",
    passkeyPromptTitle: "Biometric Authentication",
    passkeyPromptDesc: "Sign in with Touch ID, Face ID, Windows Hello, or your device security key.",
    close: "Close",
    demoCredentialsTitle: "Quick Demo & Role Presets",
    forgotPasswordTitle: "Password Recovery",
    forgotPasswordDesc: "For enterprise security, password resets are authorized through your System Administrator or registered email.",
    resetViaAdmin: "Contact Super Admin",
    authenticating: "Authenticating...",
    fillCreds: "Quick Fill"
  },
  ur: {
    brandTitle: "ڈی جی ٹی اکاؤنٹس ای آر پی",
    brandSubtitle: "محفوظ انٹرپرائز رسائی",
    identifierPlaceholder: "ای میل / صارف کوڈ",
    passwordPlaceholder: "پاس ورڈ",
    rememberMe: "مجھے یاد رکھیں",
    forgotPassword: "پاس ورڈ بھول گئے؟",
    signInSecurely: "محفوظ لاگ ان کریں",
    faceIdFingerprint: "فیس آئی ڈی / فنگر پرنٹ",
    sandboxMode: "پریویو / سینڈ باکس موڈ",
    heroTitle: "عالمی کاروباری کارروائیوں کے نظم و نسق کا جدید ترین نظام",
    featMultiCountryTitle: "کثیر ملکی نیٹ ورک",
    featMultiCountryDesc: "متعدد ممالک میں شاخوں اور تجارت کا ہموار انتظام",
    featRoleAccessTitle: "کردار پر مبنی رسائی",
    featRoleAccessDesc: "محفوظ اور لچکدار دفتری و برانچ اختیارات",
    featLanguagesTitle: "پانچ زبانیں",
    featLanguagesDesc: "اپنی پسندیدہ زبان میں کام کریں",
    selectLanguage: "زبان منتخب کریں",
    biometricNotEnrolled: "اس ڈیوائس پر بائیو میٹرک پاس کی موجود نہیں۔ برائے مہربانی ای میل اور پاس ورڈ سے لاگ ان کریں۔",
    biometricSuccess: "بایومیٹرک تصدیق کامیاب۔",
    passkeyPromptTitle: "بایومیٹرک سیکیورٹی",
    passkeyPromptDesc: "فیس آئی ڈی، ٹچ آئی ڈی، یا فنگر پرنٹ کے ذریعے فوری اور محفوظ لاگ ان کریں۔",
    close: "بند کریں",
    demoCredentialsTitle: "ڈیمو اکاؤنٹس اور فوری رسائی",
    forgotPasswordTitle: "پاس ورڈ کی بازیابی",
    forgotPasswordDesc: "انٹرپرائز سیکیورٹی کے تحت پاس ورڈ ری سیٹ کے لیے اپنے سسٹم ایڈمنسٹریٹر یا رجسٹرڈ ای میل سے رجوع کریں۔",
    resetViaAdmin: "سپر ایڈمن سے رابطہ کریں",
    authenticating: "تصدیق کی جا رہی ہے...",
    fillCreds: "خودکار اندراج"
  },
  ar: {
    brandTitle: "دي جي تي لنظم الحسابات ERP",
    brandSubtitle: "دخول مؤسسي آمن",
    identifierPlaceholder: "البريد الإلكتروني / رمز المستخدم",
    passwordPlaceholder: "كلمة المرور",
    rememberMe: "تذكرني",
    forgotPassword: "نسيت كلمة المرور؟",
    signInSecurely: "تسجيل الدخول بأمان",
    faceIdFingerprint: "بصمة الوجه / بصمة الإصبع",
    sandboxMode: "وضع المعاينة / التجربة",
    heroTitle: "طريقة أذكى لإدارة العمليات التجارية العالمية",
    featMultiCountryTitle: "متعدد الدول",
    featMultiCountryDesc: "إدارة العمليات عبر دول وموانئ متعددة",
    featRoleAccessTitle: "صلاحيات قائمة على الأدوار",
    featRoleAccessDesc: "أذونات وصلاحيات آمنة ومرنة لفرق العمل",
    featLanguagesTitle: "خمس لغات",
    featLanguagesDesc: "اعمل بلغتك المفضلة بكل سهولة",
    selectLanguage: "اللغة",
    biometricNotEnrolled: "لم يتم تسجيل مفتاح مرور بيومتري على هذا الجهاز. الرجاء استخدام البريد الإلكتروني وكلمة المرور.",
    biometricSuccess: "تم التحقق من المصادقة البيومترية بنجاح.",
    passkeyPromptTitle: "المصادقة البيومترية",
    passkeyPromptDesc: "سجل الدخول باستخدام بصمة الوجه أو الإصبع أو مفتاح الأمان لجهازك.",
    close: "إغلاق",
    demoCredentialsTitle: "حسابات تجريبية سريعة",
    forgotPasswordTitle: "استعادة كلمة المرور",
    forgotPasswordDesc: "لأمان المؤسسة، يتم ترخيص إعادة تعيين كلمة المرور من خلال مسؤول النظام أو بريدك المسجل.",
    resetViaAdmin: "تواصل مع المشرف الأعلى",
    authenticating: "جارٍ التحقق...",
    fillCreds: "تعبئة سريعة"
  },
  fa: {
    brandTitle: "سیستم حسابداری دی‌جی‌تی ERP",
    brandSubtitle: "ورود امن سازمانی",
    identifierPlaceholder: "ایمیل / کد کاربری",
    passwordPlaceholder: "رمز عبور",
    rememberMe: "مرا به خاطر بسپار",
    forgotPassword: "رمز عبور را فراموش کرده‌اید؟",
    signInSecurely: "ورود ایمن به سیستم",
    faceIdFingerprint: "شناسه چهره / اثر انگشت",
    sandboxMode: "حالت آزمایشی / پیش‌نمایش",
    heroTitle: "روشی هوشمندانه‌تر برای مدیریت عملیات جهانی",
    featMultiCountryTitle: "چندین کشور",
    featMultiCountryDesc: "مدیریت یکپارچه عملیات در چندین کشور",
    featRoleAccessTitle: "دسترسی مبتنی بر نقش",
    featRoleAccessDesc: "مجوزهای امن و انعطاف‌پذیر برای تیم‌ها",
    featLanguagesTitle: "پنج زبان زنده",
    featLanguagesDesc: "به زبان دلخواه خود با سامانه کار کنید",
    selectLanguage: "انتخاب زبان",
    biometricNotEnrolled: "کلید عبور بیومتریک در این دستگاه ثبت نشده است. لطفاً با ایمیل و رمز عبور وارد شوید.",
    biometricSuccess: "احراز هویت بیومتریک با موفقیت انجام شد.",
    passkeyPromptTitle: "احراز هویت بیومتریک",
    passkeyPromptDesc: "با استفاده از حسگر اثر انگشت، تشخیص چهره یا رمز امنیتی دستگاه وارد شوید.",
    close: "بستن",
    demoCredentialsTitle: "حساب‌های آزمایشی سریع",
    forgotPasswordTitle: "بازیابی رمز عبور",
    forgotPasswordDesc: "جهت حفظ امنیت سازمان، بازنشانی رمز عبور از طریق مدیر ارشد سامانه یا ایمیل ثبت شده انجام می‌پذیرد.",
    resetViaAdmin: "تماس با مدیر ارشد",
    authenticating: "در حال بررسی...",
    fillCreds: "تکمیل خودکار"
  },
  ps: {
    brandTitle: "ډي جي ټي اکاونټس ای آر پي",
    brandSubtitle: "خوندي سوداګریز لاسرسی",
    identifierPlaceholder: "برېښنالیک / کارن کوډ",
    passwordPlaceholder: "پټنوم",
    rememberMe: "ما په یاد ولره",
    forgotPassword: "پټنوم مو هېر شوی؟",
    signInSecurely: "په خوندي ډول ننوتل",
    faceIdFingerprint: "د مخ پېژندنه / د ګوتې نښه",
    sandboxMode: "کتنه / ازمایښتي حالت",
    heroTitle: "د نړیوالو سوداګریزو چارو د مدیریت پرمختللې لاره",
    featMultiCountryTitle: "ګڼ هېوادونه",
    featMultiCountryDesc: "په بېلابېلو هېوادونو کې د چارو اسانه مدیریت",
    featRoleAccessTitle: "د رول پر بنسټ لاسرسی",
    featRoleAccessDesc: "د ډلو او کارکوونکو لپاره خوندي واکونه",
    featLanguagesTitle: "پنځه ژبې",
    featLanguagesDesc: "په خپله خوښه ژبه کې کار وکړئ",
    selectLanguage: "ژبه غوره کړئ",
    biometricNotEnrolled: "په دې وسیله د بایومټریک امنیت نه دی فعال شوی. مهرباني وکړئ په ایمیل او پاسورډ ننوځئ.",
    biometricSuccess: "بایومټریک تصدیق په بریالیتوب سره وشو.",
    passkeyPromptTitle: "بایومټریک ننوتل",
    passkeyPromptDesc: "د مخ پېژندنې یا د ګوتې نښې له لارې په خوندي توګه ننوځئ.",
    close: "بندول",
    demoCredentialsTitle: "ازمایښتي حسابونه او اسانه لاسرسی",
    forgotPasswordTitle: "د پټنوم بیا ترلاسه کول",
    forgotPasswordDesc: "د اداري امنیت له امله، د پټنوم بدلون یوازې د سوپر ایډمین یا راجستر شوي بریښنالیک له لارې ممکن دی.",
    resetViaAdmin: "له سوپر ایډمین سره اړیکه",
    authenticating: "د پټنوم تصدیق کیږي...",
    fillCreds: "سمدستي ډکول"
  }
};
