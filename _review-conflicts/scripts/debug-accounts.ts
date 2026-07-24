import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data } = await supabase.from('accounts').select('id, name, country_id, city_branch_id').in('name', ['Purchase Account', 'Kailamullah Account']);
  console.log(data);
}
main();
