export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      post_journal_entry: {
        Args: {
          target_journal_entry_id: string;
        };
        Returns: void;
      };
      create_company_workspace: {
        Args: {
          company_name: string;
          legal_name: string | null;
          base_currency: string;
          branch_name: string;
          branch_code: string;
          owner_full_name: string;
        };
        Returns: string;
      };
      create_account: {
        Args: {
          target_company_id: string;
          target_branch_id: string | null;
          parent_account_id: string | null;
          account_code: string;
          account_name: string;
          account_kind_value: "asset" | "liability" | "equity" | "income" | "expense";
          account_currency: string;
          is_control: boolean;
        };
        Returns: string;
      };
      create_country: {
        Args: {
          country_name: string;
          country_iso2: string;
          country_iso3: string;
          country_currency_code: string;
        };
        Returns: string;
      };
      create_country_main_branch: {
        Args: {
          target_country_id: string;
          branch_name: string;
          branch_code: string;
        };
        Returns: string;
      };
      create_city_branch: {
        Args: {
          target_country_id: string;
          target_country_branch_id: string;
          city_name: string;
          branch_name: string;
          branch_code: string;
          branch_currency: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
