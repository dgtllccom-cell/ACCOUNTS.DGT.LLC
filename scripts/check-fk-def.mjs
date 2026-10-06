import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from "postgres";

const vpsEnv = {
  DATABASE_URL: resolveDbUrl("prod")
};
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

async function inspectFk() {
  const fks = await vpsSql`
    SELECT
        tc.table_schema, 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'customers';
  `;
  console.log("Customer FKs on VPS:", fks);

  const langs = await vpsSql`SELECT * FROM public.languages`;
  console.log("Languages table on VPS:", langs);
  process.exit(0);
}

inspectFk();
