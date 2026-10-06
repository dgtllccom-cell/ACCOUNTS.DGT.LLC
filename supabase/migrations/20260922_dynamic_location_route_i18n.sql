-- Register erp_locations.name / route_templates.name+description with the central
-- multilingual field registry, matching the existing pattern for ports.port_name /
-- warehouses.warehouse_name (0260808_multilingual_automation.sql): 'transliterate'
-- re-renders the SAME proper noun in the viewer's script, it does not machine-translate
-- meaning — required per CLAUDE.md's central i18n policy for any new user-facing
-- record-name column.

insert into public.translation_field_registry (table_name, field_name, mode) values
  ('erp_locations', 'name', 'transliterate'),
  ('route_templates', 'name', 'transliterate'),
  ('route_templates', 'description', 'translate')
on conflict (table_name, field_name) do nothing;

select public.attach_translation_triggers();
