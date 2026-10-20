# Business Purchase Order — five-field summary (Booked / Transferred / Endorsed / Returned / Remaining)

Status 2026-10-21: **analysis only — not built.** Everything below was read from the code and from DEV data; nothing is invented.

## What the ERP already defines (evidence)
| Field | Existing source | Evidence |
|---|---|---|
| **Booked** | Goods lines of the purchase order (`purchase_orders.form_data.goodsEntries[].qtyNo` / `total_goods_original` for value) | Purchase Booking wizard |
| **Transferred** | Goods moved on from the booking: `goods_transfers` (status `completed`, `in_transit`, `confirmed`), `journal_stock_transfers` (Stock Journal Goods Issue / Dispatch / Delivery), `stock_movements` of type `TRANSFER` | DEV: goods_transfers completed 92, in_transit 3, confirmed 1; stock_movements TRANSFER 25 |
| **Returned** | `goods_transfers.status = 'returned'` | DEV: 7 rows. No separate "return" movement type exists in `stock_movements` (types present: STOCK_IN 74, TRANSFER 25, STOCK_OUT 8) |
| **Endorsed** | In the Sales wizard "Endorse" is a SALE SOURCE: `lib/sales/available-lots.ts` reads `stock_movements` whose type contains "endors"; an endorse sale stores `endorseFulfillment { saleQty, purchasedQty, allocatedQty, outstandingQty, linkedLotNo }` | **No endorsement movement exists in DEV or Production today**, so the field would show 0 everywhere |
| **Remaining** | not defined anywhere | The owner's wording implies Booked − Transferred − Endorsed − Returned |

("Endorsement" as a PAYMENT term — the Endorsement payment page — is a different thing and posts as an advance.)

## The two decisions still needed from the owner
1. **Endorsed**: is it the quantity of this booking that was sold through the *Endorse* sale source (the only quantity meaning the ERP has), or a different business event? Today no such data exists.
2. **Returned vs Remaining**: when goods are returned, do they come back into Remaining (Remaining = Booked − (Transferred − Returned) − Endorsed) or are they subtracted as the wording suggests (Remaining = Booked − Transferred − Endorsed − Returned)?

Plus: a screenshot of the Booking screen where the five fields should appear.

Once these are answered the build is small: one read-only API `GET /api/erp/purchases/orders/[id]/quantity-summary` (country/branch scoped, no writes) and one summary strip on the Booking screen in five languages.
