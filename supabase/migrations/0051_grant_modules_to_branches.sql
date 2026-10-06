-- Assign Purchase, Roznamcha, Ledger, Account, and Journal Entry permissions to Country and Branch admins

do $$
declare
  perm text;
  r record;
  p_id uuid;
  perms text[] := array[
    'purchases:read', 'purchases:create', 'purchases:update', 'purchases:delete', 'purchases:post',
    'roznamcha:read', 'roznamcha:create', 'roznamcha:update', 'roznamcha:post',
    'ledgers:read', 'ledgers:create',
    'accounts:read', 'accounts:create', 'accounts:update',
    'journal_entries:read', 'journal_entries:create', 'journal_entries:update', 'journal_entries:post',
    'ledger:read', 'transactions:read', 'transactions:create', 'transactions:post'
  ];
begin
  -- Ensure all missing permissions exist in permissions table
  for perm in select unnest(perms) loop
    insert into permissions (name, description, resource, action)
    values (
      perm, 
      'Auto-generated permission for ' || perm, 
      split_part(perm, ':', 1), 
      split_part(perm, ':', 2)
    )
    on conflict (name) do nothing;
  end loop;

  -- For each branch or country role, grant these permissions
  for r in select id from roles where name ilike '%admin%' or name ilike '%country%' or name ilike '%branch%' loop
    for perm in select unnest(perms) loop
      select id into p_id from permissions where name = perm;
      if p_id is not null then
        insert into role_permissions (role_id, permission_id)
        values (r.id, p_id)
        on conflict (role_id, permission_id) do nothing;
      end if;
    end loop;
  end loop;
end;
$$;
