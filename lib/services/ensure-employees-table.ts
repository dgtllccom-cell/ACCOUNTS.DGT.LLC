import postgres from "postgres";
import fs from "fs";
import path from "path";

export async function ensureEmployeesTable(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[HR-PAYROLL] DATABASE_URL is not set");
    return false;
  }

  const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });
  try {
    const sqlPath = path.join(process.cwd(), "supabase/migrations/0071_employee_and_salary.sql");
    if (fs.existsSync(sqlPath)) {
      const sqlContent = fs.readFileSync(sqlPath, "utf8");
      await sql.unsafe(sqlContent);
    } else {
      // Fallback create table if migration file path is somehow missing
      await sql`
        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          person_master_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
          employee_code text NOT NULL UNIQUE,
          category text NOT NULL,
          designation text,
          department text,
          country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
          country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
          city_branch_id uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
          reporting_manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
          joining_date date,
          probation_start_date date,
          probation_end_date date,
          employment_type text,
          job_status text,
          working_shift text,
          duty_start_time text,
          duty_end_time text,
          weekly_off_day text,
          contract_start_date date,
          contract_end_date date,
          status text NOT NULL DEFAULT 'Active',
          salary_type text,
          basic_salary numeric(18, 4) NOT NULL DEFAULT 0,
          salary_currency text NOT NULL DEFAULT 'USD',
          monthly_salary numeric(18, 4) NOT NULL DEFAULT 0,
          daily_salary numeric(18, 4) NOT NULL DEFAULT 0,
          hourly_salary numeric(18, 4) NOT NULL DEFAULT 0,
          overtime_rate numeric(18, 4) NOT NULL DEFAULT 0,
          allowance numeric(18, 4) NOT NULL DEFAULT 0,
          accommodation_allowance numeric(18, 4) NOT NULL DEFAULT 0,
          transport_allowance numeric(18, 4) NOT NULL DEFAULT 0,
          food_allowance numeric(18, 4) NOT NULL DEFAULT 0,
          mobile_allowance numeric(18, 4) NOT NULL DEFAULT 0,
          other_allowance numeric(18, 4) NOT NULL DEFAULT 0,
          deduction numeric(18, 4) NOT NULL DEFAULT 0,
          advance_deduction numeric(18, 4) NOT NULL DEFAULT 0,
          loan_deduction numeric(18, 4) NOT NULL DEFAULT 0,
          tax_deduction numeric(18, 4) NOT NULL DEFAULT 0,
          net_salary numeric(18, 4) NOT NULL DEFAULT 0,
          salary_start_date date,
          salary_payment_date date,
          salary_payment_method text,
          salary_schedule text,
          salary_schedule_date text,
          salary_expense_account_id uuid REFERENCES public.ledgers(id) ON DELETE SET NULL,
          employee_payable_account_id uuid REFERENCES public.ledgers(id) ON DELETE SET NULL,
          cash_account_id uuid REFERENCES public.ledgers(id) ON DELETE SET NULL,
          bank_account_id uuid REFERENCES public.ledgers(id) ON DELETE SET NULL,
          advance_salary_account_id uuid REFERENCES public.ledgers(id) ON DELETE SET NULL,
          loan_account_id uuid REFERENCES public.ledgers(id) ON DELETE SET NULL,
          deduction_account_id uuid REFERENCES public.ledgers(id) ON DELETE SET NULL,
          created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          deleted_at timestamptz
        );
      `;
    }

    await sql`GRANT ALL ON public.employees TO authenticated, service_role, postgres, anon;`;
    await sql`GRANT ALL ON public.employee_salaries_due TO authenticated, service_role, postgres, anon;`;
    await sql`GRANT ALL ON public.employee_advances_loans TO authenticated, service_role, postgres, anon;`;
    await sql`NOTIFY pgrst, 'reload schema';`;

    console.log("[HR-PAYROLL] Successfully ensured employees table and reloaded schema cache");
    return true;
  } catch (err: any) {
    console.error("[HR-PAYROLL] Exception in ensureEmployeesTable:", err.message);
    return false;
  } finally {
    await sql.end();
  }
}
