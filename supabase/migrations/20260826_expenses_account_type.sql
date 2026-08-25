-- ============================================================================
-- MIGRATION: 20260826_expenses_account_type.sql
-- Add "Expenses Account" under account_types and register 5-language translations
-- ============================================================================

DO $$
DECLARE
  v_exp_id uuid;
  v_exp_alias_id uuid;
BEGIN
  -- 1. Insert 'EXPENSES' into account_types if not exists
  SELECT id INTO v_exp_id FROM public.account_types WHERE code = 'EXPENSES' AND deleted_at IS NULL LIMIT 1;
  IF v_exp_id IS NULL THEN
    INSERT INTO public.account_types (code, name, account_kind, is_system)
    VALUES ('EXPENSES', 'Expenses Account', 'expense', true)
    RETURNING id INTO v_exp_id;
  ELSE
    UPDATE public.account_types
    SET name = 'Expenses Account', account_kind = 'expense', updated_at = now()
    WHERE id = v_exp_id;
  END IF;

  -- 2. Insert 'EXPENSE' alias into account_types if not exists
  SELECT id INTO v_exp_alias_id FROM public.account_types WHERE code = 'EXPENSE' AND deleted_at IS NULL LIMIT 1;
  IF v_exp_alias_id IS NULL THEN
    INSERT INTO public.account_types (code, name, account_kind, is_system)
    VALUES ('EXPENSE', 'Expense Account', 'expense', true)
    RETURNING id INTO v_exp_alias_id;
  ELSE
    UPDATE public.account_types
    SET name = 'Expense Account', account_kind = 'expense', updated_at = now()
    WHERE id = v_exp_alias_id;
  END IF;

  -- 3. Upsert into record_translations safely using delete-insert
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'record_translations') THEN
    DELETE FROM public.record_translations
    WHERE record_table = 'account_types' AND record_id IN (v_exp_id, v_exp_alias_id) AND field_name = 'name';

    INSERT INTO public.record_translations (
      record_table, record_id, field_name, original_text, original_language_code,
      english_text, urdu_text, arabic_text, persian_text, pashto_text,
      language_texts, source, translation_status, translated_by_engine, translated_at
    )
    VALUES (
      'account_types', v_exp_id, 'name', 'Expenses Account', 'en',
      'Expenses Account', 'اخراجات کا اکاؤنٹ', 'حساب المصروفات', 'حساب هزینه‌ها', 'د لګښتونو حساب',
      '{"en":"Expenses Account","ur":"اخراجات کا اکاؤنٹ","ar":"حساب المصروفات","fa":"حساب هزینه‌ها","ps":"د لګښتونو حساب"}'::jsonb,
      'auto', 'complete', 'dictionary', now()
    ),
    (
      'account_types', v_exp_alias_id, 'name', 'Expense Account', 'en',
      'Expense Account', 'اخراجات کا اکاؤنٹ', 'حساب المصروفات', 'حساب هزینه‌ها', 'د لګښتونو حساب',
      '{"en":"Expense Account","ur":"اخراجات کا اکاؤنٹ","ar":"حساب المصروفات","fa":"حساب هزینه‌ها","ps":"د لګښتونو حساب"}'::jsonb,
      'auto', 'complete', 'dictionary', now()
    );
  END IF;
END $$;
