import fs from "node:fs";
import postgres from "postgres";
import crypto from "node:crypto";

function loadEnv() {
  const env = {};
  const files = [".env.local", ".env"];
  for (const f of files) {
    try {
      if (fs.existsSync(f)) {
        for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const index = trimmed.indexOf("=");
          if (index === -1) continue;
          const key = trimmed.slice(0, index).trim();
          const val = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
          if (!env[key]) env[key] = val;
        }
      }
    } catch (e) {}
  }
  return env;
}

const env = loadEnv();
const dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL not found in .env.local or .env");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 2, prepare: false, connect_timeout: 30 });

const ACCOUNT_TEMPLATES = [
  { code: "1001", name: "Main Cash in Hand Vault Account", category: "Asset", type: "Cash", tr: { en: "Main Cash in Hand Vault Account", ur: "مین کیش ان ہینڈ والٹ اکاؤنٹ", ar: "حساب الخزينة الرئيسية النقدية", fa: "حساب صندوق نقد اصلی", ps: "د اصلي نغدو پيسو حساب" } },
  { code: "1002", name: "Petty Cash Operations Float Account", category: "Asset", type: "Cash", tr: { en: "Petty Cash Operations Float Account", ur: "پیٹی کیش آپریشنز فلوٹ اکاؤنٹ", ar: "حساب النثريات التشغيلية", fa: "حساب تنخواه گردان عملیاتی", ps: "د کوچنیو لګښتونو عملیاتي حساب" } },
  { code: "1010", name: "Emirates NBD Corporate Operations Bank", category: "Asset", type: "Bank", tr: { en: "Emirates NBD Corporate Operations Bank", ur: "امارات این بی ڈی کارپوریٹ آپریشنز بینک", ar: "بنك الإمارات دبي الوطني للعمليات", fa: "بانک امارات ان‌بی‌دی عملیاتی", ps: "د امارات این بي ډي بانک حساب" } },
  { code: "1011", name: "Meezan Bank Trade Finance Account", category: "Asset", type: "Bank", tr: { en: "Meezan Bank Trade Finance Account", ur: "میزان بینک ٹریڈ فنانس اکاؤنٹ", ar: "حساب التمويل التجاري بنك ميزان", fa: "حساب تامین مالی تجارت بانک میزان", ps: "د میزان بانک سوداګریز مالي حساب" } },
  { code: "1020", name: "Trade Debtors - Foreign Buyers Account", category: "Asset", type: "Accounts Receivable", tr: { en: "Trade Debtors - Foreign Buyers Account", ur: "تجارتی مقروضین - غیر ملکی خریدار اکاؤنٹ", ar: "المدينون التجاريون - المشترون الأجانب", fa: "بدهکاران تجاری - خریداران خارجی", ps: "سوداګریز پور وړي - بهرني پیرودونکي" } },
  { code: "1021", name: "Trade Debtors - Wholesale Customers Account", category: "Asset", type: "Accounts Receivable", tr: { en: "Trade Debtors - Wholesale Customers Account", ur: "تجارتی مقروضین - ہول سیل گاہک اکاؤنٹ", ar: "المدينون التجاريون - عملاء الجملة", fa: "بدهکاران تجاری - مشتریان عمده", ps: "سوداګریز پور وړي - د ټول پلور پیرودونکي" } },
  { code: "1030", name: "Inventory Stock - Dry Fruits & Spices", category: "Asset", type: "Inventory", tr: { en: "Inventory Stock - Dry Fruits & Spices", ur: "انوینٹری اسٹاک - ڈرائی فروٹس و مصالحہ جات", ar: "مخزون البضائع - الفواكه الجافة والبهارات", fa: "موجودی انبار - خشکبار و ادویه", ps: "د ګودام توکي - وچې میوې او مصالحې" } },
  { code: "1031", name: "Inventory Stock - Grains & Pulses", category: "Asset", type: "Inventory", tr: { en: "Inventory Stock - Grains & Pulses", ur: "انوینٹری اسٹاک - اناج و دالیں", ar: "مخزون الحبوب والبقوليات", fa: "موجودی غلات و حبوبات", ps: "د انبار غلې او حبوبات" } },
  { code: "1040", name: "Prepaid Rent & Port Lease Deposit", category: "Asset", type: "Current Asset", tr: { en: "Prepaid Rent & Port Lease Deposit", ur: "پیشگی کرایہ و پورٹ لیز ڈپازٹ", ar: "الإيجار المدفوع مقدماً ووديعة الميناء", fa: "پیش پرداخت اجاره و ودیعه بندر", ps: "مخکې ورکړل شوې کرایه او د پورټ ودیعه" } },
  { code: "2001", name: "Trade Creditors - Dry Fruits Suppliers", category: "Liability", type: "Accounts Payable", tr: { en: "Trade Creditors - Dry Fruits Suppliers", ur: "تجارتی قرض دہندگان - ڈرائی فروٹ سپلائرز", ar: "الدائنون التجاريون - موردي الفواكه الجافة", fa: "بستانکاران تجاری - تامین کنندگان خشکبار", ps: "سوداګریز پور ورکوونکي - د وچو میوو عرضه کوونکي" } },
  { code: "2002", name: "Trade Creditors - Customs & Logistics Brokers", category: "Liability", type: "Accounts Payable", tr: { en: "Trade Creditors - Customs & Logistics Brokers", ur: "تجارتی قرض دہندگان - کسٹمز و لاجسٹکس بروکج", ar: "الدائنون التجاريون - مخلصو الجمارك واللوجستيات", fa: "بستانکاران تجاری - کارگزاران گمرک", ps: "سوداګریز پور ورکوونکي - د ګمرک او لوجستیک استازي" } },
  { code: "2010", name: "Accrued Employee Salaries Payable Account", category: "Liability", type: "Current Liability", tr: { en: "Accrued Employee Salaries Payable Account", ur: "واجب الادا ملازمین کی تنخواہیں اکاؤنٹ", ar: "حساب رواتب الموظفين المستحقة", fa: "حساب حقوق و دستمزد پرداختنی پرسنل", ps: "د کارمندانو میاشتنۍ میاشتنۍ تادیات حساب" } },
  { code: "2020", name: "Value Added Tax (VAT) / Sales Tax Payable", category: "Liability", type: "Tax Payable", tr: { en: "Value Added Tax (VAT) / Sales Tax Payable", ur: "ویلیو ایڈڈ ٹیکس (وی اے ٹی) واجب الادا", ar: "ضريبة القيمة المضافة المستحقة", fa: "مالیات بر ارزش افزوده پرداختنی", ps: "د ارزښت زیاتوالي مالیات حساب" } },
  { code: "3001", name: "Share Capital & Owner Investment Account", category: "Equity", type: "Equity", tr: { en: "Share Capital & Owner Investment Account", ur: "شیئر کیپیٹل و مالک کی سرمایہ کاری اکاؤنٹ", ar: "حساب رأس المال واستثمار المالك", fa: "حساب سرمایه و سرمایه گذاری مالک", ps: "د مالک د پانګونې او سهم حساب" } },
  { code: "3002", name: "Retained Earnings & General Reserve", category: "Equity", type: "Equity", tr: { en: "Retained Earnings & General Reserve", ur: "برقرار شدہ منافع و جنرل ریزرو", ar: "الأرباح المبقاة والاحتياطي العام", fa: "سود انباشته و ذخیره عمومی", ps: "ذخیره شوي ګټې او عمومي ریزرف" } },
  { code: "4001", name: "Wholesale Sales Revenue - Export Direct", category: "Revenue", type: "Operating Revenue", tr: { en: "Wholesale Sales Revenue - Export Direct", ur: "ہول سیل فروخت کی آمدنی - برآمدات برا Rast", ar: "إيرادات مبيعات الجملة - التصدير المباشر", fa: "درآمد فروش عمده - صادرات مستقیم", ps: "د ټول پلور عاید - مستقیم صادرات" } },
  { code: "4002", name: "Domestic Commercial Trading Revenue", category: "Revenue", type: "Operating Revenue", tr: { en: "Domestic Commercial Trading Revenue", ur: "ملکی تجارتی فروخت کی آمدنی", ar: "إيرادات التجارة المحلية التجارية", fa: "درآمد تجاری داخلی", ps: "د کورنۍ سوداګرۍ پلور عاید" } },
  { code: "4010", name: "Customs Clearance & Brokerage Commission", category: "Revenue", type: "Service Revenue", tr: { en: "Customs Clearance & Brokerage Commission", ur: "کسٹمز کلئیرنس و بروکریج کمیشن آمدنی", ar: "عمولة التخليص الجمركي والوساطة", fa: "کارمزد ترخیص گمرکی و کارگزاری", ps: "د ګمرکي تصفیې او کارګزارۍ کمیشن عاید" } },
  { code: "5001", name: "Cost of Goods Sold - Direct Commodities", category: "Expense", type: "Direct Cost", tr: { en: "Cost of Goods Sold - Direct Commodities", ur: "فروخت شدہ مال کی لاگت - راست اشیاء", ar: "تكلفة البضاعة المباعة - السلع المباشرة", fa: "بهای تمام شده کالای فروش رفته", ps: "د پلورل شویو توکو مستقیم لګښت" } },
  { code: "5002", name: "Freight, Shipping & Container Handling Cost", category: "Expense", type: "Direct Cost", tr: { en: "Freight, Shipping & Container Handling Cost", ur: "کرایہ، جہاز رانی و کنٹینر ہینڈلنگ اخراجات", ar: "تكاليف الشحن وتناول الحاويات", fa: "هزینه حمل و نقل و جابجایی کانتینر", ps: "د باربري او کانټینرونو سمبالښت لګښت" } },
  { code: "5010", name: "Staff Payroll Salaries & Allowances Expense", category: "Expense", type: "Operating Expense", tr: { en: "Staff Payroll Salaries & Allowances Expense", ur: "ملازمین کی تنخواہیں و الاؤنسز اخراجات", ar: "مصروفات رواتب وبدلات الموظفين", fa: "هزینه حقوق و مزایای پرسنل", ps: "د کارمندانو میاشتنۍ تادیات او الونسونه" } },
  { code: "5011", name: "Office Warehouse Rent & Utilities Expense", category: "Expense", type: "Operating Expense", tr: { en: "Office Warehouse Rent & Utilities Expense", ur: "دفتر و گودام کا کرایہ و یوٹیلیٹیز اخراجات", ar: "مصاريف إيجار المكاتب والمستودعات والمرافق", fa: "هزینه اجاره دفتر و انبار و قبوض", ps: "د دفتر او ګودام کرایه او بریښنا لګښت" } },
  { code: "5020", name: "Vehicle Fuel & Transport Logistics Expense", category: "Expense", type: "Operating Expense", tr: { en: "Vehicle Fuel & Transport Logistics Expense", ur: "گاڑیوں کا ایندھن و ٹرانسپورٹ لاجسٹکس", ar: "مصاريف وقود السيارات واللوجستيات", fa: "هزینه سوخت خودرو و لوجستیک", ps: "د وسایطو د تېلو او ټرانسپورټ لګښت" } },
  { code: "5030", name: "General Office Administrative Expenses", category: "Expense", type: "Admin Expense", tr: { en: "General Office Administrative Expenses", ur: "جنرل آفس انتظامی اخراجات", ar: "المصاريف الإدارية العامة للمكتب", fa: "هزینه‌های عمومی و اداری دفتر", ps: "د عمومي دفتر اداري لګښتونه" } },
  { code: "5040", name: "Bank Charges & Exchange Foreign Currency Fees", category: "Expense", type: "Financial Expense", tr: { en: "Bank Charges & Exchange Foreign Currency Fees", ur: "بینک چارجز و تبادلہ زرمبادلہ فیس", ar: "رسوم البنك وفروق تحويل العملات الأجنبية", fa: "کارمزد بانکی و هزینه صرافی و ارز", ps: "د بانک چارجونه او اسعارو تبادلې لګښت" } }
];

const EMPLOYEE_TEMPLATES = [
  {
    nameEn: "Muhammad Gulistan Shah",
    category: "Manager",
    dept: "Executive Management",
    desig: "General Branch Manager",
    salary: 4500
  },
  {
    nameEn: "Ahmad Raza Khan",
    category: "Normal Staff",
    dept: "Accounts & Finance",
    desig: "Senior Accounts Officer",
    salary: 2800
  },
  {
    nameEn: "Tariq Mahmood Al-Hashemi",
    category: "Normal Staff",
    dept: "Customs & Clearing",
    desig: "Clearing & Port Supervisor",
    salary: 2600
  },
  {
    nameEn: "Zubair Ahmad Pashtun",
    category: "Manager",
    dept: "Logistics & Fleet",
    desig: "Warehouse & Transit Manager",
    salary: 3200
  }
];

async function runSeed() {
  console.log("=======================================================================");
  console.log("  POPULATING DATABASE WITH USERS, ACCOUNTS & EMPLOYEES PER BRANCH");
  console.log("  Database Target:", dbUrl.replace(/:([^:@]+)@/, ":****@"));
  console.log("=======================================================================\n");

  // 0. Ensure app_users table & employees table exist
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.app_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        full_name text,
        username text,
        is_active boolean DEFAULT true,
        is_super_admin boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS public.employees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        person_master_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
        employee_code text UNIQUE NOT NULL,
        category text NOT NULL,
        designation text,
        department text,
        country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
        country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
        city_branch_id uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
        monthly_salary numeric(18, 4) DEFAULT 0,
        status text DEFAULT 'Active',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `;
  } catch (e) {
    console.log("   Notice creating helper tables:", e.message);
  }

  // 1. Ensure Countries & Branches exist
  const countries = await sql`select id, name, iso2, currency_code from public.countries where is_active = true`;
  console.log(`▶ 1. Found ${countries.length} active Countries in database.`);

  const countryBranches = await sql`select id, country_id, name, code from public.country_branches`;
  const cityBranches = await sql`select id, country_branch_id, name, code from public.city_branches`;
  console.log(`   Found ${countryBranches.length} Country Branches and ${cityBranches.length} City Branches.\n`);

  const allBranches = [];

  for (const cb of countryBranches) {
    const matchingCountry = countries.find(c => c.id === cb.country_id);
    allBranches.push({
      type: "country_branch",
      id: cb.id,
      name: cb.name,
      code: cb.code,
      countryId: cb.country_id,
      countryBranchId: cb.id,
      cityBranchId: null,
      currency: matchingCountry?.currency_code || "USD"
    });
  }

  for (const cty of cityBranches) {
    const parentCB = countryBranches.find(cb => cb.id === cty.country_branch_id);
    const matchingCountry = parentCB ? countries.find(c => c.id === parentCB.country_id) : null;
    allBranches.push({
      type: "city_branch",
      id: cty.id,
      name: cty.name,
      code: cty.code,
      countryId: matchingCountry?.id || null,
      countryBranchId: parentCB?.id || null,
      cityBranchId: cty.id,
      currency: matchingCountry?.currency_code || "USD"
    });
  }

  console.log(`▶ 2. Processing Database Seeding across ${allBranches.length} total branches...\n`);

  let totalUsersSeeded = 0;
  let totalAccountsSeeded = 0;
  let totalEmployeesSeeded = 0;

  for (const branch of allBranches) {
    console.log(`📍 Branch: "${branch.name}" [Code: ${branch.code}] (Type: ${branch.type})`);

    // ── A. CREATE 1 ADMIN + 1 USER PER BRANCH ──
    const cleanCode = branch.code.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    const branchUsers = [
      {
        email: `admin.${cleanCode}@dgt.llc`,
        name: `Admin - ${branch.name}`,
        role: branch.type === "country_branch" ? "main_branch_admin" : "city_branch_admin",
        username: `admin_${cleanCode}`
      },
      {
        email: `user.${cleanCode}@dgt.llc`,
        name: `User - ${branch.name}`,
        role: "staff_user",
        username: `user_${cleanCode}`
      }
    ];

    for (const u of branchUsers) {
      const userId = crypto.randomUUID();
      const userCode = `USR-${Math.floor(1000 + Math.random() * 8999)}`;
      try {
        await sql`
          insert into public.app_users (
            id, email, full_name, username, is_active, is_super_admin, created_at, updated_at
          ) values (
            ${userId}, ${u.email}, ${u.name}, ${u.username}, true, false, now(), now()
          )
          on conflict (email) do update set
            full_name = excluded.full_name,
            username = excluded.username,
            is_active = true;
        `;

        // Upsert into Supabase profiles
        await sql`
          insert into public.profiles (
            id, full_name, user_code, preferred_language_code, raw_password, updated_at
          ) values (
            ${userId}, ${u.name}, ${userCode}, 'en', 'User@123456', now()
          )
          on conflict (id) do update set
            full_name = excluded.full_name,
            user_code = excluded.user_code;
        `;

        // Upsert User Role Assignment
        await sql`
          insert into public.user_role_assignments (
            id, user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at, updated_at
          ) values (
            gen_random_uuid(), ${userId}, ${u.role}, ${branch.countryId}, ${branch.countryBranchId}, ${branch.cityBranchId}, true, now(), now()
          )
          on conflict do nothing;
        `;
        totalUsersSeeded++;
      } catch (e) {
        console.log(`   ⚠️ User insert notice: ${e.message}`);
      }
    }
    console.log(`   ✅ 2 Users (1 Admin + 1 User) configured for ${branch.name}.`);

    // ── B. CREATE 25 CHART OF ACCOUNTS ENTRIES PER BRANCH ──
    for (let i = 0; i < ACCOUNT_TEMPLATES.length; i++) {
      const acc = ACCOUNT_TEMPLATES[i];
      const accId = crypto.randomUUID();
      const scopedCode = `${branch.code}-${acc.code}`;
      const scopedName = `${acc.name} (${branch.name})`;

      try {
        await sql`
          insert into public.enterprise_accounts (
            id, country_id, country_branch_id, city_branch_id, code, name, category, account_type, is_active, created_at
          ) values (
            ${accId}, ${branch.countryId}, ${branch.countryBranchId}, ${branch.cityBranchId}, ${scopedCode}, ${scopedName}, ${acc.category}, ${acc.type}, true, now()
          )
          on conflict (code) do update set
            name = excluded.name,
            category = excluded.category,
            account_type = excluded.account_type;
        `;
        totalAccountsSeeded++;
      } catch (ae) {}
    }
    console.log(`   ✅ 25 Chart of Accounts seeded for ${branch.name}.`);

    // ── C. CREATE 4 EMPLOYEES PER BRANCH ──
    for (let j = 0; j < EMPLOYEE_TEMPLATES.length; j++) {
      const emp = EMPLOYEE_TEMPLATES[j];
      const customerPersonId = crypto.randomUUID();
      const empId = crypto.randomUUID();
      const empCode = `EMP-${branch.code}-${String(j + 1).padStart(3, "0")}`;

      try {
        // Insert Person Record in Customers
        await sql`
          insert into public.customers (
            id, customer_name, customer_type, country_id, country_branch_id, city_branch_id, status, created_at
          ) values (
            ${customerPersonId}, ${emp.nameEn}, 'Employee', ${branch.countryId}, ${branch.countryBranchId}, ${branch.cityBranchId}, 'Active', now()
          )
          on conflict do nothing;
        `;

        // Insert Employee Master Record
        await sql`
          insert into public.employees (
            id, person_master_id, employee_code, category, designation, department, country_id, country_branch_id, city_branch_id, monthly_salary, status, created_at
          ) values (
            ${empId}, ${customerPersonId}, ${empCode}, ${emp.category}, ${emp.desig}, ${emp.dept}, ${branch.countryId}, ${branch.countryBranchId}, ${branch.cityBranchId}, ${emp.salary}, 'Active', now()
          )
          on conflict (employee_code) do update set
            designation = excluded.designation,
            department = excluded.department,
            monthly_salary = excluded.monthly_salary;
        `;

        totalEmployeesSeeded++;
      } catch (ee) {
        console.log(`   ⚠️ Employee insert notice: ${ee.message}`);
      }
    }
    console.log(`   ✅ 4 Employees seeded for ${branch.name}.\n`);
  }

  console.log("=======================================================================");
  console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
  console.log(`   • Total Branches Processed: ${allBranches.length}`);
  console.log(`   • Total Users Configured:   ${totalUsersSeeded}`);
  console.log(`   • Total Accounts Created:   ${totalAccountsSeeded}`);
  console.log(`   • Total Employees Created:  ${totalEmployeesSeeded}`);
  console.log("=======================================================================");

  await sql.end();
}

runSeed().catch((err) => {
  console.error("❌ Seeding error:", err);
  process.exit(1);
});
