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

export type VoiceContext = "purchase" | "sales" | "accounts" | "roznamcha" | "expenses" | "customer" | "company" | "bank" | "goods" | "shipping" | "clearing" | "document_intake" | "search";

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
    const cleaned = transcript.toLowerCase().trim();
    const warnings: string[] = [];
    const fields: Record<string, string | number | null> = {};
    let confidence = 0.5;
    let interpretedAction = "";

    // Extract common fields that apply to all contexts
    const amounts = cleaned.match(AMOUNT_PATTERN) || [];
    const currencies = cleaned.match(CURRENCY_PATTERN) || [];
    const parties = this.extractParties(cleaned);

    if (amounts.length === 0) warnings.push("No amount detected. Please specify an amount.");
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
        return this.interpretCustomer(cleaned, fields, warnings, confidence, parties, language);

      case "company":
        return this.interpretCompany(cleaned, fields, warnings, confidence, parties, language);

      case "bank":
        return this.interpretBank(cleaned, fields, warnings, confidence, parties, language);

      case "goods":
        return this.interpretGoods(cleaned, fields, warnings, confidence, language);

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
    return matches.map((m) => m[1]?.trim()).filter((p) => p && p.length > 2) as string[];
  }

  private static parseAmount(amountStr: string): number | null {
    const num = amountStr.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(num);
    return Number.isFinite(parsed) ? parsed : null;
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
    if (text.includes("received") || text.includes("cash in")) return "debit";
    if (text.includes("paid") || text.includes("cash out")) return "credit";
    if (text.includes("transfer")) return "transfer";
    return null;
  }
}
