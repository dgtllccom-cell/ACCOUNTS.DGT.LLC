"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { getCountryContactRules, upsertCountryContactRules, type ContactTypeKey } from "@/features/contact-types/contact-type-api";

type RuleEditRow = {
  key: ContactTypeKey;
  callingCode: string;
  prefix: string;
  formatMask: string;
  example: string;
  isActive: boolean;
};

function toCountryOption(c: LocationCountry): SearchSelectOption {
  return { value: c.id, label: c.name, keywords: `${c.name} ${c.currency_code ?? ""}` };
}

export function ContactTypeManagement() {
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countryId, setCountryId] = useState("");

  const [rows, setRows] = useState<RuleEditRow[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCountries(true);
      try {
        const list = await listCountries();
        if (!cancelled) setCountries(list);
      } finally {
        if (!cancelled) setLoadingCountries(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!countryId) {
      setRows([]);
      return;
    }

    (async () => {
      setLoadingRules(true);
      setBanner(null);
      try {
        const res = await getCountryContactRules(countryId);
        if (cancelled) return;

        const byKey = new Map<ContactTypeKey, any>();
        for (const r of res.rules ?? []) byKey.set(r.contactTypeKey, r);

        const defaults: ContactTypeKey[] = ["mobile", "phone", "whatsapp", "fax", "extension"];
        setRows(
          defaults.map((key) => {
            const existing = byKey.get(key);
            return {
              key,
              callingCode: existing?.callingCode ?? "",
              prefix: existing?.prefix ?? "",
              formatMask: existing?.formatMask ?? "",
              example: existing?.example ?? "",
              isActive: existing?.isActive ?? true
            };
          })
        );
      } catch (e: any) {
        if (!cancelled) setBanner({ tone: "err", text: e?.message || "Failed to load contact type rules" });
      } finally {
        if (!cancelled) setLoadingRules(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countryId]);

  const countryOptions = useMemo(() => countries.map(toCountryOption), [countries]);

  async function save() {
    setBanner(null);
    if (!countryId) return;

    const invalid = rows.find((r) => r.key !== "extension" && !/^[+][0-9]{1,6}$/.test(r.callingCode.trim()));
    if (invalid) {
      setBanner({ tone: "err", text: `Invalid calling code for ${invalid.key}. Use format like +92.` });
      return;
    }

    setSaving(true);
    try {
      await upsertCountryContactRules({
        countryId,
        rules: rows
          .filter((r) => r.key !== "extension") // extension doesn't use calling code
          .map((r) => ({
            contactTypeKey: r.key,
            callingCode: r.callingCode.trim(),
            prefix: r.prefix.trim() || null,
            formatMask: r.formatMask.trim() || null,
            example: r.example.trim() || null,
            isActive: r.isActive
          }))
      });
      setBanner({ tone: "ok", text: "Contact Type rules saved." });
    } catch (e: any) {
      setBanner({ tone: "err", text: e?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings / Management</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Contact Type</h1>
        <p className="text-sm text-muted-foreground">
          Centralized country calling codes for Mobile/Phone/WhatsApp/Fax. These codes are reused across ERP forms.
        </p>
      </div>

      {banner ? (
        <div
          className={
            banner.tone === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
              : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Country Calling Codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchSelect
            label="Country"
            value={countryId}
            placeholder={loadingCountries ? "Loading..." : "Select country"}
            options={countryOptions}
            disabled={loadingCountries}
            onValueChange={setCountryId}
          />

          {loadingRules ? (
            <p className="text-sm text-muted-foreground">Loading rules...</p>
          ) : countryId ? (
            <div className="space-y-3">
              {rows
                .filter((r) => r.key !== "extension")
                .map((row) => (
                  <div key={row.key} className="grid gap-3 rounded-lg border bg-muted/10 p-3 md:grid-cols-4 md:items-end">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Input value={row.key} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Calling Code</Label>
                      <Input
                        value={row.callingCode}
                        onChange={(e) =>
                          setRows((cur) => cur.map((r) => (r.key === row.key ? { ...r, callingCode: e.target.value } : r)))
                        }
                        placeholder="+92"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Format Mask (optional)</Label>
                      <Input
                        value={row.formatMask}
                        onChange={(e) =>
                          setRows((cur) => cur.map((r) => (r.key === row.key ? { ...r, formatMask: e.target.value } : r)))
                        }
                        placeholder="e.g. 300 1234567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Example (optional)</Label>
                      <Input
                        value={row.example}
                        onChange={(e) =>
                          setRows((cur) => cur.map((r) => (r.key === row.key ? { ...r, example: e.target.value } : r)))
                        }
                        placeholder="+923001234567"
                      />
                    </div>
                  </div>
                ))}

              <div className="flex justify-end">
                <Button type="button" onClick={save} disabled={saving}>
                  <Save className="h-4 w-4" aria-hidden />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a country to edit calling codes.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

