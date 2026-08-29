import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const localSql = postgres(resolveDbUrl("dev"), { ssl: { rejectUnauthorized: false }, prepare: false });
const vpsSql = postgres(resolveDbUrl("prod"), { ssl: { rejectUnauthorized: false }, prepare: false });

async function syncMissingCustomerRegistrations() {
  const localRegs = await localSql`SELECT * FROM customer_registrations`;
  console.log('Local customer_registrations:', localRegs.length);

  let inserted = 0;
  for (const reg of localRegs) {
    try {
      await vpsSql`
        INSERT INTO customer_registrations ${vpsSql(reg)}
        ON CONFLICT (id) DO NOTHING
      `;
      inserted++;
    } catch (e) {
      console.log('Reg sync err:', reg.id, e.message);
    }
  }

  const [finalRegs] = await vpsSql`SELECT count(*) FROM customer_registrations`;
  console.log(`Synced ${inserted} customer_registrations. Final VPS count: ${finalRegs.count}`);

  await localSql.end();
  await vpsSql.end();
}

syncMissingCustomerRegistrations().catch(console.error);
