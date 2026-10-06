import postgres from "postgres";
import fs from "fs";

function loadEnv() {
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }
}
loadEnv();

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function verify() {
  const ports = await sql`
    SELECT p.id, p.port_name, p.port_code, p.transport_type, c.name as country_name,
           u.translated_text as ur_name, a.translated_text as ar_name,
           f.translated_text as fa_name, ps.translated_text as ps_name
    FROM ports p
    LEFT JOIN countries c ON c.id = p.country_id
    LEFT JOIN ports_ur u ON u.record_id = p.id AND u.field_name = 'port_name'
    LEFT JOIN ports_ar a ON a.record_id = p.id AND a.field_name = 'port_name'
    LEFT JOIN ports_fa f ON f.record_id = p.id AND f.field_name = 'port_name'
    LEFT JOIN ports_ps ps ON ps.record_id = p.id AND ps.field_name = 'port_name'
    WHERE p.deleted_at IS NULL
    ORDER BY c.name, p.transport_type, p.port_name
    LIMIT 20
  `;

  console.log(`\nVerified Sample of ${ports.length} Multilingual Ports:`);
  for (const p of ports) {
    console.log(`[${p.country_name || 'N/A'}] (${p.transport_type.toUpperCase()}) ${p.port_code || '-'} | EN: ${p.port_name} | UR: ${p.ur_name || '-'} | AR: ${p.ar_name || '-'} | FA: ${p.fa_name || '-'} | PS: ${p.ps_name || '-'}`);
  }

  const totalPorts = await sql`SELECT count(*) FROM ports WHERE deleted_at IS NULL`;
  console.log(`\nTotal Active Ports in Database: ${totalPorts[0].count}`);
  await sql.end();
}

verify();
