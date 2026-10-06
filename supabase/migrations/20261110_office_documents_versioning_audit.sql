-- Central i-Documents: explicit version tracking + integrity columns.
-- office_documents already carries storage_key / document_path / metadata; this
-- adds a first-class version counter and a checksum so re-uploads produce a
-- traceable version chain instead of silently overwriting.

ALTER TABLE IF EXISTS public.office_documents
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE IF EXISTS public.office_documents
  ADD COLUMN IF NOT EXISTS checksum_sha256 text;

ALTER TABLE IF EXISTS public.office_documents
  ADD COLUMN IF NOT EXISTS uploaded_by_id uuid REFERENCES public.profiles(id);

ALTER TABLE IF EXISTS public.office_documents
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_required'
    CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected'));

ALTER TABLE IF EXISTS public.office_documents
  ADD COLUMN IF NOT EXISTS approved_by_id uuid REFERENCES public.profiles(id);

ALTER TABLE IF EXISTS public.office_documents
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE IF EXISTS public.office_documents
  ADD COLUMN IF NOT EXISTS ledger_account_id uuid;

-- Prior file revisions are archived in metadata->'versionHistory' (array of
-- { version, storage_key, file_name, file_size, checksum_sha256, replaced_at, replaced_by }).

CREATE INDEX IF NOT EXISTS office_documents_uploaded_by_idx
  ON public.office_documents (uploaded_by_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS office_documents_approval_status_idx
  ON public.office_documents (approval_status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS office_documents_ledger_account_idx
  ON public.office_documents (ledger_account_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.office_documents.version IS
  'Monotonic file version. Bumped by /api/documents/[id]/version; prior revisions live in metadata.versionHistory.';
COMMENT ON COLUMN public.office_documents.checksum_sha256 IS
  'SHA-256 of the current stored blob, for integrity verification on download.';
COMMENT ON COLUMN public.office_documents.ledger_account_id IS
  'Optional linkage to an accounting ledger/account row this document substantiates.';
