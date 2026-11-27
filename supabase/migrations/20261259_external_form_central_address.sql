-- Keep links issued before this migration on their original path.
-- The issuer can mark newly created scoped Customer/Employee links.
ALTER TABLE public.external_form_links
  ADD COLUMN IF NOT EXISTS central_address boolean NOT NULL DEFAULT false;
