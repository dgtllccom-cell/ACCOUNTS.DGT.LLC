import fs from "node:fs";
import postgres from "postgres";

const confirmFlag = "--confirm-delete-users-except-spreadsheet";
const applyChanges = process.argv.includes(confirmFlag);

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const explicitEmail = process.env.SPREADSHEET_USER_EMAIL?.trim().toLowerCase();
const explicitId = process.env.SPREADSHEET_USER_ID?.trim();
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 20 });

try {
  const users = await sql`
    select u.id, u.email, u.raw_user_meta_data, p.full_name, p.user_code
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at nulls last
  `;

  const keepUsers = users.filter((user) => {
    const email = String(user.email ?? "").toLowerCase();
    const meta = JSON.stringify(user.raw_user_meta_data ?? {}).toLowerCase();
    const fullName = String(user.full_name ?? "").toLowerCase();
    const userCode = String(user.user_code ?? "").toLowerCase();
    if (explicitId && user.id === explicitId) return true;
    if (explicitEmail && email === explicitEmail) return true;
    return [email, meta, fullName, userCode].some((value) =>
      value.includes("spreadsheet") || value.includes("spread sheet") || value.includes("sheet")
    );
  });

  const deleteUsers = users.filter((user) => !keepUsers.some((keep) => keep.id === user.id));

  if (!applyChanges || keepUsers.length === 0) {
    console.log(JSON.stringify({
      status: keepUsers.length === 0 ? "blocked_no_spreadsheet_user_found" : "dry_run",
      mode: applyChanges ? "no delete executed because Spreadsheet user was not found" : `no changes; rerun with ${confirmFlag}`,
      hint: "Set SPREADSHEET_USER_EMAIL or SPREADSHEET_USER_ID in .env.local if the Spreadsheet user has a different name.",
      keepUsers,
      deleteUsersCount: deleteUsers.length,
      deleteUsers: deleteUsers.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name, user_code: u.user_code })),
    }, null, 2));
    process.exit(keepUsers.length === 0 ? 2 : 0);
  }

  await sql.begin(async (tx) => {
    await tx`delete from auth.users where id <> all(${keepUsers.map((user) => user.id)}::uuid[])`;
  });

  const remaining = await sql`
    select u.id, u.email, p.full_name, p.user_code
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at nulls last
  `;

  console.log(JSON.stringify({
    status: "success",
    keptUsers: keepUsers.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name, user_code: u.user_code })),
    deletedUsersCount: deleteUsers.length,
    remainingUsers: remaining,
  }, null, 2));
} catch (error) {
  console.error("DELETE_USERS_EXCEPT_SPREADSHEET_FAILED", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
