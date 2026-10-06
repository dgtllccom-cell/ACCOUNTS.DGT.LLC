-- Additive: repeatable contract details on the company master (in-form "+ Add" list).
-- Stores an array of { id, type, reference, startDate, endDate, note } objects.
-- Purely additive; no accounting impact, no data migration, existing rows default to [].
alter table public.companies
  add column if not exists contracts jsonb not null default '[]'::jsonb;

comment on column public.companies.contracts is
  'Repeatable contract details captured in the Company form (array of {id,type,reference,startDate,endDate,note}); tracking only, no accounting posting.';
