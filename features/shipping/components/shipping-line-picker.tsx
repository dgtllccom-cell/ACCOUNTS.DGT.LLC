"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api/client";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { localizeTerm } from "@/lib/i18n/transliteration";

export type ShippingLineRow = {
  id: string;
  shipping_line_code: string | null;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  country_id: string | null;
  remarks: string | null;
  is_active: boolean;
};

function toOption(row: ShippingLineRow, lang: string): SearchSelectOption {
  const name = localizeTerm(row.name, lang);
  const label = row.shipping_line_code ? `${name} (${row.shipping_line_code})` : name;
  const keywords = [name, row.name, row.shipping_line_code, row.contact_person, row.email].filter(Boolean).join(" ");
  return { value: row.id, label, keywords };
}

export function ShippingLinePicker({
  label,
  value,
  onValueChange,
  disabled,
  placeholder
}: {
  label?: string;
  value: string;
  onValueChange: (shippingLineId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const lang = useActiveLanguage();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ShippingLineRow[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [newName, setNewName] = useState("");

  async function loadList() {
    setLoading(true);
    try {
      const res = await apiGet<{ shippingLines: ShippingLineRow[] }>(`/api/erp/shipping-lines?limit=200&lang=${encodeURIComponent(lang)}`);
      setRows(res.shippingLines ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const options = useMemo(() => rows.map((r) => toOption(r, lang)), [rows, lang]);

  async function createShippingLine(name: string) {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await apiPost<{ shippingLineId: string }>("/api/erp/shipping-lines", {
        name: name.trim(),
        originalLanguage: lang
      });
      await loadList();
      onValueChange(res.shippingLineId);
      setOpenCreate(false);
      setNewName("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SearchSelect
        label={label ?? t(lang, "shl.picker_label", "Shipping Line")}
        value={value}
        placeholder={placeholder ?? (loading ? t(lang, "common.loading", "Loading...") : t(lang, "shl.search_placeholder", "Search shipping line by name or code..."))}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        createLabel={t(lang, "shl.new_shipping_line", "+ New Shipping Line")}
        createButtonPlacement="both"
        onCreateWithSearch={createShippingLine}
        onCreateNew={async () => setOpenCreate(true)}
      />

      {openCreate ? (
        <SimpleModal
          title={t(lang, "shl.new_shipping_line", "+ New Shipping Line")}
          onClose={() => setOpenCreate(false)}
          className="w-[96vw] max-w-md rounded-2xl font-sans"
        >
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t(lang, "shl.name_label", "Shipping Line Name")} *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t(lang, "shl.name_placeholder", "e.g. Maersk Line")} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
                {t(lang, "common.cancel", "Cancel")}
              </Button>
              <Button type="button" disabled={!newName.trim() || loading} onClick={() => createShippingLine(newName)}>
                {t(lang, "common.save", "Save")}
              </Button>
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </>
  );
}
