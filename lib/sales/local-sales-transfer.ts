import type { Sql } from "postgres";
import { ApiClientError } from "@/lib/api/response";

type LocalLotDeduction = {
  lotId: string | null; lotNo: string; qty: number; now: string;
  countryId: string | null; countryBranchId: string | null; cityBranchId: string | null;
};

/** Called inside the transfer transaction; any wrong/missing/insufficient lot rolls back the accounting as well. */
export async function deductLegacyLocalSaleLot(sql: Sql, line: LocalLotDeduction) {
  const shortId = /^LP-([0-9a-f]{8})$/i.exec(line.lotNo)?.[1];
  const reject = () => new ApiClientError("The local stock lot is missing, ambiguous or has insufficient stock.", {
    status: 409, code: "LOCAL_SALES_STOCK_UNAVAILABLE",
  });
  if (!(line.qty > 0) || !Number.isFinite(line.qty) || (!line.lotId && !line.lotNo)
    || (!line.countryId && !line.countryBranchId && !line.cityBranchId)) throw reject();
  const candidates = await sql`
    select lp.id from public.local_purchases lp
    where lp.deleted_at is null
      and coalesce(lp.status, '') not in ('sold', 'consumed', 'cancelled')
      and (${line.lotId ? sql`lp.id = ${line.lotId}::uuid` : sql`(lp.lot_no = ${line.lotNo} or ${shortId ? sql`lp.id::text like ${shortId.toLowerCase() + "%"}` : sql`false`})`})
      and (${line.countryId ? sql`lp.country_id = ${line.countryId}::uuid` : sql`true`})
      and (${line.countryBranchId ? sql`lp.country_branch_id = ${line.countryBranchId}::uuid` : sql`true`})
      and (${line.cityBranchId ? sql`lp.city_branch_id = ${line.cityBranchId}::uuid` : sql`true`})
      and not exists (select 1 from public.purchase_lots pl where pl.local_purchase_id = lp.id)
    order by lp.id limit 2 for update
  `;
  if (candidates.length !== 1) throw reject();
  const updated = await sql`
    update public.local_purchases
    set numbers = numbers - ${line.qty},
        status = case when numbers = ${line.qty} then 'sold' else status end,
        updated_at = ${line.now}
    where id = ${candidates[0].id}::uuid and numbers >= ${line.qty}
    returning id
  `;
  if (updated.length !== 1) throw reject();
  return String(updated[0].id);
}
