import { resolveCountryEmailConfig, type ResolvedCountryEmailConfig } from "@/lib/email/country-email-config";

type AdminClient = any;

export type CommunicationScope = {
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
};

export type CommunicationSenderConfig = ResolvedCountryEmailConfig & {
  profileId: string | null;
  whatsappNumber: string | null;
  channelSettings: {
    email: Record<string, unknown>;
    whatsapp: Record<string, unknown>;
  };
};

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function fetchBranchContext(admin: AdminClient, scope: CommunicationScope) {
  const [countryResult, countryBranchResult, cityBranchResult] = await Promise.all([
    scope.countryId
      ? admin
          .from("countries")
          .select("id,name,iso2,official_email,admin_email,email_domain,email_server_settings")
          .eq("id", scope.countryId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    scope.countryBranchId
      ? admin
          .from("country_branches")
          .select("id,name,code,country_id,local_currency,email")
          .eq("id", scope.countryBranchId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    scope.cityBranchId
      ? admin
          .from("city_branches")
          .select("id,name,code,city_name,country_id,country_branch_id,local_currency,email")
          .eq("id", scope.cityBranchId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (countryResult.error) throw countryResult.error;
  if (countryBranchResult.error) throw countryBranchResult.error;
  if (cityBranchResult.error) throw cityBranchResult.error;

  const cityBranch = firstRow(cityBranchResult.data);
  const countryBranch = firstRow(countryBranchResult.data);
  let country = firstRow(countryResult.data);

  if (!country && (cityBranch?.country_id || countryBranch?.country_id)) {
    const { data, error } = await admin
      .from("countries")
      .select("id,name,iso2,official_email,admin_email,email_domain,email_server_settings")
      .eq("id", cityBranch?.country_id ?? countryBranch?.country_id)
      .maybeSingle();
    if (error) throw error;
    country = firstRow(data);
  }

  return {
    country,
    countryBranch,
    cityBranch
  };
}

async function fetchCommunicationProfile(admin: AdminClient, scope: CommunicationScope) {
  const queries = [
    scope.cityBranchId
      ? admin
          .from("communication_center_profiles")
          .select("*")
          .eq("city_branch_id", scope.cityBranchId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : null,
    scope.countryBranchId
      ? admin
          .from("communication_center_profiles")
          .select("*")
          .eq("country_branch_id", scope.countryBranchId)
          .is("city_branch_id", null)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : null,
    scope.countryId
      ? admin
          .from("communication_center_profiles")
          .select("*")
          .eq("country_id", scope.countryId)
          .is("country_branch_id", null)
          .is("city_branch_id", null)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : null
  ].filter(Boolean) as PromiseLike<{ data: any; error: any }>[];

  for (const query of queries) {
    const { data, error } = await query;
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

export async function resolveCommunicationSender(admin: AdminClient, scope: CommunicationScope): Promise<CommunicationSenderConfig> {
  const branchContext = await fetchBranchContext(admin, scope);
  const profile = await fetchCommunicationProfile(admin, {
    countryId: branchContext.country?.id ?? scope.countryId ?? null,
    countryBranchId: branchContext.countryBranch?.id ?? scope.countryBranchId ?? null,
    cityBranchId: branchContext.cityBranch?.id ?? scope.cityBranchId ?? null
  });

  const fallback = resolveCountryEmailConfig(branchContext.country, {
    mainBranchName: branchContext.countryBranch?.name ?? null,
    mainBranchCode: branchContext.countryBranch?.code ?? null,
    cityBranchName: branchContext.cityBranch?.name ?? null,
    cityBranchCode: branchContext.cityBranch?.code ?? null,
    cityName: branchContext.cityBranch?.city_name ?? null
  });

  const officeName = profile?.office_name ?? fallback.officeName;
  const displayBranchName = profile?.branch_display_name ?? fallback.displayBranchName;
  const signatureText = profile?.signature_text ?? fallback.signatureText;
  const signatureHtml = profile?.signature_html ?? fallback.signatureHtml;

  return {
    ...fallback,
    profileId: profile?.id ?? null,
    officeName,
    fromName: displayBranchName ? `${officeName} | ${displayBranchName}` : officeName,
    fromEmail: profile?.email_address ?? fallback.fromEmail,
    replyTo: profile?.email_address ?? fallback.replyTo,
    whatsappNumber: profile?.whatsapp_number ?? null,
    displayBranchName,
    signatureText,
    signatureHtml,
    logoUrl: profile?.logo_url ?? fallback.logoUrl,
    channelSettings: {
      email: profile?.email_settings ?? {},
      whatsapp: profile?.whatsapp_settings ?? {}
    }
  };
}

export function applySessionScopeDefaults(session: any, scope: CommunicationScope): CommunicationScope {
  if (session?.isSuperAdmin) return scope;
  return {
    countryId: scope.countryId ?? session?.countryIds?.[0] ?? null,
    countryBranchId: scope.countryBranchId ?? session?.countryBranchIds?.[0] ?? null,
    cityBranchId: scope.cityBranchId ?? session?.cityBranchIds?.[0] ?? null
  };
}

