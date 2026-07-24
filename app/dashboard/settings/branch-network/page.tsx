import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Building, Globe } from "lucide-react";

type CountryBranchNode = {
  id: string;
  name: string;
  code: string;
  currency: string;
  mainBranches: Array<{
    id: string;
    name: string;
    code: string;
    cityBranches: Array<{
      id: string;
      name: string;
      cityName: string;
      code: string;
    }>;
  }>;
};

const CARD_PALETTE = [
  { gradient: "from-violet-500 to-purple-600" },
  { gradient: "from-sky-500 to-blue-600" },
  { gradient: "from-emerald-500 to-teal-600" },
  { gradient: "from-orange-500 to-rose-500" },
  { gradient: "from-pink-500 to-fuchsia-600" },
  { gradient: "from-amber-500 to-yellow-500" },
  { gradient: "from-cyan-500 to-sky-600" },
  { gradient: "from-indigo-500 to-blue-700" },
];

async function loadBranchNetworks(): Promise<CountryBranchNode[]> {
  const supabase = createSupabaseAdminClient();
  const [countriesList, mainBranchesList, cityBranchesList] = await Promise.all([
    supabase.from("countries").select("id, name, currency_code").is("deleted_at", null),
    supabase.from("country_branches").select("id, country_id, name, code").is("deleted_at", null),
    supabase.from("city_branches").select("id, country_id, country_branch_id, city_name, name, code").is("deleted_at", null)
  ]);

  return (countriesList.data ?? []).map((country: any) => {
    const countryMain = (mainBranchesList.data ?? []).filter((b: any) => b.country_id === country.id);
    return {
      id: country.id,
      name: country.name,
      code: country.name.substring(0, 3).toUpperCase(),
      currency: country.currency_code,
      mainBranches: countryMain.map((mb: any) => {
        const mainCityBranches = (cityBranchesList.data ?? []).filter((cb: any) => cb.country_branch_id === mb.id);
        return {
          id: mb.id, name: mb.name, code: mb.code,
          cityBranches: mainCityBranches.map((cb: any) => ({
            id: cb.id, name: cb.name, cityName: cb.city_name, code: cb.code
          }))
        };
      })
    };
  });
}

export default async function BranchNetworkPage() {
  const countryBranches = await loadBranchNetworks();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Master Form</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Globe className="h-6 w-6 text-indigo-500" />
          Nations & Branch Networks
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Country -&gt; Main Branch -&gt; City Branch topology view
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Configured Networks</h2>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
          </span>
        </div>
        <div className="p-5">
          {countryBranches.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {countryBranches.map((country, idx) => {
                const p = CARD_PALETTE[idx % CARD_PALETTE.length];
                return (
                  <div key={country.id} className="rounded-xl border border-slate-100 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-900/20">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${p.gradient} text-[10px] font-black text-white`}>
                          {country.code}
                        </div>
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{country.name}</span>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {country.currency || "USD"}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {country.mainBranches.length ? (
                        country.mainBranches.map((mb) => (
                          <div key={mb.id} className="rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <Building className="h-3 w-3 text-indigo-500" />
                              {mb.name}
                              <span className="font-mono text-[9px] text-slate-400">({mb.code})</span>
                            </p>
                            {mb.cityBranches.length ? (
                              <div className="mt-2 space-y-1 border-l-2 border-dashed border-slate-200 pl-4 dark:border-slate-700">
                                {mb.cityBranches.map((cb) => (
                                  <div key={cb.id} className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500">{cb.cityName} - {cb.name}</span>
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[8px] font-bold dark:bg-slate-800">{cb.code}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 pl-4 text-[10px] italic text-slate-400">No city branches</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] italic text-slate-400">No main branch configured</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No countries configured yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
