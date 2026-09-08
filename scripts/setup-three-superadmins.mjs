import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function run() {
  console.log("Setting up exactly 3 Super Admin accounts with password 'Gulistan@123'...");

  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;

  const fullAdminId = 'be3a6b15-65c5-4d74-82ae-e956c02a5f07';
  const shippingAdminId = '22222222-2222-4000-8000-000000000002';
  const businessAdminId = '00000000-0000-4000-8000-000000000001';
  const keptIds = [fullAdminId, shippingAdminId, businessAdminId];

  // 1. First update businessAdminId email so it doesn't hold 'superadmin@dgt.llc'
  await sql`
    UPDATE auth.users SET 
      email = 'business.superadmin@dgt.llc',
      encrypted_password = crypt('Gulistan@123', gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = '{"full_name":"Business Super Admin","role":"super_admin","user_code":"BUSINESS_SUPERADMIN"}'::jsonb,
      updated_at = now()
    WHERE id = ${businessAdminId}
  `;

  // 2. Delete all other dummy users from auth.users that are not in keptIds
  const deleted = await sql`
    DELETE FROM auth.users 
    WHERE id NOT IN ${sql(keptIds)}
    RETURNING id, email
  `;
  console.log(`Successfully removed ${deleted.length} dummy/unused users.`);

  // Clean any unused profiles
  await sql`
    DELETE FROM public.profiles 
    WHERE id NOT IN ${sql(keptIds)}
  `;

  // 3. Configure Full Super Admin (ALL Access)
  await sql`
    UPDATE auth.users SET 
      email = 'superadmin@dgt.llc',
      encrypted_password = crypt('Gulistan@123', gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = '{"full_name":"Global Super Admin","role":"super_admin","user_code":"SUPERADMIN"}'::jsonb,
      updated_at = now()
    WHERE id = ${fullAdminId}
  `;

  await sql`
    INSERT INTO public.profiles (id, user_code, full_name, created_at, updated_at)
    VALUES (${fullAdminId}, 'SUPERADMIN', 'Global Super Admin', now(), now())
    ON CONFLICT (id) DO UPDATE SET 
      user_code = 'SUPERADMIN',
      full_name = 'Global Super Admin',
      deleted_at = NULL,
      updated_at = now()
  `;

  await sql`DELETE FROM public.user_role_assignments WHERE user_id = ${fullAdminId};`;
  await sql`
    INSERT INTO public.user_role_assignments (id, user_id, role, operational_domain, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${fullAdminId}, 'super_admin', 'both', true, now(), now())
  `;

  // 4. Configure Shipping Line Super Admin
  await sql`
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
      ${shippingAdminId},
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'shipping.superadmin@dgt.llc',
      crypt('Gulistan@123', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Shipping Line Super Admin","role":"super_admin","user_code":"SHIPPING_SUPERADMIN"}'::jsonb,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = 'shipping.superadmin@dgt.llc',
      encrypted_password = crypt('Gulistan@123', gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
      raw_user_meta_data = '{"full_name":"Shipping Line Super Admin","role":"super_admin","user_code":"SHIPPING_SUPERADMIN"}'::jsonb,
      updated_at = now()
  `;

  await sql`
    INSERT INTO public.profiles (id, user_code, full_name, created_at, updated_at)
    VALUES (${shippingAdminId}, 'SHIPPING_SUPERADMIN', 'Shipping Line Super Admin', now(), now())
    ON CONFLICT (id) DO UPDATE SET 
      user_code = 'SHIPPING_SUPERADMIN',
      full_name = 'Shipping Line Super Admin',
      deleted_at = NULL,
      updated_at = now()
  `;

  await sql`DELETE FROM public.user_role_assignments WHERE user_id = ${shippingAdminId};`;
  await sql`
    INSERT INTO public.user_role_assignments (id, user_id, role, operational_domain, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${shippingAdminId}, 'super_admin', 'shipping', true, now(), now())
  `;

  // 5. Configure Business Super Admin Profile & Roles
  await sql`
    INSERT INTO public.profiles (id, user_code, full_name, created_at, updated_at)
    VALUES (${businessAdminId}, 'BUSINESS_SUPERADMIN', 'Business Super Admin', now(), now())
    ON CONFLICT (id) DO UPDATE SET 
      user_code = 'BUSINESS_SUPERADMIN',
      full_name = 'Business Super Admin',
      deleted_at = NULL,
      updated_at = now()
  `;

  await sql`DELETE FROM public.user_role_assignments WHERE user_id = ${businessAdminId};`;
  await sql`
    INSERT INTO public.user_role_assignments (id, user_id, role, operational_domain, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${businessAdminId}, 'super_admin', 'business', true, now(), now())
  `;

  // Final verification query
  const finalUsers = await sql`
    SELECT u.id, u.email, p.user_code, p.full_name, ura.role, ura.operational_domain
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.user_role_assignments ura ON ura.user_id = u.id
    ORDER BY u.email ASC
  `;

  console.log("\n==========================================================================");
  console.log("EXACT 3 SUPER ADMIN ACCOUNTS IN DATABASE (PASSWORD: Gulistan@123):");
  console.log("==========================================================================");
  for (const u of finalUsers) {
    console.log(`- ${u.full_name}:`);
    console.log(`    Email:    ${u.email}`);
    console.log(`    UserCode: ${u.user_code}`);
    console.log(`    Role:     ${u.role}`);
    console.log(`    Domain:   ${u.operational_domain}`);
    console.log(`    Password: Gulistan@123`);
  }
  console.log("==========================================================================\n");

  await sql.end();
}

run().catch(console.error);
