/**
 * CurrencyService
 * Centralized service for currency conversion, rate calculations, and global USD equivalents.
 */

export class CurrencyService {
  /**
   * Calculates the final local currency equivalent from a foreign currency purchase.
   * Requirement 7: Purchase Currency = Original, Exchange Rate = Country Rate, Final = Local Currency.
   *
   * @param purchaseAmount Original amount in the purchase currency.
   * @param exchangeRate Exchange rate to the local country currency.
   * @returns The final amount in the local currency.
   */
  static calculateFinalLocalAmount(purchaseAmount: number, exchangeRate: number): number {
    if (!purchaseAmount || !exchangeRate) return 0;
    return Number((purchaseAmount * exchangeRate).toFixed(4));
  }

  /**
   * Converts a local currency amount to the global USD equivalent for the Super Admin dashboard.
   *
   * @param localAmount Amount in local currency.
   * @param usdExchangeRate The local currency's exchange rate to USD.
   * @returns Equivalent amount in USD.
   */
  static convertToUSD(localAmount: number, usdExchangeRate: number): number {
    if (!localAmount || !usdExchangeRate || usdExchangeRate === 0) return 0;
    
    // Depending on whether the rate is stored as USD/Local or Local/USD
    // Assuming standard Rate means 1 USD = X Local Currency
    return Number((localAmount / usdExchangeRate).toFixed(4));
  }

  /**
   * Validates if a user is allowed to view a specific currency.
   * Requirement 6: UAE user sees only AED, Pakistan sees only PKR, etc.
   * 
   * @param userCountryIds The list of countries the user has access to.
   * @param recordCurrency The currency of the record being viewed.
   * @param countryCurrencyMap A map of Country ID to their Local Currency.
   */
  static canViewCurrency(isSuperAdmin: boolean, userCountryIds: string[], recordCurrency: string, countryCurrencyMap: Record<string, string>): boolean {
    if (isSuperAdmin) return true;

    // Check if the record's currency matches any of the user's assigned countries' currencies
    for (const countryId of userCountryIds) {
      if (countryCurrencyMap[countryId] === recordCurrency) {
        return true;
      }
    }
    
    return false;
  }
}
