"use client";

import { apiGet } from "@/lib/api/client";

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
  return await apiGet<{ goods: GoodsListRow[]; limit: number }>(`/api/erp/goods?${params.toString()}`);
}

