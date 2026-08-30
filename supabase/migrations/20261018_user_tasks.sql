-- Migration: 20261018_user_tasks.sql
-- USER TASKS / Work Order Control Center — admin assigns work to a user; the task
-- appears automatically in that user's My Tasks; a New -> Accepted -> In Progress ->
-- Waiting -> Completed -> Admin Verified workflow with evidence (notes, attachments,
-- linked ERP record), a full status/audit history and per-user unread indicators.
--
-- Scoped by the existing Country / Branch / Role model (enforced server-side).
-- Additive & idempotent. No existing table is altered.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Human-readable task number  (TSK-YYYYMMDD-00001)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.user_task_no_seq;

-- ─────────────────────────────────────────────────────────────────────────────
-- user_tasks
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_tasks (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_no                text UNIQUE,
  title                  text NOT NULL,
  description            text,
  instructions           text,
  remarks                text,

  -- where the task belongs (admin oversight / scope filtering)
  country_id             uuid REFERENCES public.countries(id),
  country_branch_id      uuid REFERENCES public.country_branches(id),
  city_branch_id         uuid REFERENCES public.city_branches(id),
  department             text,

  created_by             uuid NOT NULL,          -- assigner / admin
  assigned_to            uuid NOT NULL,          -- the user doing the work

  -- optional link to a real ERP module / page / record
  related_module         text,                  -- 'purchases' | 'sales' | 'roznamcha' | 'ledger' | 'hrm' | 'documents' | 'shipping' | ...
  related_record_table   text,
  related_record_id      uuid,
  related_record_label   text,
  related_route          text,

  priority               text NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('low','normal','high','urgent')),
  start_date             date,
  due_at                 timestamptz,

  status                 text NOT NULL DEFAULT 'new'
                            CHECK (status IN ('new','accepted','in_progress','waiting','completed','verified','returned','cancelled')),

  accepted_at            timestamptz,
  started_at             timestamptz,
  waiting_at             timestamptz,
  completed_at           timestamptz,
  verified_at            timestamptz,
  returned_at            timestamptz,
  cancelled_at           timestamptz,

  verified_by            uuid,
  verification_notes     text,
  return_reason          text,
  completion_notes       text,

  -- evidence: a real ERP record/entry the user points to as proof of work
  evidence_record_table  text,
  evidence_record_id     uuid,
  evidence_reference_no  text,

  reassigned_from        uuid,                  -- previous assignee if the task was moved

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_tasks_assignee
  ON public.user_tasks (assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_creator
  ON public.user_tasks (created_by, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_scope
  ON public.user_tasks (country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_due
  ON public.user_tasks (due_at) WHERE deleted_at IS NULL AND status NOT IN ('completed','verified','cancelled');
CREATE INDEX IF NOT EXISTS idx_user_tasks_related
  ON public.user_tasks (related_record_table, related_record_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- user_task_attachments  (instruction files from the admin + evidence files from the user)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_task_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES public.user_tasks(id) ON DELETE CASCADE,
  kind          text NOT NULL DEFAULT 'evidence' CHECK (kind IN ('instruction','evidence')),
  uploaded_by   uuid NOT NULL,
  name          text NOT NULL,
  mime          text,
  size_bytes    bigint,
  file          jsonb,          -- { url } | { dataUrl } | { storagePath }
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_user_task_attachments_task
  ON public.user_task_attachments (task_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- user_task_events  (immutable status/audit history + progress notes + comments)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_task_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES public.user_tasks(id) ON DELETE CASCADE,
  actor_id      uuid NOT NULL,
  event_type    text NOT NULL
                  CHECK (event_type IN ('created','assigned','reassigned','accepted','started','waiting',
                                        'progress_note','comment','attachment_added','evidence_linked',
                                        'completed','returned','verified','due_changed','priority_changed','cancelled')),
  from_status   text,
  to_status     text,
  note          text,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_task_events_task
  ON public.user_task_events (task_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- user_task_notifications  (per-recipient unread indicators)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_task_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES public.user_tasks(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL,
  event_id      uuid REFERENCES public.user_task_events(id) ON DELETE CASCADE,
  kind          text NOT NULL,        -- 'assigned' | 'accepted' | 'completed' | 'verified' | 'returned' | 'note' | 'due_soon' | ...
  title         text,
  is_read       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz
);
CREATE INDEX IF NOT EXISTS idx_user_task_notifications_unread
  ON public.user_task_notifications (recipient_id) WHERE is_read = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- triggers: updated_at + task_no + a guaranteed 'created' history row
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_tasks_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_user_tasks_touch ON public.user_tasks;
CREATE TRIGGER trg_user_tasks_touch
  BEFORE UPDATE ON public.user_tasks
  FOR EACH ROW EXECUTE FUNCTION public.user_tasks_touch();

CREATE OR REPLACE FUNCTION public.user_tasks_assign_no()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.task_no IS NULL OR NEW.task_no = '' THEN
    NEW.task_no := 'TSK-' || to_char(now(), 'YYYYMMDD') || '-' ||
                   lpad(nextval('public.user_task_no_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_user_tasks_assign_no ON public.user_tasks;
CREATE TRIGGER trg_user_tasks_assign_no
  BEFORE INSERT ON public.user_tasks
  FOR EACH ROW EXECUTE FUNCTION public.user_tasks_assign_no();

-- Safety net: every task always has at least a 'created' + 'assigned' history row
-- even if a caller forgets to write one through the service layer.
CREATE OR REPLACE FUNCTION public.user_tasks_seed_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.user_task_events (task_id, actor_id, event_type, to_status, note)
  VALUES (NEW.id, NEW.created_by, 'created', NEW.status, NEW.title);
  INSERT INTO public.user_task_events (task_id, actor_id, event_type, to_status, meta)
  VALUES (NEW.id, NEW.created_by, 'assigned', NEW.status,
          jsonb_build_object('assigned_to', NEW.assigned_to));
  INSERT INTO public.user_task_notifications (task_id, recipient_id, kind, title)
  VALUES (NEW.id, NEW.assigned_to, 'assigned', NEW.title);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_user_tasks_seed_history ON public.user_tasks;
CREATE TRIGGER trg_user_tasks_seed_history
  AFTER INSERT ON public.user_tasks
  FOR EACH ROW EXECUTE FUNCTION public.user_tasks_seed_history();

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime nudge (optional — same pattern as DGT Connect)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_tasks; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_task_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_task_notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261018_user_tasks', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
