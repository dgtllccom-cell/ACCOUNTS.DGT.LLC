import { withLocalPg } from "@/lib/db/local-postgres";
import { z } from "zod";

export type PublicAddressChoice = { id: string; name: string; postalCode?: string | null };

type LinkAddressScope = { central_address?: boolean; country_id?: string | null; form_type?: string; status?: string };

export function usesCentralExternalAddress(link: LinkAddressScope): boolean {
  return link.central_address === true && Boolean(link.country_id) &&
    link.status === "active" && (link.form_type === "customer" || link.form_type === "employee");
}

export const externalAddressIds = z.object({
  addressCountryId: z.string().uuid(),
  stateProvinceId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid(),
});

export const externalLocationQuery = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("country") }),
  z.object({ kind: z.literal("state"), countryId: z.string().uuid() }),
  z.object({ kind: z.literal("city"), countryId: z.string().uuid(), stateProvinceId: z.string().uuid().nullable() }),
]);

export async function listExternalAddressChoices(token: string, query: z.infer<typeof externalLocationQuery>) {
  return withLocalPg(async (sql) => {
    // Authorization is enforced on each geography read; preview and legacy links do not participate.
    const [link] = await sql`
      SELECT 1
      FROM public.external_form_links l
      JOIN public.countries owner ON owner.id = l.country_id AND owner.deleted_at IS NULL AND owner.is_active
      WHERE l.token = ${token} AND l.central_address AND l.status = 'active'
        AND l.form_type IN ('customer', 'employee') AND (l.expires_at IS NULL OR l.expires_at > now())
    `;
    if (!link) return null;
    if (query.kind === "country") {
      return await sql<PublicAddressChoice[]>`
        SELECT id, name FROM public.countries WHERE deleted_at IS NULL AND is_active ORDER BY name, id
      `;
    }
    if (query.kind === "state") {
      return await sql<PublicAddressChoice[]>`
        SELECT s.id, s.name FROM public.states_provinces s
        JOIN public.countries c ON c.id = s.country_id AND c.deleted_at IS NULL AND c.is_active
        WHERE s.country_id = ${query.countryId}::uuid AND s.deleted_at IS NULL AND s.is_active ORDER BY s.name, s.id
      `;
    }
    return await sql<PublicAddressChoice[]>`
      SELECT ci.id, ci.name, ci.zip_code AS "postalCode" FROM public.cities ci
      JOIN public.countries c ON c.id = ci.country_id AND c.deleted_at IS NULL AND c.is_active
      LEFT JOIN public.states_provinces s ON s.id = ci.state_province_id AND s.country_id = ci.country_id
        AND s.deleted_at IS NULL AND s.is_active
      WHERE ci.country_id = ${query.countryId}::uuid AND ci.deleted_at IS NULL AND ci.is_active
        AND ci.state_province_id IS NOT DISTINCT FROM ${query.stateProvinceId}::uuid
        AND (ci.state_province_id IS NULL OR s.id IS NOT NULL)
      ORDER BY ci.name, ci.id
    `;
  });
}

export type ValidatedExternalAddress = {
  country: string;
  stateProvince: string | null;
  city: string;
};

export async function resolveExternalAddress(ids: z.infer<typeof externalAddressIds>, issuingCountryId: string) {
  return withLocalPg(async (sql) => {
    const [match] = await sql<ValidatedExternalAddress[]>`
      SELECT c.name AS country, s.name AS "stateProvince", ci.name AS city
      FROM public.cities ci
      JOIN public.countries c ON c.id = ci.country_id AND c.deleted_at IS NULL AND c.is_active
      JOIN public.countries owner ON owner.id = ${issuingCountryId}::uuid AND owner.deleted_at IS NULL AND owner.is_active
      LEFT JOIN public.states_provinces s ON s.id = ci.state_province_id AND s.country_id = c.id
        AND s.deleted_at IS NULL AND s.is_active
      WHERE ci.id = ${ids.cityId}::uuid AND c.id = ${ids.addressCountryId}::uuid AND ci.deleted_at IS NULL AND ci.is_active
        AND ci.state_province_id IS NOT DISTINCT FROM ${ids.stateProvinceId ?? null}::uuid
        AND (ci.state_province_id IS NULL OR s.id IS NOT NULL)
    `;
    return match ?? null;
  });
}
