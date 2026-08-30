-- Migration: Cleanup and standardize User Directory to the 18 authentic operational users
-- Dynamically reassigns FK audit references to SUPERADMIN and deletes test/demo users.

DO $$
DECLARE
  v_superadmin_id uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_kept_codes text[] := ARRAY[
    'SUPERADMIN',
    'CLEARINGADMIN',
    'AF-ADMIN',
    'PK-ADMIN',
    'ARE-ADMIN',
    'IN-ADMIN',
    'AFGMAIN001-MAIN-ADMIN',
    'PAKMAIN001-MAIN-ADMIN',
    'AREMAIN001-MAIN-ADMIN',
    'INDMAIN001-MAIN-ADMIN',
    'AFGKDH001-ADMIN',
    'PAKCHM001-ADMIN',
    'PAKQUE001-ADMIN',
    'UAEALRAS001-ADMIN',
    'INDBOM001-ADMIN',
    'CLEARING-AFGKDH001',
    'CLEARING-PAKCHM001',
    'CLEARING-UAEALRAS001',
    'CLEARING-INDBOM001'
  ];
  v_ids_to_delete uuid[];
  r RECORD;
BEGIN
  -- 1. Identify profiles to delete
  SELECT array_agg(id) INTO v_ids_to_delete
  FROM public.profiles
  WHERE user_code IS NULL OR NOT (user_code = ANY(v_kept_codes));

  IF v_ids_to_delete IS NOT NULL AND array_length(v_ids_to_delete, 1) > 0 THEN
    -- Dynamically reassign all FK references to SUPERADMIN
    FOR r IN (
      SELECT kcu.table_schema, kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'profiles'
        AND ccu.column_name = 'id'
        AND kcu.table_name NOT IN ('user_role_assignments', 'user_scope_assignments', 'user_permission_sets', 'user_scopes', 'user_roles')
    ) LOOP
      EXECUTE format(
        'UPDATE %I.%I SET %I = %L WHERE %I = ANY(%L::uuid[])',
        r.table_schema, r.table_name, r.column_name, v_superadmin_id, r.column_name, v_ids_to_delete
      );
    END LOOP;

    -- Delete RBAC and user permission assignments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'user_role_assignments') THEN
      DELETE FROM public.user_role_assignments WHERE user_id = ANY(v_ids_to_delete);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'user_scope_assignments') THEN
      DELETE FROM public.user_scope_assignments WHERE user_id = ANY(v_ids_to_delete);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'user_permission_sets') THEN
      DELETE FROM public.user_permission_sets WHERE user_id = ANY(v_ids_to_delete);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'user_scopes') THEN
      DELETE FROM public.user_scopes WHERE user_id = ANY(v_ids_to_delete);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'user_roles') THEN
      DELETE FROM public.user_roles WHERE user_id = ANY(v_ids_to_delete);
    END IF;
    
    -- Delete profiles
    DELETE FROM public.profiles WHERE id = ANY(v_ids_to_delete);
  END IF;

END $$;
