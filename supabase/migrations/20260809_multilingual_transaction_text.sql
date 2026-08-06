-- ============================================================================
-- Extend multilingual coverage to transaction / operational descriptive text:
-- narration, description, notes, remarks, memo on Roznamcha / Journal / Ledger /
-- Purchase / Sales / Payments / Bills / Logistics tables.
--
-- These are stored via the enrollment model (original preserved as the fallback in
-- all five languages, status 'pending') — never machine-mangled. Depends on the
-- registry + trigger created in 20260808_multilingual_automation.sql.
-- Idempotent / replay-safe.
-- ============================================================================

insert into public.translation_field_registry (table_name, field_name, mode) values
  ('approval_status_history','note','translate'),
  ('banks','remarks','translate'),
  ('clearing_agents','notes','translate'),
  ('communication_center_followups','notes','translate'),
  ('communication_center_leads','notes','translate'),
  ('customers','notes','translate'),
  ('import_truck_loadings','remarks','translate'),
  ('inter_branch_ledger_transfers','remarks','translate'),
  ('journal_entries','memo','translate'),
  ('journal_lines','description','translate'),
  ('ledger_posting_batches','narration','translate'),
  ('ledger_posting_lines','description','translate'),
  ('ledger_posting_lines','remarks','translate'),
  ('purchase_loading_records','remarks','translate'),
  ('purchase_order_expenses','description','translate'),
  ('purchase_order_payments','narration','translate'),
  ('roznamcha_entries','narration','translate'),
  ('roznamcha_lines','description','translate'),
  ('sales_order_payments','remarks','translate'),
  ('transactions','description','translate'),
  ('transit_truck_loadings','remarks','translate'),
  ('truck_loadings','remarks','translate'),
  ('trucks','notes','translate'),
  ('whatsapp_contacts','notes','translate')
on conflict (table_name, field_name) do nothing;

-- Attach the enrollment trigger to any newly-covered base tables.
select public.attach_translation_triggers();
