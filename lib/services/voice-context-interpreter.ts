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

export type VoiceContext = "purchase" | "sales" | "accounts" | "roznamcha" | "expenses" | "customer" | "company" | "bank" | "employee" | "goods" | "loading" | "receiving" | "shipping" | "clearing" | "document_intake" | "search";

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
  interpretedAction: string; // What will happen: "create_purchase", "create_account", etc.
  warnings: string[]; // Fields that need review
  originalTranscript: string;
}

// Pattern matchers for common business transactions
const AMOUNT_PATTERN = /(?:(?:aed|usd|pkr|afn|inr|sar|eur|gbp)\s+)?[\d,]+(?:\.\d{2})?/gi;
const CURRENCY_PATTERN = /\b(aed|usd|pkr|afn|inr|sar|eur|gbp|inr|jpy)\b/gi;
const PARTY_PATTERN = /(?:from|to|by|with|received from|paid to|sent to)\s+([A-Za-z][A-Za-z\s.]{2,50}?)(?:\s+aed|\s+usd|\s+pkr|$)/gi;
const ACCOUNT_PATTERN = /(?:account|khaata|gl|ledger)\s+(?:code|no|number)?\s*:?\s*([A-Z0-9\-]{2,15})/gi;
const DATE_PATTERN = /\b(?:today|tomorrow|yesterday|(\d{1,2})[-/](\d{1,2})[-/](\d{2,4}))\b/gi;

export class VoiceContextInterpreter {
  /**
   * Interpret voice transcript based on current form context.
   * Returns structured draft fields for the form to pre-fill.
   */
  static interpret(
    transcript: string,
    context: VoiceContext,
    language: SupportedLanguage,
  ): VoiceInterpretationResult {
    const cleaned = normalizeDigits(transcript).toLowerCase().trim();
    const warnings: string[] = [];
    const fields: Record<string, string | number | null> = {};
    let confidence = 0.5;
    let interpretedAction = "";

    // Extract common fields that apply to all contexts
    let amounts = cleaned.match(AMOUNT_PATTERN) || [];
    if (amounts.length === 0) {
      const written = parseWrittenNumber(cleaned);
      if (written != null) amounts = [String(written)];
    }
    const currencies = cleaned.match(CURRENCY_PATTERN) || [];
    const parties = this.extractParties(cleaned);

    if (amounts.length === 0 && !["search", "goods", "customer", "company", "bank", "employee"].includes(context)) {
      warnings.push("No amount detected. Please specify an amount.");
    }
    if (parties.length === 0 && !["search", "goods"].includes(context)) {
      warnings.push("No party/customer name detected. Please specify who or what you're referring to.");
    }

    // Context-specific interpretation
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

      case "search":
        return this.interpretSearch(cleaned, fields, warnings, confidence);

      default:
        return {
          context,
          confidence: 0.3,
          extractedFields: { rawTranscript: transcript },
          interpretedAction: "unknown",
          warnings: ["Could not interpret this voice input. Please review."],
          originalTranscript: transcript,
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
    if (parties.length > 0) {
      fields.supplierName = parties[0];
      confidence += 0.2;
    }
    if (amounts && amounts.length > 0) {
      fields.purchaseOrderTotal = this.parseAmount(amounts[0]);
      confidence += 0.2;
    }
    if (currencies && currencies.length > 0) {
      fields.purchaseCurrency = (currencies[0] || "usd").toUpperCase();
      confidence += 0.1;
    }

    // Purchase-specific keywords
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
    if (parties.length > 0) {
      fields.customerName = parties[0];
      confidence += 0.2;
    }
    if (amounts && amounts.length > 0) {
      fields.salesOrderTotal = this.parseAmount(amounts[0]);
      confidence += 0.2;
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
    // Try to extract account code
    const codeMatch = cleaned.match(ACCOUNT_PATTERN);
    if (codeMatch) {
      fields.accountCode = codeMatch[1] || codeMatch[0];
      confidence += 0.2;
    }

    // Account name from context
    if (parties.length > 0) {
      fields.accountName = parties[0];
      confidence += 0.2;
    }

    // Detect account type from keywords
    const accountType = this.detectAccountType(cleaned);
    if (accountType) {
      fields.category = accountType;
      confidence += 0.15;
    }

    if (cleaned.includes("account") || cleaned.includes("khaata")) {
      confidence += 0.1;
    }

    return {
      context: "accounts",
      confidence: Math.min(1, confidence + 0.05),
      extractedFields: fields,
      interpretedAction: "create_account_draft",
      warnings: confidence < 0.6 ? [...warnings, "Please verify account details."] : warnings,
      originalTranscript: cleaned,
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
    // Goods: look for item names, quantities, descriptions
    return {
      context: "goods",
      confidence: Math.min(1, confidence + 0.15),
      extractedFields: fields,
      interpretedAction: "search_or_create_goods_draft",
      warnings: ["Please specify item details (name, quantity, unit)."],
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
    return {
      context,
      confidence: Math.min(1, confidence + 0.05),
      extractedFields: fields,
      interpretedAction: `create_${context}_draft`,
      warnings: Object.keys(fields).length === 0 ? [...warnings, "Please state a container / BL / vessel reference."] : warnings,
      originalTranscript: cleaned,
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
    const types: Record<string, string[]> = {
      Asset: ["asset", "bank", "cash", "receivable", "account"],
      Liability: ["liability", "payable", "loan", "debt"],
      Expense: ["expense", "cost", "bill"],
      Income: ["income", "revenue", "sales"],
      Capital: ["capital", "equity"],
    };
    for (const [type, keywords] of Object.entries(types)) {
      if (keywords.some((kw) => text.includes(kw))) return type;
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
