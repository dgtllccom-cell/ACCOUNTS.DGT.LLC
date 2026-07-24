import { NextResponse } from "next/server";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { locationsRepository } from "@/lib/repositories/locations-repository";

type SeedCity = {
  name: string;
  code: string;
  zip: string;
};

type SeedState = {
  name: string;
  code: string;
  cities: SeedCity[];
};

const pakistanStates: SeedState[] = [
  {
    name: "Punjab",
    code: "PUN",
    cities: [
      { name: "Lahore", code: "LHE", zip: "54000" },
      { name: "Faisalabad", code: "FSD", zip: "38000" },
      { name: "Multan", code: "MUX", zip: "60000" },
      { name: "Rawalpindi", code: "RWP", zip: "46000" }
    ]
  },
  {
    name: "Sindh",
    code: "SIN",
    cities: [
      { name: "Karachi", code: "KHI", zip: "74000" },
      { name: "Hyderabad", code: "HDD", zip: "71000" },
      { name: "Sukkur", code: "SKZ", zip: "65200" }
    ]
  },
  {
    name: "Balochistan",
    code: "BAL",
    cities: [
      { name: "Quetta", code: "QTA", zip: "87300" },
      { name: "Gwadar", code: "GWD", zip: "91200" },
      { name: "Khuzdar", code: "KHD", zip: "89100" },
      { name: "Chaman", code: "CHM", zip: "86000" },
      { name: "Turbat", code: "TBT", zip: "92600" },
      { name: "Zhob", code: "ZHB", zip: "85200" }
    ]
  },
  {
    name: "KPK",
    code: "KPK",
    cities: [
      { name: "Peshawar", code: "PEW", zip: "25000" },
      { name: "Mardan", code: "MRD", zip: "23200" },
      { name: "Abbottabad", code: "ABT", zip: "22010" }
    ]
  },
  {
    name: "Islamabad",
    code: "ISL",
    cities: [{ name: "Islamabad", code: "ISB", zip: "44000" }]
  }
];

const uaeDefaultZip = "00000";

const uaeEmirates: SeedState[] = [
  {
    name: "Dubai",
    code: "DXB",
    cities: [
      { name: "Deira", code: "DEI", zip: uaeDefaultZip },
      { name: "Bur Dubai", code: "BUR", zip: uaeDefaultZip },
      { name: "Jumeirah", code: "JUM", zip: uaeDefaultZip },
      { name: "Dubai Marina", code: "DMR", zip: uaeDefaultZip },
      { name: "Business Bay", code: "BBY", zip: uaeDefaultZip }
    ]
  },
  {
    name: "Abu Dhabi",
    code: "AUH",
    cities: [
      { name: "Abu Dhabi City", code: "ADC", zip: uaeDefaultZip },
      { name: "Al Ain", code: "AAN", zip: uaeDefaultZip },
      { name: "Mussafah", code: "MSF", zip: uaeDefaultZip }
    ]
  },
  {
    name: "Sharjah",
    code: "SHJ",
    cities: [
      { name: "Sharjah City", code: "SHC", zip: uaeDefaultZip },
      { name: "Al Nahda", code: "AND", zip: uaeDefaultZip },
      { name: "Al Majaz", code: "AMJ", zip: uaeDefaultZip }
    ]
  },
  {
    name: "Ajman",
    code: "AJM",
    cities: [{ name: "Ajman City", code: "AJC", zip: uaeDefaultZip }]
  },
  {
    name: "Ras Al Khaimah",
    code: "RAK",
    cities: [{ name: "Ras Al Khaimah City", code: "RAKC", zip: uaeDefaultZip }]
  },
  {
    name: "Fujairah",
    code: "FUJ",
    cities: [{ name: "Fujairah City", code: "FUJC", zip: uaeDefaultZip }]
  },
  {
    name: "Umm Al Quwain",
    code: "UAQ",
    cities: [{ name: "Umm Al Quwain City", code: "UAQC", zip: uaeDefaultZip }]
  }
];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function seedCountryLocations(countryId: string, states: SeedState[]) {
  const seededStates: Array<{ name: string; code: string }> = [];
  const seededCities: Array<{ state: string; name: string; code: string; zip: string }> = [];

  for (const state of states) {
    const stateRow = await locationsRepository.createState({
      countryId,
      name: state.name,
      code: state.code,
      createdBy: null
    }).catch(async (error: Error) => {
      if (!/duplicate|exists/i.test(error.message)) {
        throw error;
      }
      const admin = createSupabaseAdminClient() as any;
      const { data } = await admin
        .from("states_provinces")
        .select("id, name, code")
        .eq("country_id", countryId)
        .eq("name", state.name)
        .is("deleted_at", null)
        .maybeSingle();
      return data;
    });

    if (!stateRow?.id) continue;

    if (stateRow.code !== state.code) {
      const admin = createSupabaseAdminClient() as any;
      await admin
        .from("states_provinces")
        .update({ code: state.code })
        .eq("id", stateRow.id)
        .is("deleted_at", null);
    } else {
      seededStates.push({ name: state.name, code: state.code });
    }

    for (const city of state.cities) {
      try {
        const cityRow = await locationsRepository.createCity({
          countryId,
          stateProvinceId: stateRow.id,
          name: city.name,
          code: city.code,
          zipCode: city.zip,
          createdBy: null
        });
        if (cityRow?.id) {
          seededCities.push({ state: state.name, name: city.name, code: city.code, zip: city.zip });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/duplicate|exists/i.test(message)) {
          const admin = createSupabaseAdminClient() as any;
          const { data } = await admin
            .from("cities")
            .select("id, name, code, zip_code")
            .eq("country_id", countryId)
            .eq("state_province_id", stateRow.id)
            .eq("name", city.name)
            .is("deleted_at", null)
            .maybeSingle();
          if (data?.id) {
            const patch: Record<string, unknown> = {};
            if ((data.code ?? "").toUpperCase() !== city.code.toUpperCase()) patch.code = city.code;
            if ((data.zip_code ?? "") !== city.zip) patch.zip_code = city.zip;
            if (Object.keys(patch).length) {
              await admin.from("cities").update(patch).eq("id", data.id).is("deleted_at", null);
            }
            seededCities.push({ state: state.name, name: city.name, code: city.code, zip: city.zip });
            continue;
          }
        }
        throw error;
      }
    }
  }

  return { seededStates, seededCities };
}

async function seedPakistanLocations(countryId: string) {
  return seedCountryLocations(countryId, pakistanStates);
}

async function seedUaeLocations(countryId: string) {
  return seedCountryLocations(countryId, uaeEmirates);
}

async function detachBranchScopedRows(
  admin: ReturnType<typeof createSupabaseAdminClient> & any,
  table: string,
  scopeColumn: "scope"
) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from(table)
    .select("id, country_id")
    .or("country_branch_id.not.is.null,city_branch_id.not.is.null");
  if (error) {
    throw new Error(`${table} lookup: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ id: string; country_id: string | null }>;
  const countryScopedIds = rows.filter((row) => Boolean(row.country_id)).map((row) => row.id);
  const globalScopedIds = rows.filter((row) => !row.country_id).map((row) => row.id);

  if (countryScopedIds.length) {
    const { error: countryDetachError } = await admin
      .from(table)
      .update({
        [scopeColumn]: "country",
        country_branch_id: null,
        city_branch_id: null,
        updated_at: now
      })
      .in("id", countryScopedIds);
    if (countryDetachError) {
      throw new Error(`${table} country detach: ${countryDetachError.message}`);
    }
  }

  if (globalScopedIds.length) {
    const { error: globalDetachError } = await admin
      .from(table)
      .update({
        [scopeColumn]: "super_admin",
        country_id: null,
        country_branch_id: null,
        city_branch_id: null,
        updated_at: now
      })
      .in("id", globalScopedIds);
    if (globalDetachError) {
      throw new Error(`${table} super-admin detach: ${globalDetachError.message}`);
    }
  }
}

export async function POST() {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Only Super Admin can reset branch setup." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient() as any;
    const progress: Array<{ step: string; status: "done" | "skipped"; note?: string }> = [];

    const countryUpdate = await admin
      .from("countries")
      .update({ default_country_branch_id: null })
      .not("default_country_branch_id", "is", null);
    if (countryUpdate.error) {
      throw new Error(`countries: ${countryUpdate.error.message}`);
    }

    const { data: branchLedgers, error: branchLedgersError } = await admin
      .from("ledgers")
      .select("id")
      .in("scope", ["main_branch", "city_branch"]);
    if (branchLedgersError) {
      throw new Error(`ledgers lookup: ${branchLedgersError.message}`);
    }

    const branchLedgerIds = (branchLedgers ?? []).map((row: { id: string }) => row.id).filter(Boolean);

    const { data: branchBatches, error: branchBatchesError } = await admin
      .from("ledger_posting_batches")
      .select("id")
      .in("scope", ["main_branch", "city_branch"]);
    if (branchBatchesError) {
      throw new Error(`ledger_posting_batches lookup: ${branchBatchesError.message}`);
    }

    const branchBatchIds = (branchBatches ?? []).map((row: { id: string }) => row.id).filter(Boolean);

    if (branchLedgerIds.length) {
      const { error: ledgerBalanceError } = await admin.from("ledger_balances").delete().in("ledger_id", branchLedgerIds);
      if (ledgerBalanceError) {
        throw new Error(`ledger_balances: ${ledgerBalanceError.message}`);
      }

      const { error: ledgerPostingLineByLedgerError } = await admin
        .from("ledger_posting_lines")
        .delete()
        .in("ledger_id", branchLedgerIds);
      if (ledgerPostingLineByLedgerError) {
        throw new Error(`ledger_posting_lines: ${ledgerPostingLineByLedgerError.message}`);
      }

      const { error: roznamchaLineError } = await admin.from("roznamcha_lines").delete().in("ledger_id", branchLedgerIds);
      if (roznamchaLineError) {
        throw new Error(`roznamcha_lines: ${roznamchaLineError.message}`);
      }
    }

    if (branchBatchIds.length) {
      const { error: ledgerPostingLineByBatchError } = await admin
        .from("ledger_posting_lines")
        .delete()
        .in("batch_id", branchBatchIds);
      if (ledgerPostingLineByBatchError) {
        throw new Error(`ledger_posting_lines(batch): ${ledgerPostingLineByBatchError.message}`);
      }
    }

    await detachBranchScopedRows(admin, "enterprise_accounts", "scope");
    await detachBranchScopedRows(admin, "financial_periods", "scope");
    await detachBranchScopedRows(admin, "ledger_posting_batches", "scope");
    await detachBranchScopedRows(admin, "ledgers", "scope");
    await detachBranchScopedRows(admin, "voucher_sequences", "scope");

    const deletions = [
      {
        table: "approval_requests",
        filter: "country_branch_id.not.is.null,city_branch_id.not.is.null"
      },
      {
        table: "daily_usd_rates",
        filter: "country_branch_id.not.is.null"
      },
      {
        table: "module_number_sequences",
        filter: "city_branch_id.not.is.null"
      },
      {
        table: "purchase_orders",
        filter: "country_branch_id.not.is.null,city_branch_id.not.is.null"
      },
      {
        table: "record_change_history",
        filter: "city_branch_id.not.is.null"
      },
      {
        table: "report_runs",
        filter: "country_branch_id.not.is.null,city_branch_id.not.is.null"
      },
      {
        table: "reports",
        filter: "city_branch_id.not.is.null"
      },
      {
        table: "roznamcha_entries",
        filter: "country_branch_id.not.is.null,city_branch_id.not.is.null"
      },
      {
        table: "soft_delete_logs",
        filter: "city_branch_id.not.is.null"
      },
      {
        table: "transactions",
        filter: "city_branch_id.not.is.null"
      },
      {
        table: "user_role_assignments",
        filter: "country_branch_id.not.is.null,city_branch_id.not.is.null"
      },
      {
        table: "usd_purchase_sales",
        filter: "country_branch_id.not.is.null,city_branch_id.not.is.null"
      }
    ] as const;

    for (const entry of deletions) {
      const { error } = await admin.from(entry.table).delete().or(entry.filter);
      if (error) {
        throw new Error(`${entry.table}: ${error.message}`);
      }
    }

    const branchDeletes = [
      "city_branches",
      "country_branches"
    ] as const;

    for (const table of branchDeletes) {
      const { error } = await admin.from(table).delete().not("id", "is", null);
      if (error) {
        throw new Error(`${table}: ${error.message}`);
      }
    }

    progress.push({ step: "branch_cleanup", status: "done", note: "Cleared branch hierarchy and branch-scoped mappings." });

    const { data: pakistan } = await admin
      .from("countries")
      .select("id, name")
      .eq("name", "Pakistan")
      .is("deleted_at", null)
      .maybeSingle();

    if (pakistan?.id && isUuid(pakistan.id)) {
      const seeded = await seedPakistanLocations(pakistan.id);
      progress.push({
        step: "location_seed",
        status: "done",
        note: `${seeded.seededStates.length} states, ${seeded.seededCities.length} cities inserted`
      });
    } else {
      progress.push({ step: "location_seed", status: "skipped", note: "Pakistan country not found." });
    }

    return NextResponse.json(
      {
        ok: true,
        progress,
        message: "Branch setup cleared and Pakistan demo locations seeded."
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
