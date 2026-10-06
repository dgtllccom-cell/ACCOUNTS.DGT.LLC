-- =============================================================================
-- AI Document Intake, Verification & Workflow Automation — Phase 1 (Foundation)
-- Migration: 20260925_document_intelligence_foundation.sql
--
-- Self-hosted document intake. Local OCR/parse is the default + complete path;
-- a provider-adapter lets an approved external provider be added later. The AI
-- prepares a REVIEWED DRAFT only — it never posts to Journal / Roznamcha / GL /
-- Ledger / Tax / Settlement / Stock, and never links a document to a source
-- record without an authorized in-scope match.
--
--   * document_type_registry    — configurable document types per domain
--   * document_intake_jobs       — one row per uploaded document
--   * document_intake_fields     — one row per extracted field (confidence, bbox)
--   * document_intake_line_items — extracted goods lines
--   * document_intake_matches    — candidate source-record matches (in-scope only)
--   * document_intake_events     — append-only audit
--
-- Non-destructive: 6 new tables + 1 view + a document-type seed. Nothing
-- existing (office_documents / erp_documents / shipment_documents / document_types
-- / purchase_orders / sales_orders / shipping_* / clearing_*) is modified.
-- =============================================================================

BEGIN;

-- ── 1. document_type_registry ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_type_registry (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL,
  name               text NOT NULL,
  operational_domain text NOT NULL DEFAULT 'business' CHECK (operational_domain IN ('business','shipping','both')),
  category           text NOT NULL CHECK (category IN ('purchase','sales','shipping','clearing','finance','other')),
  target_module      text,                       -- where a confirmed draft is routed
  expected_fields    jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ "key","label","required":true }]
  classifier_keywords text[] NOT NULL DEFAULT '{}',
  min_confidence     numeric(5,2) NOT NULL DEFAULT 0.60,
  requires_qvc       boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  rank_order         int NOT NULL DEFAULT 0,
  country_id         uuid REFERENCES public.countries(id) ON DELETE CASCADE,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS document_type_registry_code_uidx
  ON public.document_type_registry (lower(code), coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.document_type_registry IS
  'Configurable AI-intake document types. New types are added here without changing the engine.';

-- ── 2. document_intake_jobs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_intake_jobs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_no                text NOT NULL,
  operational_domain    text NOT NULL CHECK (operational_domain IN ('business','shipping')),
  -- scoped composite identity components
  company_id            uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  country_id            uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id     uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id        uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  clearing_agent_id     uuid REFERENCES public.clearing_agents(id) ON DELETE SET NULL,
  shipping_customer_id  uuid,
  source_module_hint    text,
  purchase_order_id     uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  sales_order_id        uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  contract_reference    text,
  document_reference    text,
  container_reference   text,
  bl_reference          text,
  scope_composite_id    text,                    -- the built composite identity string
  -- upload + file
  uploaded_by           uuid,
  uploaded_by_name      text,
  upload_method         text NOT NULL DEFAULT 'web' CHECK (upload_method IN ('web','scanner_bridge','mobile','api')),
  original_filename     text NOT NULL,
  mime_type             text NOT NULL,
  file_size             bigint NOT NULL DEFAULT 0,
  page_count            int NOT NULL DEFAULT 0,
  storage_key           text NOT NULL,           -- PRIVATE key; never a public URL
  file_sha256           text,
  -- processing
  status                text NOT NULL DEFAULT 'uploaded' CHECK (status IN
                          ('uploaded','validating','ocr','classifying','extracting','matching',
                           'review','qvc','draft_ready','linked','rejected','error','cancelled')),
  provider              text NOT NULL DEFAULT 'local',
  ocr_engine            text,
  ocr_ms                int,
  language_detected     text,
  doc_type_code         text,
  doc_type_confidence   numeric(5,2),
  classification        jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction_summary    jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- matching
  match_status          text NOT NULL DEFAULT 'none' CHECK (match_status IN ('none','auto','user','ambiguous','out_of_scope')),
  matched_source_module text,
  matched_source_id     uuid,
  matched_confidence    numeric(5,2),
  target_module         text,
  draft_id              uuid,
  draft_reference       text,
  -- qvc
  qvc_reason            text,
  qvc_item_id           text,
  qvc_missing           jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- misc
  error                 text,
  idempotency_key       text,
  reviewed_by           uuid,
  reviewed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS document_intake_jobs_job_no_uidx ON public.document_intake_jobs (lower(job_no)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS document_intake_jobs_idem_uidx ON public.document_intake_jobs (idempotency_key) WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS document_intake_jobs_scope_idx ON public.document_intake_jobs (operational_domain, country_id, country_branch_id, city_branch_id, clearing_agent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS document_intake_jobs_status_idx ON public.document_intake_jobs (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS document_intake_jobs_sha_idx ON public.document_intake_jobs (file_sha256) WHERE deleted_at IS NULL AND file_sha256 IS NOT NULL;

COMMENT ON TABLE public.document_intake_jobs IS
  'One row per uploaded document. AI prepares a reviewed draft only; final posting is done by the existing authorized module services.';

-- ── 3. document_intake_fields ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_intake_fields (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            uuid NOT NULL REFERENCES public.document_intake_jobs(id) ON DELETE CASCADE,
  field_key         text NOT NULL,
  field_label       text NOT NULL,
  raw_value         text,
  normalized_value  text,
  corrected_value   text,
  confidence        numeric(5,2) NOT NULL DEFAULT 0,
  page_number       int,
  bbox              jsonb,                       -- { "x","y","w","h" } in page coords
  validation_status text NOT NULL DEFAULT 'amber' CHECK (validation_status IN ('green','amber','red')),
  validation_message text,
  verified          boolean NOT NULL DEFAULT false,
  verified_by       uuid,
  verified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS document_intake_fields_job_key_uidx ON public.document_intake_fields (job_id, lower(field_key));
CREATE INDEX IF NOT EXISTS document_intake_fields_job_idx ON public.document_intake_fields (job_id);

-- ── 4. document_intake_line_items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_intake_line_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid NOT NULL REFERENCES public.document_intake_jobs(id) ON DELETE CASCADE,
  line_no        int NOT NULL DEFAULT 0,
  description    text,
  hs_code        text,
  brand          text,
  variation      text,
  quantity       numeric(18,4),
  unit           text,
  packages       numeric(18,4),
  gross_weight   numeric(18,4),
  net_weight     numeric(18,4),
  unit_price     numeric(18,4),
  amount         numeric(18,4),
  currency       text,
  confidence     numeric(5,2) NOT NULL DEFAULT 0,
  matched_goods_id uuid,
  matched_goods_variation_id uuid,
  page_number    int,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_intake_line_items_job_idx ON public.document_intake_line_items (job_id, line_no);

-- ── 5. document_intake_matches ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_intake_matches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid NOT NULL REFERENCES public.document_intake_jobs(id) ON DELETE CASCADE,
  match_kind     text NOT NULL DEFAULT 'source_record' CHECK (match_kind IN ('source_record','company','customer','supplier','goods','account','port','shipping_line','clearing_agent','warehouse','tax_code','container')),
  source_module  text,
  source_id      uuid,
  label          text NOT NULL,
  score          numeric(5,2) NOT NULL DEFAULT 0,
  scope_ok       boolean NOT NULL DEFAULT false,
  reason         text,
  is_selected    boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_intake_matches_job_idx ON public.document_intake_matches (job_id, match_kind, score DESC);

-- ── 6. document_intake_events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_intake_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES public.document_intake_jobs(id) ON DELETE CASCADE,
  action      text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id    uuid,
  actor_name  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_intake_events_job_idx ON public.document_intake_events (job_id, created_at DESC);

-- ── 7. queue view ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.document_intake_queue_v AS
SELECT
  j.*,
  co.name  AS country_name,
  cb.name  AS country_branch_name,
  cib.name AS city_branch_name,
  ca.name AS clearing_agent_name,
  (SELECT count(*)::int FROM public.document_intake_fields f WHERE f.job_id = j.id) AS field_count,
  (SELECT count(*)::int FROM public.document_intake_fields f WHERE f.job_id = j.id AND f.validation_status = 'red') AS red_field_count,
  (SELECT count(*)::int FROM public.document_intake_line_items li WHERE li.job_id = j.id) AS line_item_count
FROM public.document_intake_jobs j
LEFT JOIN public.countries        co  ON co.id  = j.country_id
LEFT JOIN public.country_branches cb  ON cb.id  = j.country_branch_id
LEFT JOIN public.city_branches    cib ON cib.id = j.city_branch_id
LEFT JOIN public.clearing_agents  ca  ON ca.id  = j.clearing_agent_id
WHERE j.deleted_at IS NULL;

GRANT SELECT ON public.document_intake_queue_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON
  public.document_type_registry, public.document_intake_jobs, public.document_intake_fields,
  public.document_intake_line_items, public.document_intake_matches, public.document_intake_events
  TO authenticated, service_role;

-- ── 8. seed the supported document types ─────────────────────────────────
INSERT INTO public.document_type_registry (code, name, operational_domain, category, target_module, classifier_keywords, requires_qvc, rank_order) VALUES
  -- Purchase
  ('purchase_contract',      'Purchase Contract',            'business','purchase','purchase_orders', ARRAY['purchase contract','sale and purchase agreement','contract no','seller','buyer'], false, 10),
  ('purchase_booking',       'Purchase Booking Confirmation','business','purchase','purchase_orders', ARRAY['booking confirmation','purchase booking','order confirmation'], false, 20),
  ('purchase_order',         'Purchase Order',               'business','purchase','purchase_orders', ARRAY['purchase order','p.o. no','po number'], false, 30),
  ('proforma_invoice',       'Proforma Invoice',             'business','purchase','purchase_orders', ARRAY['proforma invoice','pro forma','pi no'], false, 40),
  ('commercial_invoice',     'Commercial / Supplier Invoice','business','purchase','purchase_orders', ARRAY['commercial invoice','supplier invoice','tax invoice','seller invoice','invoice no','invoice number'], true, 50),
  ('packing_list',           'Packing List',                 'both','purchase','purchase_orders', ARRAY['packing list','packing note','gross weight','net weight','packages'], false, 60),
  ('certificate_of_origin',  'Certificate of Origin',        'both','purchase',NULL, ARRAY['certificate of origin','country of origin','chamber of commerce'], false, 70),
  ('insurance_document',     'Insurance Document',           'both','purchase',NULL, ARRAY['insurance policy','marine insurance','cover note','sum insured'], false, 80),
  ('advance_receipt',        'Advance / Payment Receipt',    'business','finance',NULL, ARRAY['advance receipt','payment receipt','received with thanks','advance payment'], true, 90),
  ('loading_document',       'Loading Document',             'business','purchase','purchase_loading_records', ARRAY['loading list','loading advice','container loading','stuffing report'], false, 100),
  ('receiving_document',     'Receiving Document',            'business','purchase','purchase_loading_records', ARRAY['goods received note','grn','receiving report','delivery received'], false, 110),
  -- Sales
  ('sales_contract',         'Sales Contract',               'business','sales','sales_orders', ARRAY['sales contract','sale agreement','seller','buyer'], false, 200),
  ('sales_booking',          'Sales Booking Confirmation',   'business','sales','sales_orders', ARRAY['sales booking','booking confirmation'], false, 210),
  ('sales_order',            'Sales Order',                  'business','sales','sales_orders', ARRAY['sales order','so no'], false, 220),
  ('customer_po',            'Customer Purchase Order',      'business','sales','sales_orders', ARRAY['purchase order','customer po','buyer order'], false, 230),
  ('sales_invoice',          'Sales Proforma / Commercial Invoice','business','sales','sales_orders', ARRAY['sales invoice','proforma invoice to customer','invoice to buyer','bill to'], true, 240),
  ('delivery_note',          'Delivery Note',                'business','sales',NULL, ARRAY['delivery note','delivery challan','dispatch note'], false, 250),
  ('sales_receipt',          'Sales Receipt',                'business','finance',NULL, ARRAY['sales receipt','payment received','receipt voucher'], true, 260),
  ('payment_confirmation',   'Payment Confirmation',         'business','finance',NULL, ARRAY['payment confirmation','remittance advice','swift copy','tt copy'], true, 270),
  ('dispatch_document',      'Dispatch Document',            'business','sales',NULL, ARRAY['dispatch','gate pass','outbound'], false, 280),
  -- Shipping / Clearing
  ('bill_of_lading',         'Bill of Lading',               'shipping','shipping','shipping_bl_records', ARRAY['bill of lading','b/l no','shipper','consignee','notify party','vessel','voyage'], false, 300),
  ('house_bl',               'House Bill of Lading',         'shipping','shipping','shipping_bl_records', ARRAY['house bill of lading','hbl','hb/l'], false, 310),
  ('master_bl',              'Master Bill of Lading',        'shipping','shipping','shipping_bl_records', ARRAY['master bill of lading','mbl','mb/l'], false, 320),
  ('shipping_booking',       'Shipping Booking Confirmation','shipping','shipping','shipping_line_records', ARRAY['shipping booking','booking confirmation','carrier booking'], false, 330),
  ('delivery_order',         'Delivery Order',               'shipping','clearing',NULL, ARRAY['delivery order','d/o no','release order'], false, 340),
  ('customs_declaration',    'Customs Declaration',          'shipping','clearing','clearing_agent_custom_entries', ARRAY['customs declaration','bill of entry','goods declaration','gd no','customs reference'], false, 350),
  ('customs_clearance',      'Customs Clearance Document',   'shipping','clearing','clearing_agent_custom_entries', ARRAY['clearance certificate','out of charge','customs cleared'], false, 360),
  ('container_list',         'Container List',               'shipping','shipping',NULL, ARRAY['container list','container manifest','seal no'], false, 370),
  ('freight_invoice',        'Freight Invoice',              'shipping','clearing','shipping_expense_transfers', ARRAY['freight invoice','ocean freight','freight charges'], true, 380),
  ('port_charges',           'Port Charges',                 'shipping','clearing','clearing_payment_bills', ARRAY['port charges','terminal handling','thc','demurrage','detention'], true, 390),
  ('clearing_expense_bill',  'Clearing Expense Bill',        'shipping','clearing','clearing_payment_bills', ARRAY['clearing expenses','clearance bill','agency charges','clearing agent invoice'], true, 400),
  ('road_transport_document','Truck / Road Transport Document','both','shipping',NULL, ARRAY['transport document','consignment note','cmr','waybill','truck no','vehicle no'], false, 410),
  ('air_waybill',            'Air Waybill',                  'shipping','shipping','shipping_bl_records', ARRAY['air waybill','awb no','airport of departure','airport of destination'], false, 420),
  ('shipping_packing_list',  'Packing List (Shipping)',      'shipping','shipping',NULL, ARRAY['packing list','packing note'], false, 430),
  -- Finance / cross-domain
  ('cash_receipt',           'Cash Receipt / Voucher',       'both','finance',NULL, ARRAY['cash receipt','cash voucher','received cash','paid cash'], true, 500),
  ('bank_transfer_advice',   'Bank Transfer Advice',         'both','finance',NULL, ARRAY['transfer advice','bank statement','transaction reference','value date'], true, 510),
  ('cheque_image',           'Cheque',                       'both','finance',NULL, ARRAY['cheque','check no','pay to the order of','a/c payee'], true, 520),
  ('kyc_document',           'KYC / Identity Document',      'both','other',NULL, ARRAY['passport','national id','emirates id','cnic','tazkira','trade license','tax registration'], true, 530),
  ('other_document',         'Other / Unclassified',         'both','other',NULL, ARRAY[]::text[], true, 999)
ON CONFLICT DO NOTHING;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260925_document_intelligence_foundation', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
