import { describe, expect, it, vi } from "vitest";
import { loadingJournalRows, loadingJournalLinks, readBillLoadingJournal } from "@/lib/purchases/loading-journal";
describe("one bill, successive loading batches", () => {
  it("keeps later loading dates, BLs and containers separate under the original bill", () => {
    const rows = loadingJournalRows([
      { id: "b", loading_record_no: "LR-002", created_at: "2026-11-12", loaded_at: "2026-11-12", container_number: "C-2", bl_number: "BL-2", loaded_quantity: 200, loaded_purchase_local: 7340, local_currency: "AED" },
      { id: "a", loading_record_no: "LR-001", created_at: "2026-11-02", loaded_at: "2026-11-01", container_number: "C-1", bl_number: "BL-1", loaded_quantity: 200, loaded_purchase_local: 7340, local_currency: "AED" },
    ]);
    expect(rows.map(r => [r.id,r.sequence,r.loadingNo,r.loadedAt,r.blNumber])).toEqual([["a",1,"LR-001","2026-11-01","BL-1"],["b",2,"LR-002","2026-11-12","BL-2"]]);
    expect(rows.reduce((sum,r) => sum+r.quantity,0)).toBe(400);
    expect(rows.map(r => [r.currency,r.finalAmount])).toEqual([["AED",7340],["AED",7340]]);
  });
  it("keeps multiple containers in the same saved batch and gives later batches a separate sequence", () => {
    const rows=loadingJournalRows([{id:"a",loading_batch_id:"batch-1",loading_batch_no:"B-001",created_at:"2026-11-01"},{id:"b",loading_batch_id:"batch-1",loading_batch_no:"B-001",created_at:"2026-11-01"},{id:"c",loading_batch_id:"batch-2",loading_batch_no:"B-002",created_at:"2026-11-11"}]);
    expect(rows.map(r=>[r.id,r.sequence,r.batchNo])).toEqual([["a",1,"B-001"],["b",1,"B-001"],["c",2,"B-002"]]);
  });
  it("does not collapse two real load records that happen to share a container number", () => {
    expect(loadingJournalRows([{ id: "a", container_number: "SAME" },{ id: "b", container_number: "SAME" }])).toHaveLength(2);
    expect(loadingJournalRows([{ id: "a" }])[0].finalAmount).toBeNull();
  });
  it("links the same IDs to expenses and tracking without issuing a second transfer", () => {
    const links=loadingJournalLinks("lane-1","po-1");
    expect(new URL(links.expenses,"http://localhost").searchParams.get("purchaseOrderId")).toBe("po-1");
    expect(new URL(links.tracking,"http://localhost").searchParams.get("purchaseLaneId")).toBe("lane-1");
    expect(new URL(loadingJournalLinks("local-lane",null,"local-1").expenses,"http://localhost").searchParams.get("sourceId")).toBe("local-1");
  });
  it("reads loading records only inside the already authorized bill's country and branch", async () => {
    const sql=vi.fn(async () => []);
    await readBillLoadingJournal(sql,{source_table:"purchase_orders",source_id:"po",country_id:"pk",country_branch_id:"pk-main",city_branch_id:"chaman"});
    const call=sql.mock.calls[0] as any[];
    const text=call[0].join("?");
    expect(text).toContain("lr.purchase_order_id="); expect(text).toContain("lr.city_branch_id="); expect(text).toContain("lr.country_id is not distinct from");
    expect(text).not.toMatch(/\b(insert|update|delete|alter|create)\b/i);
    expect(call.slice(1)).toEqual(expect.arrayContaining(["po","pk","pk-main","chaman"]));
    sql.mockClear();
    expect(await readBillLoadingJournal(sql,{source_table:"sales_orders",source_id:"so",country_id:"pk",country_branch_id:null,city_branch_id:null})).toEqual([]);
    expect(sql).not.toHaveBeenCalled();
  });
});
