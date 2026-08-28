import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
function env(name){ return (process.env[name] || '').trim(); }
function readEnvFile(){ for (const f of ['.env.local','.env']) { if (fs.existsSync(f)) { return fs.readFileSync(f,'utf8'); } } return ''; }
const c = readEnvFile();
const url = env('NEXT_PUBLIC_SUPABASE_URL') || (c.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$/m)?.[1] || '').trim();
const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY') || (c.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.+)$/m)?.[1] || '').trim();
if (!url || !anon) throw new Error('Missing Supabase URL/anon key');
const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase.auth.signInWithPassword({ email: 'superadmin@damaan.com', password: 'Admin@123' });
console.log(JSON.stringify({ hasUser: Boolean(data?.user), userId: data?.user?.id ?? null, email: data?.user?.email ?? null, error: error?.message ?? null }, null, 2));
