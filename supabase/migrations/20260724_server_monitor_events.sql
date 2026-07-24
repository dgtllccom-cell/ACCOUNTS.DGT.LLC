-- Server & Project Monitoring — event history table.
-- The application also self-provisions this table at runtime (see lib/monitoring/events.ts),
-- so applying this migration is optional but recommended for a clean schema.

CREATE TABLE IF NOT EXISTS server_monitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  details jsonb,
  branch text,
  commit_id text,
  user_id uuid,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS server_monitor_events_created_at_idx ON server_monitor_events (created_at DESC);
CREATE INDEX IF NOT EXISTS server_monitor_events_event_type_idx ON server_monitor_events (event_type);
