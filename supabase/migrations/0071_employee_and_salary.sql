-- Enterprise ERP: Employee Master and Salary Management Module
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_master_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  employee_code text NOT NULL UNIQUE,
  category text NOT NULL, -- 'Manager', 'Normal Staff', 'Employee', 'Others'
  designation text,
  department text,
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  reporting_manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  joining_date date,
  probation_start_date date,
  probation_end_date date,
  employment_type text, -- 'Full-time', 'Part-time', 'Contract', etc.
  job_status text,
  working_shift text,
  duty_start_time text,
  duty_end_time text,
  weekly_off_day text,
  contract_start_date date,
  contract_end_date date,
  status text NOT NULL DEFAULT 'Active', -- 'Active', 'Inactive', 'On Leave', 'Suspended', 'Resigned', 'Terminated'
  
  -- Salary Details
  salary_type text, -- 'Monthly', 'Weekly', 'Daily', 'Hourly', 'Custom'
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
  salary_payment_method text, -- 'Cash', 'Bank', 'Employee Account', 'Other'
  salary_schedule text, -- 'Monthly', 'Weekly', 'Daily', 'Custom'
  salary_schedule_date text, -- '1st', '5th', '10th', 'last', 'custom_date'

  -- Salary Accounts Integration
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

CREATE INDEX IF NOT EXISTS employees_person_idx ON public.employees (person_master_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS employees_country_branch_idx ON public.employees (country_id, country_branch_id) WHERE deleted_at IS NULL;

-- Table for tracking Monthly / Period Salary Due Registers
CREATE TABLE IF NOT EXISTS public.employee_salaries_due (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_month text NOT NULL, -- e.g. '2026-07'
  due_date date NOT NULL,
  basic_salary numeric(18, 4) NOT NULL DEFAULT 0,
  allowances numeric(18, 4) NOT NULL DEFAULT 0,
  overtime numeric(18, 4) NOT NULL DEFAULT 0,
  deductions numeric(18, 4) NOT NULL DEFAULT 0,
  advance_recovery numeric(18, 4) NOT NULL DEFAULT 0,
  loan_recovery numeric(18, 4) NOT NULL DEFAULT 0,
  net_salary numeric(18, 4) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  exchange_rate numeric(18, 8) NOT NULL DEFAULT 1,
  local_currency_amount numeric(18, 4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Due', -- 'Upcoming', 'Due', 'Partially Paid', 'Paid', 'Overdue', 'Held'
  payment_method text,
  payment_account_id uuid REFERENCES public.ledgers(id) ON DELETE SET NULL,
  
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL, -- Roznamcha link when salary is accrued (Expenses Dr / Payables Cr)
  payment_journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL, -- Roznamcha link when salary is transferred (Payables Dr / Cash/Bank Cr)
  
  transfer_date timestamptz,
  posting_date date,
  paid_date date,
  
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  transferred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Table for tracking Advance Salary and Loans given to employees
CREATE TABLE IF NOT EXISTS public.employee_advances_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'Salary Advance', 'Employee Loan', 'Emergency Advance', 'Travel Advance', 'Other Advance'
  amount numeric(18, 4) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  payment_date date NOT NULL,
  payment_account_id uuid REFERENCES public.ledgers(id) ON DELETE SET NULL,
  recovery_method text,
  monthly_deduction numeric(18, 4) NOT NULL DEFAULT 0,
  remaining_balance numeric(18, 4) NOT NULL DEFAULT 0,
  start_month text, -- e.g. '2026-08'
  end_month text, -- e.g. '2027-08'
  remarks text,
  status text NOT NULL DEFAULT 'Active', -- 'Active', 'Completed'
  
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL, -- Roznamcha link when loan/advance is paid
  
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
