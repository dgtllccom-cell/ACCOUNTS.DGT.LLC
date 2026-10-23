-- Ensure profiles table has employee and person master links, plus name fields
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS person_master_id text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS photo_url text;

CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_person_master_id ON public.profiles(person_master_id) WHERE person_master_id IS NOT NULL;
