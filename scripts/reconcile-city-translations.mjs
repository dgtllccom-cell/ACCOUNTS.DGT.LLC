import postgres from 'postgres';

const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false } });

async function checkCityMatching() {
  const citySample = await vpsSql`SELECT id, name FROM cities LIMIT 3`;
  console.log('City table sample:', citySample);
  
  const transSample = await vpsSql`SELECT record_id, original_text FROM record_translations WHERE record_table = 'cities' LIMIT 3`;
  console.log('City translations sample:', transSample);

  // Check if record_id matches name or id
  const matchById = await vpsSql`
    SELECT COUNT(*) as count 
    FROM record_translations rt
    JOIN cities c ON rt.record_id::text = c.id::text
    WHERE rt.record_table = 'cities';
  `;
  console.log('Matches by ID:', matchById[0].count);

  const matchByName = await vpsSql`
    SELECT COUNT(*) as count 
    FROM record_translations rt
    JOIN cities c ON LOWER(TRIM(rt.original_text)) = LOWER(TRIM(c.name))
    WHERE rt.record_table = 'cities';
  `;
  console.log('Matches by City Name:', matchByName[0].count);

  await vpsSql.end();
}

checkCityMatching().catch(console.error);
