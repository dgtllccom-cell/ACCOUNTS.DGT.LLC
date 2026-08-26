const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd(), true);
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
console.log('url?', Boolean(url), 'key?', Boolean(key), 'prefix?', key ? key.slice(0, 12) : 'none');
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const run = async () => {
  const { data, error } = await supabase.from('office_documents').select('id').limit(1);
  console.log(JSON.stringify({ ok: !error, error: error?.message ?? null, rows: data?.length ?? 0 }, null, 2));
};
run().catch(err => { console.error(err); process.exit(1); });
