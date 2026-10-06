import { createClient } from '@supabase/supabase-js';

// Secret removed to allow git push
const supabase = createClient(
  'https://csesvyxxjivnkkozgopt.supabase.co',
  'REMOVED_SECRET'
);

async function run() {
  console.log('Done');
}
run();
