import fs from 'fs';
import postgres from 'postgres';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

const dbUrl = getDbUrl();
if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 5, prepare: false });

async function auditUsersAndSecurity() {
  console.log('=== AUDITING USERS, ROLES, PERMISSIONS & SCOPES ===\n');

  // 1. Roles
  const roles = await sql`
    SELECT * FROM roles ORDER BY name ASC;
  `;
  console.log(`Total Roles Found: ${roles.length}`);
  console.log('Roles:', roles.map(r => ({ id: r.id, name: r.name, code: r.code || r.slug, description: r.description })));

  // 2. Permissions
  const permissions = await sql`
    SELECT * FROM permissions ORDER BY module ASC, action ASC;
  `;
  console.log(`\nTotal Permissions Found: ${permissions.length}`);
  const modules = [...new Set(permissions.map(p => p.module))];
  console.log('Permission Modules:', modules);

  // 3. Role Permissions mapping
  const rolePermissions = await sql`
    SELECT rp.*, r.name as role_name, p.name as perm_name, p.module, p.action
    FROM role_permissions rp
    JOIN roles r ON rp.role_id = r.id
    JOIN permissions p ON rp.permission_id = p.id;
  `;
  console.log(`\nTotal Role-Permission Mappings: ${rolePermissions.length}`);

  // 4. Users & Scopes
  const users = await sql`
    SELECT u.id, u.email, u.name, u.role, u.is_active, u.country_id, u.branch_id, u.created_at
    FROM users u
    ORDER BY u.created_at DESC;
  `;
  console.log(`\nTotal Users Found: ${users.length}`);
  users.forEach(u => {
    console.log(`- User: ${u.email || u.name} | Role: ${u.role} | Country: ${u.country_id} | Branch: ${u.branch_id} | Active: ${u.is_active}`);
  });

  // 5. User Scopes / Branch mappings if any
  try {
    const userScopes = await sql`
      SELECT * FROM user_scopes;
    `;
    console.log(`\nUser Scopes table count: ${userScopes.length}`);
  } catch (e) {
    console.log('\nuser_scopes table:', e.message);
  }

  // 6. User Roles junction table if any
  try {
    const userRoles = await sql`
      SELECT * FROM user_roles;
    `;
    console.log(`User Roles junction count: ${userRoles.length}`);
  } catch (e) {
    console.log('user_roles junction table:', e.message);
  }

  // 7. Exact translation row counts
  console.log('\n=== VERIFYING EXACT TRANSLATION TABLE TOTALS ===');
  const transUrdu = await sql`SELECT count(*) as count FROM translations_urdu;`;
  const transEnglish = await sql`SELECT count(*) as count FROM translations_english;`;
  const transArabic = await sql`SELECT count(*) as count FROM translations_arabic;`;
  const transPersian = await sql`SELECT count(*) as count FROM translations_persian;`;
  const transPashto = await sql`SELECT count(*) as count FROM translations_pashto;`;
  const transEnterprise = await sql`SELECT count(*) as count FROM enterprise_record_translations;`;

  const transCounts = {
    english: Number(transEnglish[0]?.count || 0),
    urdu: Number(transUrdu[0]?.count || 0),
    arabic: Number(transArabic[0]?.count || 0),
    persian: Number(transPersian[0]?.count || 0),
    pashto: Number(transPashto[0]?.count || 0),
    enterprise_records: Number(transEnterprise[0]?.count || 0)
  };
  console.log('Exact Translation Counts:', transCounts);

  // Save audit data
  const result = {
    roles,
    permissions,
    rolePermissionsCount: rolePermissions.length,
    users,
    translationCounts: transCounts
  };

  fs.writeFileSync('scripts/audit-users-security.json', JSON.stringify(result, null, 2));
  console.log('\nSaved audit result to scripts/audit-users-security.json');

  await sql.end();
}

auditUsersAndSecurity().catch(console.error);
