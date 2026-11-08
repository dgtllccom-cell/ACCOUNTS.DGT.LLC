import { describe, expect, it } from "vitest";
import { cashDirectionRate, cashUsdEquivalent, dailyRateValues } from "@/lib/currency/exact-daily-rate";

describe("Roznamcha Exchange Rate Integration (Daily Exchange Module authoritative source)", () => {
  const targetDate = "2026-11-07";

  const countriesMaster = [
    { id: "pk-id", name: "Pakistan", currency_code: "PKR", iso2: "PK" },
    { id: "ae-id", name: "United Arab Emirates", currency_code: "AED", iso2: "AE" },
    { id: "af-id", name: "Afghanistan", currency_code: "AFN", iso2: "AF" },
    { id: "us-id", name: "United States", currency_code: "USD", iso2: "US" },
  ];

  const dailyExchangeRates = [
    // Approved rate for Pakistan for targetDate
    {
      id: "rate-pk-1",
      country_id: "pk-id",
      rate_date: "2026-11-07",
      currency_code: "PKR",
      credit_rate: 278.5,
      debit_rate: 277.8,
      selling_rate: 278.5,
      buying_rate: 277.8,
      superseded_at: null,
      user_name: "Pakistan Admin",
    },
    // Old rate for Afghanistan for an earlier date (should NOT be used for 2026-11-07)
    {
      id: "rate-af-old",
      country_id: "af-id",
      rate_date: "2026-11-05",
      currency_code: "AFN",
      credit_rate: 68.5,
      debit_rate: 67.9,
      superseded_at: null,
      user_name: "Kabul Admin",
    },
  ];

  const countriesStatus = [
    {
      countryId: "pk-id",
      countryName: "Pakistan",
      currencyCode: "PKR",
      iso2: "PK",
      rateDate: "2026-11-07",
      status: "APPROVED",
      creditRate: 278.5,
      debitRate: 277.8,
    },
    {
      countryId: "ae-id",
      countryName: "United Arab Emirates",
      currencyCode: "AED",
      iso2: "AE",
      rateDate: "2026-11-07",
      status: "PENDING_MISSING",
      creditRate: null,
      debitRate: null,
    },
    {
      countryId: "af-id",
      countryName: "Afghanistan",
      currencyCode: "AFN",
      iso2: "AF",
      rateDate: "2026-11-07",
      status: "PENDING_MISSING",
      creditRate: null,
      debitRate: null,
    },
  ];

  function buildActiveRatesList(
    countries: typeof countriesMaster,
    rates: typeof dailyExchangeRates,
    statusList: typeof countriesStatus,
    date: string,
    isSuperAdmin: boolean,
    userCountryIds: string[]
  ) {
    const scoped = isSuperAdmin || userCountryIds.length === 0
      ? countries
      : countries.filter((c) => userCountryIds.includes(c.id));

    return scoped.map((c) => {
      const code = (c.currency_code || "AED").toUpperCase();
      if (code === "USD") {
        return {
          countryId: c.id,
          countryName: c.name,
          currencyCode: "USD",
          rate: 1.0,
          creditRate: 1.0,
          debitRate: 1.0,
          rateDate: date,
          status: "APPROVED" as const,
          statusLabel: "Approved",
        };
      }

      const statusEntry = statusList.find(
        (cs) => cs.countryId === c.id && cs.rateDate === date && cs.status === "APPROVED"
      );

      const exactRow = rates.find(
        (r) => r.country_id === c.id && r.rate_date === date && !r.superseded_at
      );

      const creditRate = exactRow?.credit_rate ?? exactRow?.selling_rate ?? statusEntry?.creditRate ?? null;
      const debitRate = exactRow?.debit_rate ?? exactRow?.buying_rate ?? statusEntry?.debitRate ?? null;
      const rateVal = creditRate ?? debitRate ?? null;
      const isApproved = rateVal != null && Number(rateVal) > 0;

      return {
        countryId: c.id,
        countryName: c.name,
        currencyCode: code,
        rate: isApproved ? Number(rateVal) : null,
        creditRate: creditRate != null ? Number(creditRate) : null,
        debitRate: debitRate != null ? Number(debitRate) : null,
        rateDate: date,
        status: isApproved ? ("APPROVED" as const) : ("PENDING_MISSING" as const),
        statusLabel: isApproved ? "Approved" : "Rate Not Entered",
      };
    });
  }

  it("retrieves the exact approved rate for targetDate and matches PKR", () => {
    const list = buildActiveRatesList(countriesMaster, dailyExchangeRates, countriesStatus, targetDate, true, []);
    const pkr = list.find((it) => it.currencyCode === "PKR");
    expect(pkr).toBeDefined();
    expect(pkr?.rate).toBe(278.5);
    expect(pkr?.creditRate).toBe(278.5);
    expect(pkr?.debitRate).toBe(277.8);
    expect(pkr?.status).toBe("APPROVED");
    expect(pkr?.statusLabel).toBe("Approved");
    expect(pkr?.rateDate).toBe(targetDate);
  });

  it("does not silently substitute older rates for AFN on targetDate (displays Rate Not Entered)", () => {
    const list = buildActiveRatesList(countriesMaster, dailyExchangeRates, countriesStatus, targetDate, true, []);
    const afn = list.find((it) => it.currencyCode === "AFN");
    expect(afn).toBeDefined();
    expect(afn?.rate).toBeNull();
    expect(afn?.status).toBe("PENDING_MISSING");
    expect(afn?.statusLabel).toBe("Rate Not Entered");
  });

  it("USD always displays 1.0000 with Approved status", () => {
    const list = buildActiveRatesList(countriesMaster, dailyExchangeRates, countriesStatus, targetDate, true, []);
    const usd = list.find((it) => it.currencyCode === "USD");
    expect(usd).toBeDefined();
    expect(usd?.rate).toBe(1.0);
    expect(usd?.status).toBe("APPROVED");
  });

  it("restricts country visibility for Country Admin (Pakistan sees only PKR)", () => {
    const list = buildActiveRatesList(countriesMaster, dailyExchangeRates, countriesStatus, targetDate, false, ["pk-id"]);
    expect(list.length).toBe(1);
    expect(list[0].currencyCode).toBe("PKR");
  });

  it("preserves DR (buying) and CR (selling) rules for transaction conversion", () => {
    const pkrRates = { creditRate: 278.5, debitRate: 277.8 };
    // Debit cash entry uses debitRate
    expect(cashDirectionRate(pkrRates, "DEBIT")).toBe(277.8);
    // Credit cash entry uses creditRate
    expect(cashDirectionRate(pkrRates, "CREDIT")).toBe(278.5);

    // USD equivalent calculations
    const debitUsd = cashUsdEquivalent(27780, "PKR", 277.8);
    expect(debitUsd).toBe(100);

    const creditUsd = cashUsdEquivalent(27850, "PKR", 278.5);
    expect(creditUsd).toBe(100);
  });
});

