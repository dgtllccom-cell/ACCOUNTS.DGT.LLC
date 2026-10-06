-- ============================================================================
-- 20261127 — Invoice & Print Templates: default-template resolution table
--
-- Stores which visual TEMPLATE (classic / modern / professional / compact /
-- premium — see lib/reports/invoice-templates/registry.ts) a Sales / Purchase
-- / Local Sales / Local Purchase invoice/print action should default to, at a
-- given scope. Resolution priority (most specific wins), implemented in
-- lib/invoice-templates/resolve-default.server.ts:
--
--   Document Type → City Branch → Main (Country) Branch → Country → Company → global
--
-- One row = one (scope_type, scope_id, document_type) combination.
--   scope_type = 'global'          scope_id NULL          — the fallback default
--   scope_type = 'company'         scope_id = companies.id
--   scope_type = 'country'         scope_id = countries.id
--   scope_type = 'country_branch'  scope_id = country_branches.id  (Main Branch)
--   scope_type = 'city_branch'     scope_id = city_branches.id
-- document_type NULL = applies to every document type at that scope; a
-- specific document_type row (e.g. only 'packing_list') overrides the
-- any-document-type row at the SAME scope.
--
-- This is a pure UI-preference/settings table: no accounting, no business
-- data, no relation to Ledger/Roznamcha/Stock. Additive & idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.invoice_template_defaults (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  scope_type         text NOT NULL
                       CHECK (scope_type IN ('global','company','country','country_branch','city_branch')),
  scope_id           uuid,

  document_type      text
                       CHECK (document_type IS NULL OR document_type IN
                         ('commercial_invoice','export_invoice','packing_list','proforma_invoice','contract')),

  template_id        text NOT NULL,

  show_logo          boolean NOT NULL DEFAULT true,
  show_bank_details  boolean NOT NULL DEFAULT true,
  show_terms         boolean NOT NULL DEFAULT true,

  is_active          boolean NOT NULL DEFAULT true,

  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT invoice_template_defaults_scope_id_check CHECK (
    (scope_type = 'global' AND scope_id IS NULL) OR
    (scope_type <> 'global' AND scope_id IS NOT NULL)
  )
);

-- One row per (scope_type, scope_id, document_type) — NULLs normalized so a
-- single "global / any document type" row is enforced too.
CREATE UNIQUE INDEX IF NOT EXISTS invoice_template_defaults_scope_uq
  ON public.invoice_template_defaults (
    scope_type,
    COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(document_type, '*')
  );

CREATE INDEX IF NOT EXISTS idx_invoice_template_defaults_scope_id
  ON public.invoice_template_defaults (scope_id) WHERE scope_id IS NOT NULL;

COMMIT;
