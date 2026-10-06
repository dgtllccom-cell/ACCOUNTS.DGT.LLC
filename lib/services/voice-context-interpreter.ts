/**
 * Voice Context Interpreter
 *
 * Interprets voice transcriptions based on the current ERP form/module context.
 * Example: "Received AED 3,000 cash from Ahmed"
 * - On Purchase form → Extract supplier + amount + currency
 * - On Sales form → Extract customer + amount + currency
 * - On Roznamcha form → Extract party + amount + transaction type
 * - On Accounts form → Extract account/customer details
 *
 * Returns structured draft fields ready for form pre-fill.
 */

import type { SupportedLanguage } from "@/lib/i18n/languages";

export type VoiceContext =
  | "purchase"
  | "sales"
  | "accounts"
  | "roznamcha"
  | "expenses"
  | "customer"
  | "company"
  | "bank"
  | "employee"
  | "goods"
  | "loading"
  | "receiving"
  | "shipping"
  | "clearing"
  | "customer_orders"
  | "warehouses"
  | "temp_bills"
  | "document_intake"
  | "search";

/** Eastern-Arabic (٠-٩) + Persian (۰-۹) digits → ASCII, so amounts/dates parse
 *  regardless of the spoken language / keyboard. */
function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

/** "three thousand five hundred" → 3500 (English written numbers, best-effort). */
function parseWrittenNumber(text: string): number | null {
  const words: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  const scales: Record<string, number> = { hundred: 100, thousand: 1000, lakh: 100000, lac: 100000, million: 1000000, crore: 10000000 };
  const toks = text.toLowerCase().replace(/[,-]/g, " ").split(/\s+/).filter((t) => t in words || t in scales || t === "and");
  if (toks.length < 2) return null;
  let total = 0, current = 0;
  for (const t of toks) {
    if (t === "and") continue;
    if (t in words) current += words[t];
    else if (t in scales) {
      if (scales[t] >= 1000) { total += (current || 1) * scales[t]; current = 0; }
      else current *= scales[t];
    }
  }
  const n = total + current;
  return n > 0 ? n : null;
}

export interface VoiceInterpretationResult {
  context: VoiceContext;
  confidence: number;
  extractedFields: Record<string, string | number | null>;
  interpretedAction: string; // Strictly scoped: "create_account_draft", "account_form_guidance", etc.
  warnings: string[]; // Fields that need review
  originalTranscript: string;
  detectedLanguage?: SupportedLanguage;
  isGuidance?: boolean;
  guidanceTitle?: string;
  guidanceSteps?: string[];
  unmappedDetails?: string[];
}

// Pattern matchers for common business transactions
const AMOUNT_PATTERN = /(?:(?:aed|usd|pkr|afn|inr|sar|eur|gbp)\s+)?[\d,]+(?:\.\d{2})?/gi;
const CURRENCY_PATTERN = /\b(aed|usd|pkr|afn|inr|sar|eur|gbp|inr|jpy)\b/gi;
const PARTY_PATTERN = /(?:from|to|by|with|received from|paid to|sent to)\s+([A-Za-z][A-Za-z\s.]{2,50}?)(?:\s+aed|\s+usd|\s+pkr|$)/gi;
// Require an explicit "code/no/number/#" keyword AND a code-shaped token (at least
// one digit) so plain phrases like "new account Quetta Traders" are NOT mistaken
// for an account code.
const ACCOUNT_PATTERN = /(?:account|khaata|gl|ledger)\s+(?:code|no\.?|number|#)\s*:?\s*([A-Za-z0-9][A-Za-z0-9\-]{1,14})/gi;
const DATE_PATTERN = /\b(?:today|tomorrow|yesterday|(\d{1,2})[-/](\d{1,2})[-/](\d{2,4}))\b/gi;

export class VoiceContextInterpreter {
  /**
   * Interpret voice transcript based on current form context.
   * STRICT CONTEXT ISOLATION: A page-specific AI must never select an action,
   * schema, or module unrelated to the page currently open.
   */
  static interpret(
    transcript: string,
    context: VoiceContext,
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    const cleaned = normalizeDigits(transcript).toLowerCase().trim();
    const warnings: string[] = [];
    const fields: Record<string, string | number | null> = {};
    let confidence = 0.55;

    // Extract common fields
    let amounts = cleaned.match(AMOUNT_PATTERN) || [];
    if (amounts.length === 0) {
      const written = parseWrittenNumber(cleaned);
      if (written != null) amounts = [String(written)];
    }
    const currencies = cleaned.match(CURRENCY_PATTERN) || [];
    const parties = this.extractParties(cleaned);

    // Context-specific interpretation — STRICT ISOLATION
    switch (context) {
      case "purchase":
        return this.interpretPurchase(cleaned, fields, warnings, confidence, amounts, parties, currencies, language);

      case "sales":
        return this.interpretSales(cleaned, fields, warnings, confidence, amounts, parties, currencies, language);

      case "accounts":
        return this.interpretAccounts(cleaned, fields, warnings, confidence, parties, language);

      case "roznamcha":
        return this.interpretRoznamcha(cleaned, fields, warnings, confidence, amounts, parties, currencies, language);

      case "expenses":
        return this.interpretExpenses(cleaned, fields, warnings, confidence, amounts, parties, currencies, language);

      case "customer":
        return this.interpretPerson(cleaned, fields, warnings, confidence, parties, "customer", "create_customer_draft");

      case "company":
        return this.interpretCompany(cleaned, fields, warnings, confidence, parties, language);

      case "bank":
        return this.interpretBank(cleaned, fields, warnings, confidence, parties, language);

      case "employee":
        return this.interpretPerson(cleaned, fields, warnings, confidence, parties, "employee", "create_employee_draft");

      case "goods":
        return this.interpretGoods(cleaned, fields, warnings, confidence, language);

      case "loading":
      case "receiving":
        return this.interpretLogistics(cleaned, fields, warnings, confidence, parties, currencies, context);

      case "shipping":
      case "clearing":
        return this.interpretLogistics(cleaned, fields, warnings, confidence, parties, currencies, context);

      case "customer_orders":
        return this.interpretCustomerOrders(cleaned, fields, warnings, confidence, parties, language);

      case "warehouses":
        return this.interpretWarehouses(cleaned, fields, warnings, confidence, language);

      case "temp_bills":
        return this.interpretTempBills(cleaned, fields, warnings, confidence, amounts, parties, currencies, language);

      case "search":
        return this.interpretSearch(cleaned, fields, warnings, confidence);

      default:
        return {
          context,
          confidence: 0.3,
          extractedFields: { rawTranscript: transcript },
          interpretedAction: `${context}_entry_draft`,
          warnings: ["Under active form schema. Please review all fields."],
          originalTranscript: transcript,
          detectedLanguage: language,
        };
    }
  }

  private static interpretPurchase(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    amounts: readonly string[],
    parties: string[],
    currencies: readonly string[],
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    // Check for guidance question
    const isGuidance = /(?:how\s+(?:to|do\s+i)|kis\s+tarah|kaise\s+bana|طريقة|کیف|څنګه|help|guide)/i.test(cleaned);
    if (isGuidance) {
      return {
        context: "purchase",
        confidence: 0.9,
        extractedFields: fields,
        interpretedAction: "purchase_form_guidance",
        isGuidance: true,
        guidanceTitle: "Purchase Order & Bill Entry Guidance",
        guidanceSteps: [
          "Step 1: Select Supplier from registered business companies.",
          "Step 2: Enter Purchase Bill / Invoice Number and Date.",
          "Step 3: Add Items / Goods with Quantity, Rate, and Currency.",
          "Step 4: Verify Subtotal, Taxes, and Payment Terms.",
          "Step 5: Click Save / Post to record in Purchase Ledger and Roznamcha."
        ],
        warnings: [],
        originalTranscript: cleaned,
        detectedLanguage: language,
      };
    }

    if (parties.length > 0) {
      fields.supplierName = parties[0];
      confidence += 0.2;
    } else {
      warnings.push("No supplier name detected. Please specify supplier.");
    }
    if (amounts && amounts.length > 0) {
      fields.purchaseOrderTotal = this.parseAmount(amounts[0]);
      confidence += 0.2;
    } else {
      warnings.push("No purchase amount detected. Please specify amount.");
    }
    if (currencies && currencies.length > 0) {
      fields.purchaseCurrency = (currencies[0] || "usd").toUpperCase();
      confidence += 0.1;
    }

    if (cleaned.includes("order") || cleaned.includes("po") || cleaned.includes("purchase")) {
      fields.documentType = "purchase_order";
      confidence += 0.15;
    }

    return {
      context: "purchase",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "create_purchase_order_draft",
      warnings: confidence < 0.7 ? [...warnings, "Low confidence in purchase details. Please review."] : warnings,
      originalTranscript: cleaned,
      detectedLanguage: language,
    };
  }

  private static interpretSales(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    amounts: readonly string[],
    parties: string[],
    currencies: readonly string[],
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    const isGuidance = /(?:how\s+(?:to|do\s+i)|kis\s+tarah|kaise\s+bana|طريقة|کیف|څنګه|help|guide)/i.test(cleaned);
    if (isGuidance) {
      return {
        context: "sales",
        confidence: 0.9,
        extractedFields: fields,
        interpretedAction: "sales_form_guidance",
        isGuidance: true,
        guidanceTitle: "Sales Order & Invoicing Guidance",
        guidanceSteps: [
          "Step 1: Select Customer from customer master list.",
          "Step 2: Enter Order Number, Date, and Delivery destination.",
          "Step 3: Add Items with agreed Selling Rate and Currency.",
          "Step 4: Check Advances or Payment Terms.",
          "Step 5: Confirm and save sales order draft."
        ],
        warnings: [],
        originalTranscript: cleaned,
        detectedLanguage: language,
      };
    }

    if (parties.length > 0) {
      fields.customerName = parties[0];
      confidence += 0.2;
    } else {
      warnings.push("No customer name detected. Please specify customer.");
    }
    if (amounts && amounts.length > 0) {
      fields.salesOrderTotal = this.parseAmount(amounts[0]);
      confidence += 0.2;
    } else {
      warnings.push("No sales amount detected. Please specify amount.");
    }
    if (currencies && currencies.length > 0) {
      fields.currencyCode = (currencies[0] || "usd").toUpperCase();
      confidence += 0.1;
    }

    if (cleaned.includes("order") || cleaned.includes("so") || cleaned.includes("sales")) {
      fields.documentType = "sales_order";
      confidence += 0.15;
    }

    return {
      context: "sales",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "create_sales_order_draft",
      warnings: confidence < 0.7 ? [...warnings, "Low confidence in sales details. Please review."] : warnings,
      originalTranscript: cleaned,
      detectedLanguage: language,
    };
  }

  private static interpretAccounts(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    parties: string[],
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    // STRICT CONTEXT ISOLATION: In "accounts" context, NEVER EVER return a purchase/sales action!
    
    // Check if user is asking a guidance/instructional question:
    // e.g. "ki degree mein united branch mein ek achcha sa code banana hai kis tarah banaa"
    // "kis tarah banaa", "kaise banayein", "how to create code", "how do i setup an account"
    const isGuidance = /(?:how\s+(?:to|do\s+i|can\s+i)|kis\s+tarah|kaise\s+bana|kese\s+bana|طريقة|کیف|څنګه|guide|help|guidance|bataye|batao|banana\s+hai\s+kis\s+tarah)/i.test(cleaned);

    // Extract branch reference if spoken (e.g. "united branch mein", "branch: United", "dubai branch")
    const branchMatch = cleaned.match(/(?:in\s+|mein\s+|me\s+)?([a-zA-Z0-9\u0600-\u06FF]{2,30}(?:\s+[a-zA-Z0-9\u0600-\u06FF]{2,30})?)\s+(?:branch|shakha|shaakh)\b/i)
      || cleaned.match(/(?:branch|shakha|shaakh)\s*(?:named|called|mein|me|:)?\s*([a-zA-Z0-9\u0600-\u06FF\s]+)/i);
    if (branchMatch?.[1]) {
      let bName = branchMatch[1].trim();
      bName = bName.replace(/^(?:mein|me|in|ki|degree|ek|ye|yeh)\s+/i, "").trim();
      if (bName && !/^(the|a|this|in|is|of|mein|me|ek|achcha|sa)$/i.test(bName)) {
        fields.branchName = bName.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        confidence += 0.25;
      }
    }

    // Try to extract an explicit account code (must look like a code — has digits)
    const codeMatch = new RegExp(ACCOUNT_PATTERN.source, "i").exec(cleaned) || cleaned.match(/\b(?:code)\s*[:#]?\s*([A-Za-z0-9\-]{2,12})\b/i);
    if (codeMatch?.[1] && /\d/.test(codeMatch[1])) {
      fields.accountCode = codeMatch[1].toUpperCase();
      confidence += 0.25;
    }

    // Account name from context or spoken phrases
    if (parties.length > 0) {
      fields.accountName = parties[0];
      confidence += 0.2;
    }
    if (!fields.accountName) {
      const nameM = cleaned.match(
        /(?:new |open |create |add )?(?:account|khaata|khata)\s+(?:for\s+|named?\s+|titled?\s+|of\s+)?(?!code\b|number\b|no\.?\b|#)([a-z\u0600-\u06FF][a-z0-9\u0600-\u06FF .'&()\-\/]{2,60}?)(?=\s+(?:expense|income|revenue|asset|liability|capital|equity|bank|cash|receivable|payable|code|number|as an?|is an?|mein|branch)\b|[.,;]|$)/i,
      );
      if (nameM?.[1]) {
        const n = nameM[1].trim();
        if (!/^(is|an?|the|for|code|number|no|khaata|khata|account|ek|achcha|sa)$/i.test(n) && !/^\S*\d{3,}\S*$/.test(n)) {
          fields.accountName = n;
          confidence += 0.2;
        }
      }
    }

    // Detect account type / category from keywords
    const accountType = this.detectAccountType(cleaned);
    if (accountType) {
      fields.category = accountType;
      confidence += 0.15;
    }

    if (cleaned.includes("account") || cleaned.includes("khaata") || cleaned.includes("code")) {
      confidence += 0.15;
    }

    if (isGuidance) {
      const branchDisplay = fields.branchName ? `${fields.branchName} Branch` : "United Branch";
      return {
        context: "accounts",
        confidence: Math.max(confidence, 0.88),
        extractedFields: fields,
        interpretedAction: "account_form_guidance",
        isGuidance: true,
        guidanceTitle: "New Account Code & Setup Guidance",
        guidanceSteps: [
          `Step 1: Select Country and Branch (${branchDisplay}) from the top scope selector.`,
          "Step 2: Choose Account Category (e.g. Asset, Liability, Customer, Supplier, Expense, Revenue).",
          "Step 3: Enter your custom Account Code (e.g. 1001-XXXX) or leave blank for auto-generation according to branch hierarchy.",
          "Step 4: Type the Official Account Name and select the primary ledger currency (AED, USD, PKR).",
          "Step 5: Review all details and click 'Save Account' to register in the Chart of Accounts."
        ],
        warnings: [],
        originalTranscript: cleaned,
        detectedLanguage: language,
      };
    }

    return {
      context: "accounts",
      confidence: Math.min(1, confidence + 0.05),
      extractedFields: fields,
      interpretedAction: "create_account_draft",
      warnings: Object.keys(fields).length === 0 ? ["Account details pending. Please provide Account Name, Category, or Branch."] : warnings,
      originalTranscript: cleaned,
      detectedLanguage: language,
    };
  }

  private static interpretRoznamcha(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    amounts: readonly string[],
    parties: string[],
    currencies: readonly string[],
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    if (parties.length > 0) {
      fields.counterpartyName = parties[0];
      confidence += 0.2;
    }
    if (amounts && amounts.length > 0) {
      fields.finalAmount = this.parseAmount(amounts[0]);
      confidence += 0.2;
    }
    if (currencies && currencies.length > 0) {
      fields.originalCurrency = (currencies[0] || "aed").toUpperCase();
      confidence += 0.1;
    }

    // Transaction type detection
    const transactionType = this.detectTransactionType(cleaned);
    if (transactionType) {
      fields.transactionType = transactionType;
      confidence += 0.15;
    }

    return {
      context: "roznamcha",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "create_roznamcha_entry_draft",
      warnings: confidence < 0.7 ? [...warnings, "Please verify cash/bank details."] : warnings,
      originalTranscript: cleaned,
    };
  }

  private static interpretExpenses(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    amounts: readonly string[],
    parties: string[],
    currencies: readonly string[],
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    if (parties.length > 0) {
      fields.supplier = parties[0];
      confidence += 0.15;
    }
    if (amounts && amounts.length > 0) {
      fields.expenseAmount = this.parseAmount(amounts[0]);
      confidence += 0.2;
    }
    if (currencies && currencies.length > 0) {
      fields.currency = (currencies[0] || "aed").toUpperCase();
      confidence += 0.1;
    }
    // Free-text expense note — the spoken description, verbatim, for the reviewer to keep or trim.
    fields.details = cleaned;

    return {
      context: "expenses",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "create_expense_bill_draft",
      warnings: confidence < 0.65 ? [...warnings, "Please verify expense details."] : warnings,
      originalTranscript: cleaned,
    };
  }

  private static interpretCustomer(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    parties: string[],
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    if (parties.length > 0) {
      fields.customerName = parties[0];
      confidence += 0.25;
    }
    return {
      context: "customer",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "create_customer_draft",
      warnings: confidence < 0.6 ? [...warnings, "Please provide more details about the customer."] : warnings,
      originalTranscript: cleaned,
    };
  }

  private static interpretCompany(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    parties: string[],
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    if (parties.length > 0) {
      fields.companyName = parties[0];
      confidence += 0.25;
    }
    return {
      context: "company",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "create_company_draft",
      warnings: confidence < 0.6 ? [...warnings, "Please provide company details."] : warnings,
      originalTranscript: cleaned,
    };
  }

  private static interpretBank(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    parties: string[],
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    if (parties.length > 0) {
      fields.bankName = parties[0];
      confidence += 0.2;
    }
    return {
      context: "bank",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "create_bank_draft",
      warnings: confidence < 0.65 ? [...warnings, "Please provide bank account details."] : warnings,
      originalTranscript: cleaned,
    };
  }

  private static interpretGoods(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    // Goods / product master: pull a name and (if spoken) an HS / CHS code.
    const nameM =
      cleaned.match(/(?:goods?|item|product|material|commodity)\s+(?:name(?:d| is)?\s+)?([a-z][a-z0-9 .\-&()/]{2,60}?)(?=\s+(?:hs|chs|code|quantity|unit|price|category)\b|[.,;]|$)/i) ||
      cleaned.match(/\b(?:add|register|create|new)\s+([a-z][a-z0-9 .\-&()/]{2,60}?)(?=\s+(?:hs|chs|code|to goods|as goods)\b|[.,;]|$)/i);
    if (nameM?.[1]) { fields.goodsName = nameM[1].trim(); confidence += 0.2; }
    const codeM = cleaned.match(/\b(?:hs|chs|hs\s*code|tariff)\s*(?:code|no\.?|number)?\s*[:.\-]?\s*(\d{4}\.?\d{2}(?:\.?\d{2,4})?|\d{6,10})/i);
    if (codeM?.[1]) { fields.chsCode = codeM[1].replace(/\./g, ""); confidence += 0.15; }
    const missing: string[] = [];
    if (!fields.goodsName) missing.push("item name");
    if (!fields.chsCode) missing.push("HS / CHS code");
    return {
      context: "goods",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "search_or_create_goods_draft",
      warnings: missing.length ? [...warnings, `Please add the ${missing.join(" and ")} before saving.`] : warnings,
      originalTranscript: cleaned,
    };
  }

  private static interpretPerson(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    parties: string[],
    context: VoiceContext,
    action: string,
  ): VoiceInterpretationResult {
    const nameKey = context === "employee" ? "fullName" : "customerName";
    if (parties.length > 0) { fields[nameKey] = parties[0]; confidence += 0.25; }
    const phone = cleaned.match(/(?:\+?\d[\d\s-]{7,}\d)/)?.[0];
    if (phone) { fields.phone = phone.replace(/\s+/g, ""); confidence += 0.1; }
    const email = cleaned.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
    if (email) { fields.email = email; confidence += 0.1; }
    const nid = cleaned.match(/\b\d{5}[- ]?\d{7}[- ]?\d\b/)?.[0];
    if (nid) { fields.nationalId = nid.replace(/[- ]/g, ""); confidence += 0.1; }
    if (context === "employee") {
      const desig = cleaned.match(/(?:designation|as|role|post|works? as|joins? as)\s+(?:an?\s+)?(manager|accountant|cashier|driver|cook|cleaner|security|guard|worker|labou?rer|supervisor|clerk|assistant|officer|administrator|admin|engineer|operator|helper|receptionist|storekeeper|foreman)\b/i)?.[1];
      if (desig) { fields.designation = desig.charAt(0).toUpperCase() + desig.slice(1).toLowerCase(); confidence += 0.1; }
    }
    return {
      context,
      confidence: Math.min(1, confidence + 0.05),
      extractedFields: fields,
      interpretedAction: action,
      warnings: parties.length === 0 ? [...warnings, "No name detected — please state the person / entity name."] : warnings,
      originalTranscript: cleaned,
    };
  }

  private static interpretLogistics(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    parties: string[],
    currencies: readonly string[],
    context: VoiceContext,
  ): VoiceInterpretationResult {
    if (parties.length > 0) { fields.partyName = parties[0]; confidence += 0.15; }
    const container = cleaned.match(/\b[a-z]{4}\s?\d{7}\b/i)?.[0]?.toUpperCase().replace(/\s/g, "");
    if (container) { fields.containerNumbers = container; confidence += 0.2; }
    const bl = cleaned.match(/\b(?:b\/?l|bill of lading|awb)\s*(?:no\.?|number|#)?\s*[:.]?\s*([a-z0-9-]{4,20})/i)?.[1];
    if (bl) { fields.blNumber = bl.toUpperCase(); confidence += 0.15; }
    const vessel = cleaned.match(/(?:vessel|ship)\s+(?:name\s+)?([a-z][a-z0-9 .-]{2,30})/i)?.[1];
    if (vessel) { fields.vesselName = vessel.trim(); confidence += 0.1; }
    if (currencies.length > 0) fields.currencyCode = String(currencies[0]).toUpperCase();
    // loading / receiving quantity, e.g. "loading 850 bags" / "quantity 12000 kg"
    const qty = cleaned.match(/(?:quantity|qty|loading|received?|loaded)\s+(?:of\s+)?([\d٠-٩۰-۹][\d٠-٩۰-۹,]*)\s*(?:bags?|kg|kgs|tons?|mt|pcs|pieces|cartons?|units?)?/i)?.[1];
    if (qty) {
      const n = Number(normalizeDigits(qty).replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) { fields.quantity = n; confidence += 0.15; }
    }
    if (context === "receiving") {
      const truck = cleaned.match(/\btruck\s+(?:no\.?|number\s+)?([a-z]{2,4}[-\s]?\d{2,5}[a-z]?)\b/i)?.[1];
      if (truck) { fields.truckNo = truck.toUpperCase().replace(/\s/g, "-"); confidence += 0.15; }
      const driver = cleaned.match(/\bdriver\s+(?:name\s+)?([a-z][a-z .'-]{2,30}?)(?=\s+(?:truck|container|bl|quantity|qty)\b|[.,;]|$)/i)?.[1];
      if (driver) { fields.driverName = driver.trim(); confidence += 0.1; }
    }
    if (context === "clearing") {
      const gd = cleaned.match(/(?:gd|goods declaration|customs declaration|declaration|entry)\s*(?:no\.?|number|#)?\s*[:.]?\s*([a-z0-9][a-z0-9/\-]{3,25})/i)?.[1];
      if (gd) { fields.customsDeclarationNo = gd.toUpperCase(); confidence += 0.2; }
      const hs = cleaned.match(/\bhs\s*(?:code|no\.?)?\s*[:.]?\s*(\d{4}\.?\d{2}(?:\.?\d{2,4})?|\d{6,10})/i)?.[1];
      if (hs) { fields.hsCode = hs.replace(/\./g, ""); confidence += 0.15; }
      const station =
        // "at Karachi Port", "via Torkham Border", "Chaman dry port"
        cleaned.match(/\b(?:at|via|through|from)\s+([a-z][a-z .\-]{2,40}?)\s+(?:sea\s+)?(?:port|border|dry\s*port|customs)\b/i)?.[1]
        // "customs station: Karachi", "customs office Karachi", "port of Karachi"
        || cleaned.match(/(?:customs station|customs office|port of|border of|clearance at)\s*[:.]?\s*([a-z][a-z .\-]{2,40}?)(?=\s+(?:gd|hs|declaration|assessed|duty|customs)\b|[.,;]|$)/i)?.[1];
      if (station) { fields.customsStation = station.trim(); confidence += 0.1; }
      const assessed = cleaned.match(/(?:assessed value|customs value|value)\s*[:.]?\s*(?:[a-z]{3}\s*)?([\d٠-٩۰-۹][\d٠-٩۰-۹,]*(?:\.\d{1,2})?)/i)?.[1];
      if (assessed) {
        const n = Number(normalizeDigits(assessed).replace(/,/g, ""));
        if (Number.isFinite(n) && n > 0) { fields.assessedValue = n; confidence += 0.1; }
      }
    }
    return {
      context,
      confidence: Math.min(1, confidence + 0.05),
      extractedFields: fields,
      interpretedAction: `create_${context}_draft`,
      warnings: Object.keys(fields).length === 0 ? [...warnings, "Please state a container / BL / vessel reference."] : warnings,
      originalTranscript: cleaned,
    };
  }

  private static interpretCustomerOrders(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    parties: string[],
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    const isGuidance = /(?:how\s+(?:to|do\s+i)|kis\s+tarah|kaise\s+bana|طريقة|کیف|څنګه|help|guide)/i.test(cleaned);
    if (isGuidance) {
      return {
        context: "customer_orders",
        confidence: 0.9,
        extractedFields: fields,
        interpretedAction: "customer_orders_form_guidance",
        isGuidance: true,
        guidanceTitle: "Customer Order & Multi-leg Transit Guidance",
        guidanceSteps: [
          "Step 1: Select Customer from registered client list.",
          "Step 2: Choose Source country/port and Destination country/port.",
          "Step 3: Define Route Legs (Sea, Road, Border transit).",
          "Step 4: Specify Cargo details, weight, containers, and agreed freight rate.",
          "Step 5: Review tracking milestones and save Customer Order."
        ],
        warnings: [],
        originalTranscript: cleaned,
        detectedLanguage: language,
      };
    }

    if (parties.length > 0) {
      fields.customerName = parties[0];
      confidence += 0.2;
    }
    const orderNo = cleaned.match(/\b(?:order|co|booking)\s*[:#]?\s*([a-z0-9\-]{3,15})\b/i)?.[1];
    if (orderNo) {
      fields.orderNumber = orderNo.toUpperCase();
      confidence += 0.2;
    }
    const route = cleaned.match(/\bfrom\s+([a-z\s]+?)\s+to\s+([a-z\s]+)/i);
    if (route) {
      fields.origin = route[1].trim();
      fields.destination = route[2].trim();
      confidence += 0.2;
    }

    return {
      context: "customer_orders",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "create_customer_order_draft",
      warnings: Object.keys(fields).length === 0 ? ["Please specify Customer name, Order number, or Destination."] : warnings,
      originalTranscript: cleaned,
      detectedLanguage: language,
    };
  }

  private static interpretWarehouses(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    const nameMatch = cleaned.match(/(?:warehouse|godown|depot|storage)\s+(?:named?\s+|titled?\s+|called\s+)?([a-z0-9\s.\-]{3,40})/i);
    if (nameMatch) {
      fields.warehouseName = nameMatch[1].trim();
      confidence += 0.3;
    }
    return {
      context: "warehouses",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "create_warehouse_draft",
      warnings: !fields.warehouseName ? ["Please specify Warehouse Name or Location."] : warnings,
      originalTranscript: cleaned,
      detectedLanguage: language,
    };
  }

  private static interpretTempBills(
    cleaned: string,
    fields: Record<string, any>,
    warnings: string[],
    confidence: number,
    amounts: readonly string[],
    parties: string[],
    currencies: readonly string[],
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    if (parties.length > 0) {
      fields.partyName = parties[0];
      confidence += 0.25;
    }
    if (amounts.length > 0) {
      fields.billAmount = this.parseAmount(amounts[0]);
      confidence += 0.25;
    }
    if (currencies.length > 0) {
      fields.currency = currencies[0].toUpperCase();
      confidence += 0.1;
    }
    fields.details = cleaned;
    return {
      context: "temp_bills",
      confidence: Math.min(1, confidence + 0.1),
      extractedFields: fields,
      interpretedAction: "create_temp_bill_draft",
      warnings: !fields.partyName || !fields.billAmount ? ["Please specify Party name and Bill amount."] : warnings,
      originalTranscript: cleaned,
      detectedLanguage: language,
    };
  }

  private static interpretSearch(cleaned: string, fields: Record<string, any>, warnings: string[], confidence: number): VoiceInterpretationResult {
    fields.searchQuery = cleaned;
    return {
      context: "search",
      confidence: 0.8,
      extractedFields: fields,
      interpretedAction: "perform_search",
      warnings: [],
      originalTranscript: cleaned,
    };
  }

  private static extractParties(text: string): string[] {
    const matches = Array.from(text.matchAll(PARTY_PATTERN));
    const found = matches.map((m) => m[1]?.trim()).filter((p) => p && p.length > 2) as string[];
    // also: "new customer <name>", "register company <name>", "add employee <name>"
    const stop = "phone|mobile|email|cnic|nic|passport|address|account|number|name|for|with";
    const trig = text.match(
      new RegExp(`(?:new |add |register |create )?(?:customer|company|supplier|vendor|employee|person|firm|business|client)\\s+(?:name(?:d| is)?\\s+)?((?!(?:${stop})\\b)[a-z][a-z0-9 .'&()-]{2,50}?)(?=\\s+(?:${stop})\\b|[.,;]|$)`, "i"),
    );
    if (trig?.[1]) found.unshift(trig[1].trim());
    // "with <bank>" / "at <bank>" → bank name
    const bankM = text.match(/\b(?:with|at)\s+([a-z][a-z .'&-]{2,40}?\s+bank(?:\s+(?:ltd|limited|plc))?)\b/i)
      || text.match(/\bbank\s*(?:name)?\s*[:.]?\s*([a-z][a-z .'&-]{2,40})\b/i);
    if (bankM?.[1]) found.unshift(bankM[1].trim());
    return Array.from(new Set(found));
  }

  private static parseAmount(amountStr: string): number | null {
    const num = normalizeDigits(amountStr).replace(/[^0-9.]/g, "");
    const parsed = parseFloat(num);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return parseWrittenNumber(amountStr);
  }

  private static detectAccountType(text: string): string | null {
    // Ordered most-specific first — Asset is the fallback, so it is checked LAST
    // and its keywords must not include generic words like "account" (every
    // account-creation phrase contains it).
    const types: Array<[string, string[]]> = [
      ["Expense", ["expense", "expenses", "cost", "costs"]],
      ["Income", ["income", "revenue", "profit", "gain"]],
      ["Liability", ["liability", "payable", "loan", "debt", "creditor"]],
      ["Capital", ["capital", "equity", "owner"]],
      ["Asset", ["asset", "receivable", "debtor", "bank", "cash", "stock", "deposit"]],
    ];
    for (const [type, keywords] of types) {
      if (keywords.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(text))) return type;
    }
    return null;
  }

  private static detectTransactionType(text: string): string | null {
    // multilingual: received / وصول / ملیدل / دریافت / استلام   → debit (money in)
    //               paid / ادائیگی / ورکړل / پرداخت / دفع        → credit (money out)
    const receiveWords = ["received", "receive", "cash in", "وصول", "ملي", "دریافت", "استلام", "آمد", "جمع"];
    const payWords = ["paid", "pay", "cash out", "ادائیگی", "ورکړ", "پرداخت", "دفع", "خرچ"];
    if (receiveWords.some((w) => text.includes(w))) return "debit";
    if (payWords.some((w) => text.includes(w))) return "credit";
    if (text.includes("transfer") || text.includes("منتقلی") || text.includes("حواله")) return "transfer";
    return null;
  }
}
