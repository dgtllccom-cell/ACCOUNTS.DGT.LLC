"use client";

import { apiGet } from "@/lib/api/client";

/** Active ERP language for a client-side fetch (localStorage → <html lang> → "en"). */
function activeLang(): string {
  if (typeof document === "undefined") return "en";
  const raw = (localStorage.getItem("erp_lang") || document.documentElement.lang || "en").trim();
  const base = raw.split("-")[0].toLowerCase();
  return ["en", "ur", "ar", "fa", "ps"].includes(base) ? base : "en";
}

export type GoodsVariationRow = {
  id: string;
  goods_id: string;
  origin_country_id: string | null;
  size: string;
  brand: string;
  is_active: boolean;
  created_at: string;
};

export type GoodsListRow = {
  id: string;
  chs_code: string;
  goods_name: string;
  original_language_code: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  total_origins: number;
  total_sizes: number;
  total_brands: number;
  variations: GoodsVariationRow[];
};

export async function listGoods(input: { countryId?: string; q?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.limit) params.set("limit", String(input.limit));
  params.set("lang", activeLang());
  return await apiGet<{ goods: GoodsListRow[]; limit: number }>(`/api/erp/goods?${params.toString()}`);
}

