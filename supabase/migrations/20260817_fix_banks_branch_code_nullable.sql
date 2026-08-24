-- Migration: 20260817_fix_banks_branch_code_nullable.sql
-- Ensure branch_code in banks table is nullable and has a default value so saving bank master never fails on branch_code constraint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'banks' 
      AND column_name = 'branch_code'
  ) THEN
    ALTER TABLE public.banks ALTER COLUMN branch_code DROP NOT NULL;
    ALTER TABLE public.banks ALTER COLUMN branch_code SET DEFAULT '0000';
  END IF;
END $$;
