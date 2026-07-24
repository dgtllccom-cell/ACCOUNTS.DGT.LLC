import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
    }

    const sql = postgres(databaseUrl, { max: 1, prepare: false });

    const action = request.nextUrl.searchParams.get("action");

    if (action === "test") {
      const ea_columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'enterprise_accounts'
      `;
      const ledger_columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ledgers'
      `;
      const check_constraints = await sql`
        SELECT
          conname AS constraint_name,
          pg_get_constraintdef(oid) AS constraint_definition
        FROM pg_constraint
        WHERE conrelid = 'public.enterprise_accounts'::regclass
          AND contype = 'c'
      `;
      const indexes = await sql`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename IN ('enterprise_accounts', 'ledgers')
      `;

      await sql.end();
      return NextResponse.json({
        success: true,
        ea_columns,
        ledger_columns,
        check_constraints,
        indexes
      });
    }

    if (action === "locks") {
      const locks = await sql`
        SELECT
          blocked_locks.pid     AS blocked_pid,
          blocked_activity.query    AS blocked_statement,
          blocking_locks.pid    AS blocking_pid,
          blocking_activity.query   AS blocking_statement
        FROM pg_catalog.pg_locks         blocked_locks
        JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
        JOIN pg_catalog.pg_locks         blocking_locks 
            ON blocking_locks.locktype = blocked_locks.locktype
            AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
            AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
            AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
            AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
            AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
            AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
            AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
            AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
            AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
            AND blocking_locks.pid != blocked_locks.pid
        JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
        WHERE NOT blocked_locks.granted
      `;
      await sql.end();
      return NextResponse.json({ locks });
    }

    if (action === "list-locations") {
      const countries = await sql`SELECT id, name, currency_code FROM public.countries WHERE deleted_at IS NULL`;
      const country_branches = await sql`SELECT id, country_id, name, code, local_currency, is_main, company_id FROM public.country_branches WHERE deleted_at IS NULL`;
      const city_branches = await sql`SELECT id, country_id, country_branch_id, city_name, name, code, local_currency, company_id FROM public.city_branches WHERE deleted_at IS NULL`;
      const companies = await sql`SELECT id, name, base_currency FROM public.companies WHERE deleted_at IS NULL`;
      const branches = await sql`SELECT id, company_id, name, code FROM public.branches WHERE deleted_at IS NULL`;
      const cities = await sql`SELECT id, country_id, name, code FROM public.cities WHERE deleted_at IS NULL LIMIT 200`;
      await sql.end();
      return NextResponse.json({ countries, country_branches, city_branches, companies, branches, cities });
    }



    if (action === "list-accounts") {
      const enterprise_accounts = await sql`SELECT id, scope, country_id, code, name, kind, currency FROM public.enterprise_accounts WHERE deleted_at IS NULL`;
      const ledgers = await sql`SELECT id, scope, country_id, country_branch_id, city_branch_id, code, name, currency FROM public.ledgers WHERE deleted_at IS NULL`;
      await sql.end();
      return NextResponse.json({ enterprise_accounts, ledgers });
    }

    if (action === "bootstrap") {
      try {
        const supabase = createSupabaseAdminClient();
        
        // 1. Check if the user already exists in auth.users
        const [existingAuth] = await sql`
          SELECT id FROM auth.users WHERE email = 'superadmin@damaan.com' LIMIT 1
        `;

        let userId = existingAuth?.id;

        if (!userId) {
          console.log("Creating auth user for superadmin@damaan.com...");
          const { data, error } = await supabase.auth.admin.createUser({
            email: "superadmin@damaan.com",
            password: "Admin@123",
            email_confirm: true,
            user_metadata: { full_name: "Super Admin" }
          });
          if (error) {
            return NextResponse.json({ error: `Failed to create auth user: ${error.message}` }, { status: 500 });
          }
          userId = data.user.id;
        } else {
          console.log("Resetting password for existing user...");
          const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: "Admin@123",
            email_confirm: true
          });
          if (error) {
            return NextResponse.json({ error: `Failed to update auth user: ${error.message}` }, { status: 500 });
          }
        }

        // 2. Ensure profile exists in public.profiles
        await sql`
          INSERT INTO public.profiles (id, full_name)
          VALUES (${userId}, 'Super Admin')
          ON CONFLICT (id) DO UPDATE SET full_name = 'Super Admin'
        `;

        // 3. Ensure role assignment exists in public.user_role_assignments
        await sql`
          INSERT INTO public.user_role_assignments (user_id, role, is_active)
          VALUES (${userId}, 'super_admin', true)
          ON CONFLICT DO NOTHING
        `;

        await sql.end();
        return NextResponse.json({ success: true, message: "Super Admin bootstrapped successfully.", userId });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message });
      }
    }

    if (action === "cleanup") {
      console.log("Starting database cleanup via API...");
      const logs: string[] = [];

      try {
        // Disable default branch pointers in countries before deleting branches
        await sql`UPDATE public.countries SET default_country_branch_id = NULL`;
        logs.push("Disable country branch pointers: SUCCESS");

        // Transactional tables to truncate/clear
        const transactionalTables = [
          "ledger_transaction_audit_trail",
          "inter_branch_ledger_transfers",
          "purchase_loading_records",
          "shipping_bl_records",
          "purchase_order_payments",
          "purchase_orders",
          "sales_order_payments",
          "sales_orders",
          "shipping_line_records",
          "shipment_documents",
          "roznamcha_reversals",
          "ledger_entries",
          "journal_lines",
          "journal_entries",
          "ledger_balances",
          "ledger_posting_lines",
          "roznamcha_lines",
          "roznamcha_entries",
          "enterprise_ledger_reversals",
          "ledger_opening_balances",
          "ledger_posting_batches",
          "enterprise_account_history",
          "daily_usd_rates",
          "usd_purchase_sales",
          "exchange_rate_history",
          "approval_status_history",
          "approval_request_items",
          "approval_requests",
          "record_locks",
          "record_change_history",
          "soft_delete_logs",
          "attachments",
          "audit_logs",
          "erp_activity_events",
          "erp_record_transfers",
          "erp_pdf_email_jobs",
          "erp_assignments",
          "product_inventory_balances",
          "customer_contacts",
          "customer_registrations",
          "customers",
          "ledgers",
          "accounts",
          "enterprise_accounts",
          "banks"
        ];

        // Find which tables exist
        const existingTablesResult = await sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name IN ${sql(transactionalTables)}
        `;
        const existingTableNames = existingTablesResult.map(r => r.table_name);

        if (existingTableNames.length > 0) {
          const truncateList = existingTableNames.map(name => `public."${name}"`).join(", ");
          await sql.unsafe(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE`);
          logs.push(`Truncated ${existingTableNames.length} tables: SUCCESS`);
        } else {
          logs.push("No transactional tables found to truncate");
        }

        // Delete all city branches
        await sql`TRUNCATE TABLE public.city_branches RESTART IDENTITY CASCADE`;
        logs.push("Truncate city branches: SUCCESS");

        // Identify users to delete (keep only users with role 'super_admin')
        const profilesList = await sql`
          SELECT p.id, p.full_name, ura.role
          FROM public.profiles p
          LEFT JOIN public.user_role_assignments ura ON ura.user_id = p.id
        `;
        logs.push("Fetch profiles: SUCCESS");

        const superAdminUserIds = new Set(
          profilesList
            .filter(p => p.role === "super_admin")
            .map(p => p.id)
        );

        const toDeleteUsers = profilesList.filter(p => !superAdminUserIds.has(p.id));
        const deletedUserIds = toDeleteUsers.map(u => u.id);

        if (deletedUserIds.length > 0) {
          const fkRefs = await sql`
            SELECT 
              tc.table_name, 
              kcu.column_name
            FROM 
              information_schema.table_constraints AS tc 
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE 
              tc.constraint_type = 'FOREIGN KEY' 
              AND ccu.table_schema = 'public'
              AND ccu.table_name = 'profiles'
              AND ccu.column_name = 'id'
              AND tc.table_name NOT IN ('user_role_assignments', 'user_permission_sets', 'profiles')
          `;

          for (const ref of fkRefs) {
            try {
              await sql.unsafe(`
                UPDATE public."${ref.table_name}" 
                SET "${ref.column_name}" = NULL 
                WHERE "${ref.column_name}" IN (${deletedUserIds.map(id => `'${id}'::uuid`).join(",")})
              `);
            } catch (err: any) {
              console.error(`Failed to dynamically nullify ${ref.table_name}.${ref.column_name}:`, err.message);
            }
          }
          logs.push(`Dynamically cleared profile references in ${fkRefs.length} referencing columns: SUCCESS`);

          const [permExists] = await sql`SELECT to_regclass('public.user_permission_sets') as tbl`;
          if (permExists && permExists.tbl) {
            await sql`DELETE FROM public.user_permission_sets WHERE user_id IN ${sql(deletedUserIds)}`;
          }
          await sql`DELETE FROM public.user_role_assignments WHERE user_id IN ${sql(deletedUserIds)}`;
          await sql`DELETE FROM public.profiles WHERE id IN ${sql(deletedUserIds)}`;
          logs.push(`Deleted ${deletedUserIds.length} profiles: SUCCESS`);

          // Delete from Supabase Auth with a timeout
          try {
            const supabase = createSupabaseAdminClient();
            const deletePromises = toDeleteUsers.map(async (user) => {
              const deletePromise = supabase.auth.admin.deleteUser(user.id);
              const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000));
              return Promise.race([deletePromise, timeoutPromise]).catch(err => {
                console.error(`Failed/timed out deleting auth user ${user.id}:`, err);
              });
            });
            await Promise.all(deletePromises);
            logs.push("Delete from Supabase Auth: DONE/TIMEOUT");
          } catch (authError: any) {
            logs.push(`Delete from Supabase Auth: FAILED - ${authError.message}`);
          }
        } else {
          logs.push("No non-admin users to delete");
        }
      } catch (err: any) {
        logs.push(`CRITICAL ERROR: ${err.message}`);
        console.error("Cleanup critical error:", err);
      }

      await sql.end();
      return NextResponse.json({ success: true, logs });
    }

    if (action === "seed") {
      const logs: string[] = [];
      try {
        logs.push("Loading existing locations into memory...");
        const countriesList = await sql`SELECT id, name, phone_code FROM public.countries WHERE deleted_at IS NULL`;
        const statesList = await sql`SELECT id, country_id, name FROM public.states_provinces WHERE deleted_at IS NULL`;
        const districtsList = await sql`SELECT id, state_province_id, name FROM public.districts WHERE deleted_at IS NULL`;
        const citiesList = await sql`SELECT id, country_id, name, district_id, state_province_id FROM public.cities WHERE deleted_at IS NULL`;
        const areasList = await sql`SELECT id, city_id, name FROM public.areas_locations WHERE deleted_at IS NULL`;

        const cByName = new Map(countriesList.map(c => [c.name, c.id]));
        
        for (const [name, code] of [
          ["Pakistan", "+92"],
          ["Afghanistan", "+93"],
          ["United Arab Emirates", "+971"],
          ["UAE / Dubai", "+971"]
        ]) {
          const id = cByName.get(name);
          if (id) {
            const countryRow = countriesList.find(c => c.id === id);
            if (!countryRow?.phone_code) {
              await sql`UPDATE public.countries SET phone_code = ${code} WHERE id = ${id}`;
              logs.push(`Updated phone code for ${name} to ${code}`);
            }
          }
        }

        const stateKey = (countryId: string, name: string) => `${countryId}:${name.trim().toLowerCase()}`;
        const districtKey = (stateId: string, name: string) => `${stateId}:${name.trim().toLowerCase()}`;
        const cityKey = (countryId: string, name: string) => `${countryId}:${name.trim().toLowerCase()}`;
        const areaKey = (cityId: string, name: string) => `${cityId}:${name.trim().toLowerCase()}`;

        const statesMap = new Map(statesList.map(s => [stateKey(s.country_id, s.name), s.id]));
        const districtsMap = new Map(districtsList.map(d => [districtKey(d.state_province_id, d.name), d.id]));
        const citiesMap = new Map(citiesList.map(c => [cityKey(c.country_id, c.name), c.id]));
        const areasMap = new Map(areasList.map(a => [areaKey(a.city_id, a.name), a.id]));

        let createdStates = 0;
        let createdDistricts = 0;
        let createdCities = 0;
        let createdAreas = 0;

        async function getOrCreateState(countryId: string, name: string, code: string) {
          const key = stateKey(countryId, name);
          if (statesMap.has(key)) return statesMap.get(key)!;
          const [inserted] = await sql`
            INSERT INTO public.states_provinces (country_id, name, code)
            VALUES (${countryId}, ${name}, ${code})
            RETURNING id
          `;
          statesMap.set(key, inserted.id);
          createdStates++;
          return inserted.id;
        }

        async function getOrCreateDistrict(countryId: string, stateId: string, name: string, code: string) {
          const key = districtKey(stateId, name);
          if (districtsMap.has(key)) return districtsMap.get(key)!;
          const [inserted] = await sql`
            INSERT INTO public.districts (country_id, state_province_id, name, code)
            VALUES (${countryId}, ${stateId}, ${name}, ${code})
            RETURNING id
          `;
          districtsMap.set(key, inserted.id);
          createdDistricts++;
          return inserted.id;
        }

        async function getOrCreateCity(countryId: string, stateId: string, districtId: string, name: string, code: string, zipCode: string) {
          const key = cityKey(countryId, name);
          if (citiesMap.has(key)) {
            const existingId = citiesMap.get(key)!;
            const cRow = citiesList.find(c => c.id === existingId);
            if (cRow && (!cRow.district_id || !cRow.state_province_id)) {
              await sql`
                UPDATE public.cities 
                SET state_province_id = coalesce(state_province_id, ${stateId}),
                    district_id = coalesce(district_id, ${districtId}),
                    code = coalesce(code, ${code}),
                    zip_code = coalesce(zip_code, ${zipCode})
                WHERE id = ${existingId}
              `;
            }
            return existingId;
          }
          const [inserted] = await sql`
            INSERT INTO public.cities (country_id, state_province_id, district_id, name, code, zip_code)
            VALUES (${countryId}, ${stateId}, ${districtId}, ${name}, ${code}, ${zipCode})
            RETURNING id
          `;
          citiesMap.set(key, inserted.id);
          createdCities++;
          return inserted.id;
        }

        async function getOrCreateArea(countryId: string, stateId: string, districtId: string, cityId: string, name: string, code: string) {
          const key = areaKey(cityId, name);
          if (areasMap.has(key)) return areasMap.get(key)!;
          const [inserted] = await sql`
            INSERT INTO public.areas_locations (country_id, state_province_id, district_id, city_id, name, code)
            VALUES (${countryId}, ${stateId}, ${districtId}, ${cityId}, ${name}, ${code})
            RETURNING id
          `;
          areasMap.set(key, inserted.id);
          createdAreas++;
          return inserted.id;
        }

        const pakId = cByName.get("Pakistan");
        if (pakId) {
          const pakData = [
            {
              state: "Punjab", code: "PUN",
              districts: [
                {
                  name: "Lahore District", code: "LHR",
                  cities: [
                    {
                      name: "Lahore", code: "LHE", zip: "54000",
                      areas: ["Lahore Cantt", "Model Town", "Raiwind", "Shalimar"]
                    }
                  ]
                },
                {
                  name: "Faisalabad District", code: "FSD",
                  cities: [
                    {
                      name: "Faisalabad", code: "FSD", zip: "38000",
                      areas: ["Faisalabad City", "Jaranwala", "Sammundri"]
                    }
                  ]
                },
                {
                  name: "Rawalpindi District", code: "RWP",
                  cities: [
                    {
                      name: "Rawalpindi", code: "RWP", zip: "46000",
                      areas: ["Rawalpindi Cantt", "Gujar Khan", "Taxila"]
                    }
                  ]
                },
                {
                  name: "Multan District", code: "MUX",
                  cities: [
                    {
                      name: "Multan", code: "MUX", zip: "60000",
                      areas: ["Multan City", "Jalalpur Pirwala", "Shujabad"]
                    }
                  ]
                },
                {
                  name: "Gujranwala District", code: "GUJ",
                  cities: [
                    {
                      name: "Gujranwala", code: "GUJ", zip: "52250",
                      areas: ["Gujranwala City", "Kamoke", "Wazirabad"]
                    }
                  ]
                },
                {
                  name: "Sialkot District", code: "SKT",
                  cities: [
                    {
                      name: "Sialkot", code: "SKT", zip: "51310",
                      areas: ["Sialkot City", "Daska", "Pasrur"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Sindh", code: "SIN",
              districts: [
                {
                  name: "Karachi District", code: "KHI",
                  cities: [
                    {
                      name: "Karachi", code: "KHI", zip: "74000",
                      areas: ["Clifton", "Gulshan-e-Iqbal", "North Nazimabad", "Saddar"]
                    }
                  ]
                },
                {
                  name: "Hyderabad District", code: "HYD",
                  cities: [
                    {
                      name: "Hyderabad", code: "HYD", zip: "71000",
                      areas: ["Latifabad", "Qasimabad", "Hyderabad City"]
                    }
                  ]
                },
                {
                  name: "Sukkur District", code: "SKR",
                  cities: [
                    {
                      name: "Sukkur", code: "SKZ", zip: "65200",
                      areas: ["Sukkur City", "Rohri", "Pano Aqil"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Balochistan", code: "BAL",
              districts: [
                {
                  name: "Quetta District", code: "QTA",
                  cities: [
                    {
                      name: "Quetta", code: "QTA", zip: "87300",
                      areas: ["Quetta Cantt", "Sariab", "Quetta City"]
                    }
                  ]
                },
                {
                  name: "Gwadar District", code: "GWD",
                  cities: [
                    {
                      name: "Gwadar", code: "GWA", zip: "91200",
                      areas: ["Gwadar Port Area", "Pasni", "Ormara"]
                    }
                  ]
                },
                {
                  name: "Chaman District", code: "CHM",
                  cities: [
                    {
                      name: "Chaman", code: "CHM", zip: "86000",
                      areas: ["Chaman City"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Khyber Pakhtunkhwa (KPK)", code: "KPK",
              districts: [
                {
                  name: "Peshawar District", code: "PES",
                  cities: [
                    {
                      name: "Peshawar", code: "PEW", zip: "25000",
                      areas: ["Peshawar Cantt", "Hayatabad", "Peshawar City"]
                    }
                  ]
                },
                {
                  name: "Swat District", code: "SWA",
                  cities: [
                    {
                      name: "Mingora", code: "MIN", zip: "19130",
                      areas: ["Babuzai", "Kabal", "Barikot"]
                    }
                  ]
                },
                {
                  name: "Mardan District", code: "MRD",
                  cities: [
                    {
                      name: "Mardan", code: "MRD", zip: "23200",
                      areas: ["Mardan City", "Takht-i-Bahi"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Gilgit-Baltistan", code: "GIL",
              districts: [
                {
                  name: "Gilgit District", code: "GIL",
                  cities: [
                    {
                      name: "Gilgit", code: "GIL", zip: "15100",
                      areas: ["Gilgit City Area", "Danyore"]
                    }
                  ]
                },
                {
                  name: "Skardu District", code: "SKA",
                  cities: [
                    {
                      name: "Skardu", code: "SKA", zip: "16100",
                      areas: ["Skardu City Area", "Shigar"]
                    }
                  ]
                }
              ]
            }
          ];

          for (const s of pakData) {
            const stateId = await getOrCreateState(pakId, s.state, s.code);
            for (const d of s.districts) {
              const districtId = await getOrCreateDistrict(pakId, stateId, d.name, d.code);
              for (const c of d.cities) {
                const cityId = await getOrCreateCity(pakId, stateId, districtId, c.name, c.code, c.zip);
                for (const a of c.areas) {
                  await getOrCreateArea(pakId, stateId, districtId, cityId, a, c.zip);
                }
              }
            }
          }
        }

        const afgId = cByName.get("Afghanistan");
        if (afgId) {
          const afgData = [
            {
              state: "Kabul", code: "KAB",
              districts: [
                {
                  name: "Kabul District", code: "KAB",
                  cities: [
                    {
                      name: "Kabul", code: "KAB", zip: "1001",
                      areas: ["Kabul Downtown", "Bagrami", "Paghman", "Deh Sabz"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Kandahar", code: "KAN",
              districts: [
                {
                  name: "Kandahar District", code: "KAN",
                  cities: [
                    {
                      name: "Kandahar", code: "KAN", zip: "3701",
                      areas: ["Kandahar City Center", "Spin Boldak", "Panjwaye", "Arghandab"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Herat", code: "HER",
              districts: [
                {
                  name: "Herat District", code: "HER",
                  cities: [
                    {
                      name: "Herat", code: "HER", zip: "3001",
                      areas: ["Herat City Center", "Guzara", "Karukh", "Ghorian"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Balkh (Mazar-e-Sharif)", code: "BAL",
              districts: [
                {
                  name: "Mazar-e-Sharif District", code: "MAZ",
                  cities: [
                    {
                      name: "Mazar-e-Sharif", code: "MAZ", zip: "1701",
                      areas: ["Mazar Center", "Balkh District", "Dehdadi"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Nangarhar (Jalalabad)", code: "NAN",
              districts: [
                {
                  name: "Jalalabad District", code: "JAL",
                  cities: [
                    {
                      name: "Jalalabad", code: "JAL", zip: "2601",
                      areas: ["Jalalabad Center", "Behsud", "Surkh Rod"]
                    }
                  ]
                }
              ]
            }
          ];

          for (const s of afgData) {
            const stateId = await getOrCreateState(afgId, s.state, s.code);
            for (const d of s.districts) {
              const districtId = await getOrCreateDistrict(afgId, stateId, d.name, d.code);
              for (const c of d.cities) {
                const cityId = await getOrCreateCity(afgId, stateId, districtId, c.name, c.code, c.zip);
                for (const a of c.areas) {
                  await getOrCreateArea(afgId, stateId, districtId, cityId, a, c.zip);
                }
              }
            }
          }
        }

        const uaeIds = [cByName.get("United Arab Emirates"), cByName.get("UAE / Dubai")].filter(Boolean) as string[];
        if (uaeIds.length > 0) {
          const uaeData = [
            {
              state: "Dubai", code: "DXB",
              districts: [
                {
                  name: "Dubai District", code: "DUB",
                  cities: [
                    {
                      name: "Dubai", code: "DUB", zip: "00000",
                      areas: ["Deira", "Bur Dubai", "Al Rigga", "Al Nahda", "Al Qusais", "Karama", "Satwa", "Business Bay", "Jumeirah", "Al Barsha", "International City", "Dubai Marina"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Abu Dhabi", code: "AUH",
              districts: [
                {
                  name: "Abu Dhabi District", code: "ABU",
                  cities: [
                    {
                      name: "Abu Dhabi", code: "AUH", zip: "00000",
                      areas: ["Mussafah", "Khalifa City", "Abu Dhabi Center"]
                    },
                    {
                      name: "Al Ain", code: "AIN", zip: "00000",
                      areas: ["Al Ain Downtown"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Sharjah", code: "SHJ",
              districts: [
                {
                  name: "Sharjah District", code: "SHJ",
                  cities: [
                    {
                      name: "Sharjah", code: "SHJ", zip: "00000",
                      areas: ["Al Nahda Sharjah", "Al Majaz", "Khor Fakkan", "Kalba"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Ajman", code: "AJM",
              districts: [
                {
                  name: "Ajman District", code: "AJM",
                  cities: [
                    {
                      name: "Ajman", code: "AJM", zip: "00000",
                      areas: ["Ajman Downtown", "Al Nuaimia"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Umm Al Quwain", code: "UAQ",
              districts: [
                {
                  name: "Umm Al Quwain District", code: "UAQ",
                  cities: [
                    {
                      name: "Umm Al Quwain", code: "UAQ", zip: "00000",
                      areas: ["UAQ Center"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Ras Al Khaimah", code: "RAK",
              districts: [
                {
                  name: "Ras Al Khaimah District", code: "RAK",
                  cities: [
                    {
                      name: "Ras Al Khaimah", code: "RAK", zip: "00000",
                      areas: ["RAK Center", "Al Hamra"]
                    }
                  ]
                }
              ]
            },
            {
              state: "Fujairah", code: "FUJ",
              districts: [
                {
                  name: "Fujairah District", code: "FUJ",
                  cities: [
                    {
                      name: "Fujairah", code: "FUJ", zip: "00000",
                      areas: ["Fujairah Center", "Dibba"]
                    }
                  ]
                }
              ]
            }
          ];

          for (const uaeId of uaeIds) {
            for (const s of uaeData) {
              const stateId = await getOrCreateState(uaeId, s.state, s.code);
              for (const d of s.districts) {
                const districtId = await getOrCreateDistrict(uaeId, stateId, d.name, d.code);
                for (const c of d.cities) {
                  const cityId = await getOrCreateCity(uaeId, stateId, districtId, c.name, c.code, c.zip);
                  for (const a of c.areas) {
                    await getOrCreateArea(uaeId, stateId, districtId, cityId, a, c.zip);
                  }
                }
              }
            }
          }
        }

        logs.push(`Successfully checked and inserted missing rows. Created: ${createdStates} states, ${createdDistricts} districts, ${createdCities} cities, ${createdAreas} areas.`);
      } catch (err: any) {
        logs.push(`Seed error: ${err.message}`);
      }

      await sql.end();
      return NextResponse.json({ success: true, logs });
    }

    // Default diagnostics return
    const profiles = await sql`SELECT * FROM public.profiles`;
    const roleAssignments = await sql`SELECT * FROM public.user_role_assignments`;
    const authUsers = await sql`SELECT id, email, raw_user_meta_data FROM auth.users`;

    const countryBranches = await sql`
      SELECT cb.id, cb.name, cb.code, cb.local_currency, c.name as country_name
      FROM public.country_branches cb
      JOIN public.countries c ON c.id = cb.country_id
      WHERE cb.deleted_at IS NULL
    `;

    const cityBranches = await sql`
      SELECT cb.id, cb.name, cb.code, cb.local_currency, cb.city_name, c.name as country_name
      FROM public.city_branches cb
      JOIN public.countries c ON c.id = cb.country_id
      WHERE cb.deleted_at IS NULL
    `;

    const countries = await sql`SELECT count(*)::int as count FROM public.countries WHERE deleted_at IS NULL`;
    const states = await sql`SELECT count(*)::int as count FROM public.states_provinces WHERE deleted_at IS NULL`;
    const districts = await sql`SELECT count(*)::int as count FROM public.districts WHERE deleted_at IS NULL`;
    const cities = await sql`SELECT count(*)::int as count FROM public.cities WHERE deleted_at IS NULL`;
    const areas = await sql`SELECT count(*)::int as count FROM public.areas_locations WHERE deleted_at IS NULL`;

    await sql.end();

    return NextResponse.json({
      profiles,
      roleAssignments,
      authUsers,
      countryBranches,
      cityBranches,
      counts: {
        countries: countries[0].count,
        states: states[0].count,
        districts: districts[0].count,
        cities: cities[0].count,
        areas: areas[0].count
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 200 });
  }
}
