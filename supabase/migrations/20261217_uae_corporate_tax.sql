-- UAE Corporate Tax — inside the EXISTING UAE Tax & E-Invoicing module — ADDITIVE.
--
-- Reuses the tax entity (uae_tax_entities: company + TRN), Company Master, the Document Manager
-- (office_documents) for evidence and User Tasks for the deadline reminder. One CT return working
-- per entity per financial year: accounting profit → adjustments → taxable income → relief →
-- tax at 9% above AED 375,000. The ERP does NOT file with the FTA: 'filed' / 'paid' only record the
-- EmaraTax reference the user filed / paid under. No accounting entry is made here.
-- Rollback: DROP TABLE uae_ct_events, uae_ct_documents, uae_ct_adjustments, uae_ct_returns;

BEGIN;

CREATE TABLE IF NOT EXISTS public.uae_ct_returns (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_no               text NOT NULL,
  tax_entity_id           uuid NOT NULL REFERENCES public.uae_tax_entities(id),
  company_id              uuid REFERENCES public.companies(id),
  country_id              uuid NOT NULL REFERENCES public.countries(id),
  ct_trn                  text,                               -- Corporate Tax registration number
  fy_start                date NOT NULL,
  fy_end                  date NOT NULL,
  filing_deadline         date NOT NULL,                      -- 9 months after the end of the tax period
  status                  text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','in_preparation','ready_for_review','reviewed','filed','paid','cancelled')),
  accounting_profit       numeric(18,2),
  accounting_profit_source text,                              -- e.g. 'Audited financial statements FY2025'
  revenue                 numeric(18,2),
  small_business_relief   boolean NOT NULL DEFAULT false,
  qualifying_free_zone    boolean NOT NULL DEFAULT false,
  qualifying_income       numeric(18,2) NOT NULL DEFAULT 0,
  tax_losses_brought_forward numeric(18,2) NOT NULL DEFAULT 0,
  taxable_income          numeric(18,2),
  loss_relief_used        numeric(18,2),
  tax_payable             numeric(18,2),
  computed_at             timestamptz,
  responsible_user_id     uuid,
  reminder_task_id        uuid REFERENCES public.user_tasks(id),
  filing_reference        text,
  filed_at                timestamptz,
  filed_by                uuid,
  payment_reference       text,
  paid_amount             numeric(18,2),
  paid_at                 timestamptz,
  notes                   text,
  created_by              uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz,
  CONSTRAINT uae_ct_returns_fy_chk CHECK (fy_end > fy_start)
);
CREATE UNIQUE INDEX IF NOT EXISTS uae_ct_returns_no_uq ON public.uae_ct_returns (return_no);
CREATE UNIQUE INDEX IF NOT EXISTS uae_ct_returns_entity_fy_uq ON public.uae_ct_returns (tax_entity_id, fy_start, fy_end)
  WHERE deleted_at IS NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS uae_ct_returns_deadline_idx ON public.uae_ct_returns (filing_deadline) WHERE deleted_at IS NULL AND status NOT IN ('filed','paid','cancelled');

CREATE TABLE IF NOT EXISTS public.uae_ct_adjustments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id    uuid NOT NULL REFERENCES public.uae_ct_returns(id) ON DELETE CASCADE,
  category     text NOT NULL CHECK (category IN ('add_back','deduction','exempt_income')),
  description  text NOT NULL,
  amount       numeric(18,2) NOT NULL CHECK (amount >= 0),
  reference    text,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uae_ct_adjustments_return_idx ON public.uae_ct_adjustments (return_id, sort_order);

CREATE TABLE IF NOT EXISTS public.uae_ct_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id    uuid NOT NULL REFERENCES public.uae_ct_returns(id) ON DELETE CASCADE,
  doc_key      text NOT NULL,
  status       text NOT NULL DEFAULT 'missing' CHECK (status IN ('missing','received','not_applicable')),
  document_id  uuid,                                          -- office_documents.id (Document Manager)
  notes        text,
  updated_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (return_id, doc_key)
);

CREATE TABLE IF NOT EXISTS public.uae_ct_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id    uuid NOT NULL REFERENCES public.uae_ct_returns(id) ON DELETE CASCADE,
  action       text NOT NULL,
  from_status  text,
  to_status    text,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id     uuid,
  actor_name   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uae_ct_events_idx ON public.uae_ct_events (return_id, created_at DESC);

COMMENT ON TABLE public.uae_ct_returns IS 'UAE Corporate Tax return working per tax entity + financial year. Filing / payment are recorded references only — the ERP does not submit to the FTA.';

COMMIT;
