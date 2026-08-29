#!/usr/bin/env bash
SP="C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project-ACCOUNTS-DGT-LLC/e2861670-e129-4e08-993a-9199b5bf57a6/scratchpad"
BIN="$SP/pgbin/pgsql/bin"
PG="$BIN/psql.exe -h 127.0.0.1 -p 5433 -U postgres"
$PG -d postgres -c "DROP DATABASE IF EXISTS prod_replica WITH (FORCE);"
$PG -d postgres -c "CREATE DATABASE prod_replica;"
$PG -d prod_replica -q -c "
DO \$\$ BEGIN
  CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
DO \$\$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
DO \$\$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
DO \$\$ BEGIN CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'scratchpwd'; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
DO \$\$ BEGIN CREATE ROLE codex_backup_ NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
DO \$\$ BEGIN CREATE ROLE codex_backup_1785611851964 NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
DO \$\$ BEGIN CREATE ROLE supabase_admin SUPERUSER; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
GRANT anon,authenticated,service_role TO authenticator, postgres;
CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS extensions; CREATE SCHEMA IF NOT EXISTS storage;
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;
CREATE OR REPLACE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT extensions.uuid_generate_v4()';
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(), email text, raw_user_meta_data jsonb, created_at timestamptz DEFAULT now());
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT coalesce(nullif(current_setting(''request.jwt.claim.sub'',true),''''), nullif(current_setting(''request.jwt.claims'',true),'''')::json->>''sub'')::uuid';
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS 'SELECT coalesce(nullif(current_setting(''request.jwt.claim.role'',true),''''), nullif(current_setting(''request.jwt.claims'',true),'''')::json->>''role'',''authenticated'')';
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT coalesce(nullif(current_setting(''request.jwt.claims'',true),'''')::jsonb, ''{}''::jsonb)';
GRANT USAGE ON SCHEMA auth, extensions, storage TO anon, authenticated, service_role, postgres;
CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE IF NOT EXISTS storage.objects (id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(), bucket_id text REFERENCES storage.buckets(id), name text, owner uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), metadata jsonb);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects, storage.buckets TO authenticated, service_role, postgres;
" 2>&1 | grep -iE "error" | grep -v "already" | head
echo "== schema =="
$PG -d prod_replica -q -f "$SP/prod_schema.sql" > "$SP/rb_schema.log" 2>&1
grep -E "gin_trgm_ops" "$SP/prod_schema.sql" | sed 's/ *$//' | $PG -d prod_replica -q 2>&1 | grep -ic "create index"
echo "== data =="
"$BIN/pg_restore.exe" -h 127.0.0.1 -p 5433 -U postgres -d prod_replica --data-only --disable-triggers --no-owner -j 4 "$SP/prod_data.dump" > "$SP/rb_data.log" 2>&1
$PG -d prod_replica -tAc "SELECT 'baseline: '||(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')||' tables | '||(SELECT count(*) FROM purchase_orders)||' POs | '||(SELECT count(*) FROM roznamcha_entries)||' roz | '||(SELECT count(*) FROM ledgers)||' ledgers | '||(SELECT count(*) FROM profiles)||' profiles'"
