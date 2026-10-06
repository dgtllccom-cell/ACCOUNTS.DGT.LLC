/**
 * Centralized Country to Currency mapping for the ERP system.
 * All modules must use this utility instead of hardcoding currency codes.
 * ISO-4217 currency codes are used throughout.
 */

export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // South Asia
  "Pakistan": "PKR",
  "Afghanistan": "AFN",
  "India": "INR",
  "Bangladesh": "BDT",
  "Sri Lanka": "LKR",
  "Nepal": "NPR",

  // Middle East / Gulf
  "United Arab Emirates": "AED",
  "UAE": "AED",
  "Dubai": "AED",
  "Saudi Arabia": "SAR",
  "Kuwait": "KWD",
  "Qatar": "QAR",
  "Bahrain": "BHD",
  "Oman": "OMR",
  "Iran": "IRR",
  "Iraq": "IQD",
  "Jordan": "JOD",

  // Central Asia
  "Kazakhstan": "KZT",
  "Uzbekistan": "UZS",
  "Turkmenistan": "TMT",
  "Kyrgyzstan": "KGS",
  "Tajikistan": "TJS",

  // East Asia
  "China": "CNY",
  "Japan": "JPY",
  "South Korea": "KRW",

  // Europe
  "United Kingdom": "GBP",
  "UK": "GBP",
  "Germany": "EUR",
  "France": "EUR",
  "Italy": "EUR",
  "Spain": "EUR",
  "Turkey": "TRY",
  "Russia": "RUB",

  // Americas
  "United States": "USD",
  "USA": "USD",
  "United States of America": "USD",
  "Canada": "CAD",

  // Africa
  "Egypt": "EGP",
  "South Africa": "ZAR",
  "Nigeria": "NGN",
  "Kenya": "KES",

  // Oceania
  "Australia": "AUD",
  "New Zealand": "NZD",
};

/**
 * Get the ISO-4217 currency code for a country name.
 * Falls back to `fallback` (default "USD") if not found.
 */
export function getCurrencyForCountry(countryName: string | null | undefined, fallback = "USD"): string {
  if (!countryName) return fallback;
  // Exact match first
  const exact = COUNTRY_CURRENCY_MAP[countryName];
  if (exact) return exact;
  // Case-insensitive match
  const lower = countryName.toLowerCase().trim();
  for (const [key, currency] of Object.entries(COUNTRY_CURRENCY_MAP)) {
    if (key.toLowerCase() === lower) return currency;
  }
  return fallback;
}

/**
 * Get a display currency symbol for a currency code.
 */
export function getCurrencySymbol(currencyCode: string | null | undefined): string {
  const code = (currencyCode ?? "USD").toUpperCase();
  const SYMBOLS: Record<string, string> = {
    USD: "$", PKR: "PKR", AED: "AED", AFN: "AFN", IRR: "IRR",
    SAR: "SAR", INR: "₹", EUR: "€", GBP: "£", CNY: "¥", TRY: "₺", RUB: "₽",
  };
  return SYMBOLS[code] ?? code;
}

/**
 * Format a monetary value with the currency code prefix.
 */
export function formatMoneyCurrency(
  amount: number,
  currencyCode: string | null | undefined,
  fractionDigits = 2
): string {
  const code = (currencyCode ?? "USD").toUpperCase();
  const n = Number.isFinite(amount) ? amount : 0;
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${code} ${formatted}`;
}

/**
 * Convert a local currency amount to USD using the daily selling rate.
 * selling_rate = local currency units per 1 USD (e.g. PKR/USD = 278).
 */
export function convertToUsd(localAmount: number, sellingRatePerUsd: number): number {
  const rate = Number.isFinite(sellingRatePerUsd) && sellingRatePerUsd > 0 ? sellingRatePerUsd : 1;
  return Math.round((localAmount / rate) * 10000) / 10000;
}

/**
 * Convert a USD amount to local currency.
 */
export function convertFromUsd(usdAmount: number, sellingRatePerUsd: number): number {
  const rate = Number.isFinite(sellingRatePerUsd) && sellingRatePerUsd > 0 ? sellingRatePerUsd : 1;
  return Math.round(usdAmount * rate * 100) / 100;
}

/** Determine if a currency is USD. */
export function isUsdCurrency(currencyCode: string | null | undefined): boolean {
  return (currencyCode ?? "").toUpperCase() === "USD";
}
