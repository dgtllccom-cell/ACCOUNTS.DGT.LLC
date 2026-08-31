export { buildTradeDocumentHtml, docTitleKeyFor } from "./build-trade-document";
export { openTradeDocument } from "./open-trade-document";
export {
  purchaseOrderToTradeInput,
  salesOrderToTradeInput,
  localPurchaseToTradeInput,
  type MapOptions,
} from "./from-transaction";
export type {
  TradeDocumentInput, TradeDocType, TradeTxnKind, TradeScope,
  TradeParty, TradeLineItem, BeneficiaryBank, TradeTransport,
} from "./types";
