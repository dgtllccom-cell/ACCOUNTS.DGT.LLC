insert into permissions (resource, action, description)
values
  ('companies', 'read', 'View company records'),
  ('branches', 'read', 'View branch records'),
  ('users', 'read', 'View users and memberships'),
  ('users', 'update', 'Manage user memberships'),
  ('roles', 'read', 'View roles'),
  ('roles', 'update', 'Manage roles and permissions'),
  ('accounts', 'create', 'Create accounts'),
  ('accounts', 'read', 'View accounts'),
  ('accounts', 'update', 'Update accounts'),
  ('journal_entries', 'create', 'Create journal entries'),
  ('journal_entries', 'read', 'View journal entries'),
  ('journal_entries', 'update', 'Edit draft journal entries'),
  ('journal_entries', 'post', 'Post balanced journal entries'),
  ('ledger', 'read', 'View ledger records'),
  ('reports', 'read', 'View reports'),
  ('reports', 'export', 'Export reports'),
  ('attachments', 'create', 'Upload attachments'),
  ('attachments', 'read', 'View attachments')
on conflict (resource, action) do nothing;
