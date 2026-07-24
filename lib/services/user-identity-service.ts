import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";

function roleAbbrev(role: EnterpriseRole) {
  switch (role) {
    case "super_admin":
      return "SA";
    case "country_admin":
      return "CA";
    case "main_branch_admin":
      return "MA";
    case "city_branch_admin":
      return "BR";
    case "accountant":
      return "ACC";
    case "cashier":
      return "CASH";
    case "agent_user":
      return "AG";
    case "staff_user":
      return "ST";
    case "auditor_viewer":
      return "AUD";
    default:
      return "USR";
  }
}

export function normalizeUserCode(input: string) {
  return input
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .toUpperCase();
}

async function fetchCountryCode(admin: any, countryId: string | null) {
  if (!countryId) return "CNT";

  const { data: country } = await admin.from("countries").select("iso3, iso2, name").eq("id", countryId).maybeSingle();
  const iso3 = (country?.iso3 as string | null) ?? null;
  const iso2 = (country?.iso2 as string | null) ?? null;
  const name = (country?.name as string | null) ?? null;

  const code = (iso3 || iso2 || (name ? name.replace(/\s+/g, "").slice(0, 3) : "CNT") || "CNT").toUpperCase();
  return code || "CNT";
}

async function findLastIssuedCode(admin: any, prefix: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("user_code")
    .ilike("user_code", `${prefix}-%`)
    .is("deleted_at", null)
    .order("user_code", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  const last = Array.isArray(data) && data.length ? (data[0]?.user_code as string | null) : null;
  return last;
}

export async function issueNextUserCode(admin: any, input: { role: EnterpriseRole; countryId: string | null }) {
  const prefix =
    input.role === "super_admin" ? "SA" : `${await fetchCountryCode(admin, input.countryId)}-${roleAbbrev(input.role)}`;

  const last = await findLastIssuedCode(admin, prefix);
  const lastNum = last ? Number(String(last).split("-").pop()) : 0;
  const nextNum = Number.isFinite(lastNum) && lastNum > 0 ? lastNum + 1 : 1;
  return normalizeUserCode(`${prefix}-${String(nextNum).padStart(6, "0")}`);
}

