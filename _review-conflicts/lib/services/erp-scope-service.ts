import { getCurrentErpSession, requireErpSession, type ErpSession } from "@/lib/auth/session";

/**
 * ErpScopeService
 * Centralized service to determine data visibility rules based on the user's role and assigned scopes.
 */
export class ErpScopeService {
  /**
   * Generates a database query filter object based on the user's session.
   * If the user is a Super Admin, they see everything.
   * If they are a Country/Branch admin, they only see records matching their assigned scopes.
   *
   * Example usage with Drizzle ORM:
   * const scope = await ErpScopeService.getDrizzleScopeFilter();
   * const records = await db.select().from(table).where(scope ? inArray(table.countryId, scope.countryIds) : undefined);
   */
  static async getScopeFilters() {
    const session = await requireErpSession();

    if (session.isSuperAdmin) {
      return {
        isSuperAdmin: true,
        countryIds: [],
        branchIds: [],
        cityBranchIds: []
      };
    }

    return {
      isSuperAdmin: false,
      countryIds: session.countryIds,
      branchIds: session.countryBranchIds,
      cityBranchIds: session.cityBranchIds
    };
  }

  /**
   * Helper to ensure an action is permitted within the user's scope.
   */
  static async validateActionScope(targetCountryId: string | null, targetBranchId: string | null) {
    const session = await requireErpSession();
    
    if (session.isSuperAdmin) return true;

    if (targetCountryId && !session.countryIds.includes(targetCountryId)) {
      throw new Error(`Action denied: Out of country scope.`);
    }

    if (targetBranchId && !session.countryBranchIds.includes(targetBranchId) && !session.cityBranchIds.includes(targetBranchId)) {
      throw new Error(`Action denied: Out of branch scope.`);
    }

    return true;
  }
}
