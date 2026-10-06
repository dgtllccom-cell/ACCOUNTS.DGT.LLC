"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { apiGet } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type GoodsVariationRow = {
  id: string;
  goods_id: string;
  size: string | null;
  brand: string | null;
  variety: string | null;
  extra_details: string | null;
};

type GoodsRow = {
  id: string;
  chs_code: string;
  goods_name: string;
  origin_country_id: string | null;
  category: string | null;
  variety: string | null;
  extra_details: string | null;
  variations: GoodsVariationRow[];
};

export type GoodsPickerValue = {
  goodsId: string;
  goodsVariationId: string | null;
  goodsName: string;
  goodsChsCode: string;
  category: string | null;
  variety: string | null;
  extraDetails: string | null;
  originCountryId: string | null;
  brand: string | null;
  size: string | null;
  variationLabel: string | null;
};

function variationLabel(v: GoodsVariationRow) {
  return [v.size, v.brand, v.variety].filter(Boolean).join(" / ") || v.id;
}

/**
 * The one shared master-record picker for the Goods/Item master (`goods` +
 * `goods_variations`, `/api/erp/goods`) — every consumer of this API today
 * (purchase/sales/local-purchase wizards, the Shipping Customer Order form)
 * previously hand-rolled its own fetch + client-side filter. Reuse this
 * instead of adding another one.
 */
export function GoodsPicker({
  value,
  variationValue,
  onSelect,
  label,
  placeholder,
  disabled
}: {
  value: string;
  variationValue?: string | null;
  onSelect: (value: GoodsPickerValue) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const lang = useActiveLanguage();
  const [loading, setLoading] = useState(false);
  const [goods, setGoods] = useState<GoodsRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiGet<{ goods: GoodsRow[] }>(`/api/erp/goods?limit=250&lang=${encodeURIComponent(lang)}`);
        if (!cancelled) setGoods(Array.isArray(res.goods) ? res.goods : []);
      } catch {
        if (!cancelled) setGoods([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const options = useMemo<SearchSelectOption[]>(
    () =>
      goods.map((g) => ({
        value: g.id,
        label: g.goods_name,
        keywords: [g.chs_code, g.category, g.variety, ...(g.variations ?? []).flatMap((v) => [v.size, v.brand, v.variety])]
          .filter(Boolean)
          .join(" "),
        primaryText: g.goods_name,
        secondaryText: [g.category, g.variety].filter(Boolean).join(" • ") || undefined,
        code: g.chs_code
      })),
    [goods]
  );

  const selectedGoods = useMemo(() => goods.find((g) => g.id === value) || null, [goods, value]);
  const variations = selectedGoods?.variations ?? [];

  function selectGoods(goodsId: string) {
    const row = goods.find((g) => g.id === goodsId);
    if (!row) return;
    const singleVariation = row.variations?.length === 1 ? row.variations[0] : null;
    onSelect({
      goodsId: row.id,
      goodsVariationId: singleVariation?.id ?? null,
      goodsName: row.goods_name,
      goodsChsCode: row.chs_code,
      category: row.category,
      variety: row.variety,
      extraDetails: row.extra_details,
      originCountryId: row.origin_country_id,
      brand: singleVariation?.brand ?? null,
      size: singleVariation?.size ?? null,
      variationLabel: singleVariation ? variationLabel(singleVariation) : null
    });
  }

  function selectVariation(variationId: string) {
    if (!selectedGoods) return;
    const v = selectedGoods.variations.find((item) => item.id === variationId);
    onSelect({
      goodsId: selectedGoods.id,
      goodsVariationId: v?.id ?? null,
      goodsName: selectedGoods.goods_name,
      goodsChsCode: selectedGoods.chs_code,
      category: selectedGoods.category,
      variety: selectedGoods.variety,
      extraDetails: selectedGoods.extra_details,
      originCountryId: selectedGoods.origin_country_id,
      brand: v?.brand ?? null,
      size: v?.size ?? null,
      variationLabel: v ? variationLabel(v) : null
    });
  }

  return (
    <div className="space-y-2">
      <SearchSelect
        label={label ?? t(lang, "gm.goods", "Goods")}
        value={value}
        placeholder={placeholder ?? (loading ? t(lang, "common.loading", "Loading...") : t(lang, "gm.search_goods", "Search goods by name, CHS code, brand or size..."))}
        disabled={disabled || loading}
        options={options}
        richList
        onValueChange={selectGoods}
      />
      {variations.length > 1 && (
        <div className="space-y-1">
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
            {t(lang, "gm.variation", "Variation")}
          </label>
          <select
            value={variationValue ?? ""}
            disabled={disabled}
            onChange={(e) => selectVariation(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-250 bg-white px-3 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
          >
            <option value="">{t(lang, "gm.select_variation", "Select variation")}</option>
            {variations.map((v) => (
              <option key={v.id} value={v.id}>
                {variationLabel(v)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
