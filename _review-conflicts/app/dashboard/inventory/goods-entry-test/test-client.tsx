"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GoodsEntryCard, type GoodsEntryValue } from "@/features/inventory/components/GoodsEntryCard";
import { listCountries } from "@/features/locations/location-api";

const DEFAULT: GoodsEntryValue = {
  countryId: "",
  goodsId: "",
  goodsName: "",
  productCode: "",
  hsCode: "",
  size: "",
  brand: "",
  originCountryId: "",
  imageUrl: "",
  unitType: "",

  qtyNo: 200,
  perQtyWeightKgs: 50,
  emptyQtyWeightKgs: 2.5,
  divideType: "KG",
  divideValue: 1,
  pricePerDivide: 0,
  currencyCode: "USD",
  exchangeRate: 1
};

export default function GoodsEntryTestClient({ session }: { session: any }) {
  const [countries, setCountries] = useState<Array<{ id: string; name: string; currency_code: string }>>([]);
  const [value, setValue] = useState<GoodsEntryValue>({ ...DEFAULT });

  useEffect(() => {
    listCountries()
      .then((res) => setCountries(res))
      .catch(() => null);
  }, []);

  useEffect(() => {
    // Prefer auto country scope when available.
    const scoped = session?.countryIds?.[0];
    if (scoped && !value.countryId) setValue((v) => ({ ...v, countryId: scoped }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.countryIds?.[0]]);

  const country = useMemo(() => countries.find((c) => c.id === value.countryId) ?? null, [countries, value.countryId]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-semibold">Goods Entry Test</div>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Country</span>
            <select
              value={value.countryId}
              onChange={(e) => setValue((v) => ({ ...v, countryId: e.target.value, goodsId: "" }))}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none"
            >
              <option value="">Select country</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <div className="text-[11px] text-muted-foreground">Local Currency</div>
            <div className="font-semibold">{country?.currency_code ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <div className="text-[11px] text-muted-foreground">Session</div>
            <div className="font-semibold">{session?.email ?? "-"}</div>
          </div>
        </div>
      </div>

      <GoodsEntryCard value={value} onChange={setValue} />
    </div>
  );
}
