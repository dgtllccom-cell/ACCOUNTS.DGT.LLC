export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _applied_schema_migrations: {
        Row: {
          applied_at: string | null
          filename: string
          id: number
        }
        Insert: {
          applied_at?: string | null
          filename: string
          id?: number
        }
        Update: {
          applied_at?: string | null
          filename?: string
          id?: number
        }
        Relationships: []
      }
      account_groups: {
        Row: {
          account_kind: Database["public"]["Enums"]["account_kind"]
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          is_system: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_kind: Database["public"]["Enums"]["account_kind"]
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_system?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_kind?: Database["public"]["Enums"]["account_kind"]
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_system?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      account_types: {
        Row: {
          account_group_id: string | null
          account_kind: Database["public"]["Enums"]["account_kind"]
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_group_id?: string | null
          account_kind: Database["public"]["Enums"]["account_kind"]
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_group_id?: string | null
          account_kind?: Database["public"]["Enums"]["account_kind"]
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_types_account_group_id_fkey"
            columns: ["account_group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          branch_id: string | null
          code: string
          company_id: string
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          is_control_account: boolean
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          parent_id: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          company_id: string
          created_at?: string
          currency: string
          deleted_at?: string | null
          id?: string
          is_control_account?: boolean
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          is_control_account?: boolean
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_request_items: {
        Row: {
          after_value: Json | null
          approval_request_id: string
          before_value: Json | null
          created_at: string
          field_name: string | null
          id: string
        }
        Insert: {
          after_value?: Json | null
          approval_request_id: string
          before_value?: Json | null
          created_at?: string
          field_name?: string | null
          id?: string
        }
        Update: {
          after_value?: Json | null
          approval_request_id?: string
          before_value?: Json | null
          created_at?: string
          field_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_items_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          action: Database["public"]["Enums"]["approval_action_type"]
          after_data: Json | null
          approved_by: string | null
          before_data: Json | null
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          decided_at: string | null
          deleted_at: string | null
          id: string
          reason: string | null
          rejected_by: string | null
          rejection_reason: string | null
          request_no: string
          requested_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          target_id: string
          target_table: string
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_action_type"]
          after_data?: Json | null
          approved_by?: string | null
          before_data?: Json | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          decided_at?: string | null
          deleted_at?: string | null
          id?: string
          reason?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_no: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          target_id: string
          target_table: string
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_action_type"]
          after_data?: Json | null
          approved_by?: string | null
          before_data?: Json | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          decided_at?: string | null
          deleted_at?: string | null
          id?: string
          reason?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_no?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          target_id?: string
          target_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "approval_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_status_history: {
        Row: {
          actor_id: string | null
          approval_request_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["approval_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          actor_id?: string | null
          approval_request_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["approval_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          actor_id?: string | null
          approval_request_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["approval_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_status_history_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      areas_locations: {
        Row: {
          city_id: string
          code: string | null
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          district_id: string | null
          id: string
          is_active: boolean
          name: string
          phone_area_code: string | null
          postal_code: string | null
          state_province_id: string | null
          updated_at: string
        }
        Insert: {
          city_id: string
          code?: string | null
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone_area_code?: string | null
          postal_code?: string | null
          state_province_id?: string | null
          updated_at?: string
        }
        Update: {
          city_id?: string
          code?: string | null
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone_area_code?: string | null
          postal_code?: string | null
          state_province_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_locations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_locations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_locations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "areas_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_locations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_locations_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          branch_id: string | null
          bucket: string
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          mime_type: string | null
          owner_id: string
          owner_table: string
          path: string
          size_bytes: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          branch_id?: string | null
          bucket: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mime_type?: string | null
          owner_id: string
          owner_table: string
          path: string
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          branch_id?: string | null
          bucket?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mime_type?: string | null
          owner_id?: string
          owner_table?: string
          path?: string
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_table: string
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          account_number: string
          account_status: string
          account_title: string
          account_type: string
          bank_name: string
          bank_type: string
          branch_code: string
          branch_code_type: string
          branch_name: string
          branch_serial: string | null
          city_id: string | null
          country_id: string | null
          country_serial: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          district_id: string | null
          email: string | null
          entry_serial: string | null
          full_address: string | null
          iban_number: string | null
          id: string
          is_active: boolean
          phone: string | null
          remarks: string | null
          short_name: string
          state_province_id: string | null
          super_admin_serial: string | null
          swift_bic: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_number: string
          account_status?: string
          account_title: string
          account_type: string
          bank_name: string
          bank_type: string
          branch_code: string
          branch_code_type: string
          branch_name: string
          branch_serial?: string | null
          city_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          district_id?: string | null
          email?: string | null
          entry_serial?: string | null
          full_address?: string | null
          iban_number?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          remarks?: string | null
          short_name: string
          state_province_id?: string | null
          super_admin_serial?: string | null
          swift_bic?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_number?: string
          account_status?: string
          account_title?: string
          account_type?: string
          bank_name?: string
          bank_type?: string
          branch_code?: string
          branch_code_type?: string
          branch_name?: string
          branch_serial?: string | null
          city_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          district_id?: string | null
          email?: string | null
          entry_serial?: string | null
          full_address?: string | null
          iban_number?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          remarks?: string | null
          short_name?: string
          state_province_id?: string | null
          super_admin_serial?: string | null
          swift_bic?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banks_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banks_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banks_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "banks_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banks_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          city_id: string | null
          code: string
          company_id: string
          contacts: Json
          country_id: string | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          district_id: string | null
          documents: Json
          email: string | null
          id: string
          is_active: boolean
          is_super_admin: boolean
          name: string
          owner_name: string | null
          phone: string | null
          state_province_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          code: string
          company_id: string
          contacts?: Json
          country_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          district_id?: string | null
          documents?: Json
          email?: string | null
          id?: string
          is_active?: boolean
          is_super_admin?: boolean
          name: string
          owner_name?: string | null
          phone?: string | null
          state_province_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city_id?: string | null
          code?: string
          company_id?: string
          contacts?: Json
          country_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          district_id?: string | null
          documents?: Json
          email?: string | null
          id?: string
          is_active?: boolean
          is_super_admin?: boolean
          name?: string
          owner_name?: string | null
          phone?: string | null
          state_province_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "branches_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          code: string | null
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          district_id: string | null
          id: string
          is_active: boolean
          name: string
          phone_area_code: string | null
          state_province_id: string | null
          updated_at: string
          updated_by: string | null
          zip_code: string | null
        }
        Insert: {
          code?: string | null
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone_area_code?: string | null
          state_province_id?: string | null
          updated_at?: string
          updated_by?: string | null
          zip_code?: string | null
        }
        Update: {
          code?: string | null
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone_area_code?: string | null
          state_province_id?: string | null
          updated_at?: string
          updated_by?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "cities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      city_branches: {
        Row: {
          address: string | null
          area_location_id: string | null
          branding_address: string | null
          branding_company_name: string | null
          branding_email: string | null
          branding_letterhead_url: string | null
          branding_logo_url: string | null
          branding_phone: string | null
          branding_report_footer: string | null
          branding_report_header: string | null
          branding_stamp_url: string | null
          city_id: string | null
          city_name: string
          code: string
          company_id: string | null
          contacts: Json
          country_branch_id: string
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          district_id: string | null
          documents: Json
          email: string
          id: string
          local_currency: string
          name: string
          owner_name: string | null
          permission_grants: Json
          permission_template: string | null
          phone: string | null
          state_province_id: string | null
          status: Database["public"]["Enums"]["branch_status"]
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          area_location_id?: string | null
          branding_address?: string | null
          branding_company_name?: string | null
          branding_email?: string | null
          branding_letterhead_url?: string | null
          branding_logo_url?: string | null
          branding_phone?: string | null
          branding_report_footer?: string | null
          branding_report_header?: string | null
          branding_stamp_url?: string | null
          city_id?: string | null
          city_name: string
          code: string
          company_id?: string | null
          contacts?: Json
          country_branch_id: string
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          documents?: Json
          email: string
          id?: string
          local_currency: string
          name: string
          owner_name?: string | null
          permission_grants?: Json
          permission_template?: string | null
          phone?: string | null
          state_province_id?: string | null
          status?: Database["public"]["Enums"]["branch_status"]
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          area_location_id?: string | null
          branding_address?: string | null
          branding_company_name?: string | null
          branding_email?: string | null
          branding_letterhead_url?: string | null
          branding_logo_url?: string | null
          branding_phone?: string | null
          branding_report_footer?: string | null
          branding_report_header?: string | null
          branding_stamp_url?: string | null
          city_id?: string | null
          city_name?: string
          code?: string
          company_id?: string | null
          contacts?: Json
          country_branch_id?: string
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          documents?: Json
          email?: string
          id?: string
          local_currency?: string
          name?: string
          owner_name?: string | null
          permission_grants?: Json
          permission_template?: string | null
          phone?: string | null
          state_province_id?: string | null
          status?: Database["public"]["Enums"]["branch_status"]
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_branches_area_location_id_fkey"
            columns: ["area_location_id"]
            isOneToOne: false
            referencedRelation: "areas_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_branches_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_branches_country_fk"
            columns: ["country_branch_id", "country_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id", "country_id"]
          },
          {
            foreignKeyName: "city_branches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_branches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "city_branches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_branches_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_branches_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      clearing_agent_branches: {
        Row: {
          branch_level: string
          city_branch_id: string | null
          clearing_agent_id: string
          code: string
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          parent_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_level: string
          city_branch_id?: string | null
          clearing_agent_id: string
          code: string
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_level?: string
          city_branch_id?: string | null
          clearing_agent_id?: string
          code?: string
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clearing_agent_branches_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearing_agent_branches_clearing_agent_id_fkey"
            columns: ["clearing_agent_id"]
            isOneToOne: false
            referencedRelation: "clearing_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearing_agent_branches_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearing_agent_branches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearing_agent_branches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "clearing_agent_branches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearing_agent_branches_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "clearing_agent_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      clearing_agents: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          head_office_country_id: string | null
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          head_office_country_id?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          head_office_country_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clearing_agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearing_agents_head_office_country_id_fkey"
            columns: ["head_office_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearing_agents_head_office_country_id_fkey"
            columns: ["head_office_country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      communication_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          message_id: string | null
          mime_type: string | null
          storage_url: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          storage_url: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          storage_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_audit_logs: {
        Row: {
          action: string
          ai_text: string | null
          city_branch_id: string | null
          conversation_id: string | null
          country_id: string | null
          created_at: string | null
          delivery_result: string | null
          edited_text: string | null
          id: string
          message_id: string | null
          original_text: string | null
          reply_mode: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          ai_text?: string | null
          city_branch_id?: string | null
          conversation_id?: string | null
          country_id?: string | null
          created_at?: string | null
          delivery_result?: string | null
          edited_text?: string | null
          id?: string
          message_id?: string | null
          original_text?: string | null
          reply_mode?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          ai_text?: string | null
          city_branch_id?: string | null
          conversation_id?: string | null
          country_id?: string | null
          created_at?: string | null
          delivery_result?: string | null
          edited_text?: string | null
          id?: string
          message_id?: string | null
          original_text?: string | null
          reply_mode?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_audit_logs_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_audit_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "communication_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_audit_logs_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_audit_logs_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "communication_audit_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_center_campaigns: {
        Row: {
          body: string | null
          channel: string
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          scheduled_at: string | null
          segment_name: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          channel: string
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          scheduled_at?: string | null
          segment_name?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          channel?: string
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
          segment_name?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_center_campaigns_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_campaigns_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_campaigns_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_campaigns_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "communication_center_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_center_followups: {
        Row: {
          assigned_to: string | null
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_at: string | null
          followup_type: string
          id: string
          lead_id: string | null
          notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_at?: string | null
          followup_type?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_at?: string | null
          followup_type?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_center_followups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_followups_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_followups_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_followups_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_followups_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "communication_center_followups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "communication_center_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_center_leads: {
        Row: {
          assigned_to: string | null
          city_branch_id: string | null
          company_name: string | null
          contact_person: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          lead_name: string
          next_follow_up_at: string | null
          notes: string | null
          phone: string | null
          priority: string
          source: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          assigned_to?: string | null
          city_branch_id?: string | null
          company_name?: string | null
          contact_person?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          lead_name: string
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          priority?: string
          source?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          assigned_to?: string | null
          city_branch_id?: string | null
          company_name?: string | null
          contact_person?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          lead_name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          priority?: string
          source?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_center_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_leads_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_leads_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_leads_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_leads_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "communication_center_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_center_messages: {
        Row: {
          attachments: Json
          body: string
          channel: string
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          delivery_status: string
          direction: string
          folder: string
          id: string
          lead_id: string | null
          linked_document_no: string | null
          linked_module: string | null
          linked_route: string | null
          profile_id: string | null
          provider_message_id: string | null
          provider_payload: Json
          read_at: string | null
          read_status: string
          recipient_bcc: string
          recipient_cc: string
          recipient_to: string
          scheduled_at: string | null
          sender_email: string | null
          sender_name: string | null
          sender_snapshot: Json
          sender_user_id: string | null
          sender_whatsapp: string | null
          sent_at: string | null
          subject: string | null
          supplier_id: string | null
          template_key: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          body?: string
          channel: string
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          delivery_status?: string
          direction?: string
          folder?: string
          id?: string
          lead_id?: string | null
          linked_document_no?: string | null
          linked_module?: string | null
          linked_route?: string | null
          profile_id?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          read_at?: string | null
          read_status?: string
          recipient_bcc?: string
          recipient_cc?: string
          recipient_to?: string
          scheduled_at?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_snapshot?: Json
          sender_user_id?: string | null
          sender_whatsapp?: string | null
          sent_at?: string | null
          subject?: string | null
          supplier_id?: string | null
          template_key?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          body?: string
          channel?: string
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          delivery_status?: string
          direction?: string
          folder?: string
          id?: string
          lead_id?: string | null
          linked_document_no?: string | null
          linked_module?: string | null
          linked_route?: string | null
          profile_id?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          read_at?: string | null
          read_status?: string
          recipient_bcc?: string
          recipient_cc?: string
          recipient_to?: string
          scheduled_at?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_snapshot?: Json
          sender_user_id?: string | null
          sender_whatsapp?: string | null
          sent_at?: string | null
          subject?: string | null
          supplier_id?: string | null
          template_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_center_messages_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_messages_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_messages_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_messages_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "communication_center_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "communication_center_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_center_profiles: {
        Row: {
          branch_display_name: string | null
          city_branch_id: string | null
          contact_info: Json
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email_address: string | null
          email_settings: Json
          id: string
          is_active: boolean
          is_default: boolean
          logo_url: string | null
          office_name: string
          scope: string
          signature_html: string | null
          signature_text: string | null
          updated_at: string
          whatsapp_number: string | null
          whatsapp_settings: Json
        }
        Insert: {
          branch_display_name?: string | null
          city_branch_id?: string | null
          contact_info?: Json
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email_address?: string | null
          email_settings?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          logo_url?: string | null
          office_name: string
          scope?: string
          signature_html?: string | null
          signature_text?: string | null
          updated_at?: string
          whatsapp_number?: string | null
          whatsapp_settings?: Json
        }
        Update: {
          branch_display_name?: string | null
          city_branch_id?: string | null
          contact_info?: Json
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email_address?: string | null
          email_settings?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          logo_url?: string | null
          office_name?: string
          scope?: string
          signature_html?: string | null
          signature_text?: string | null
          updated_at?: string
          whatsapp_number?: string | null
          whatsapp_settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "communication_center_profiles_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_profiles_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_center_profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "communication_center_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_contact_preferences: {
        Row: {
          block_reason: string | null
          consent_verified: boolean | null
          contact_identifier: string
          contact_name: string | null
          country_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_blocked: boolean | null
          opt_out_email: boolean | null
          opt_out_whatsapp: boolean | null
          updated_at: string | null
        }
        Insert: {
          block_reason?: string | null
          consent_verified?: boolean | null
          contact_identifier: string
          contact_name?: string | null
          country_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_blocked?: boolean | null
          opt_out_email?: boolean | null
          opt_out_whatsapp?: boolean | null
          updated_at?: string | null
        }
        Update: {
          block_reason?: string | null
          consent_verified?: boolean | null
          contact_identifier?: string
          contact_name?: string | null
          country_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_blocked?: boolean | null
          opt_out_email?: boolean | null
          opt_out_whatsapp?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_contact_preferences_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_contact_preferences_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      communication_conversations: {
        Row: {
          assigned_user_id: string | null
          channel: string
          city_branch_id: string | null
          contact_identifier: string
          country_id: string | null
          created_at: string | null
          id: string
          last_message_at: string | null
          last_message_text: string | null
          message_language: string | null
          priority: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          reply_mode: string | null
          sender_entity_id: string | null
          sender_name: string | null
          sender_type: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          channel: string
          city_branch_id?: string | null
          contact_identifier: string
          country_id?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          message_language?: string | null
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          reply_mode?: string | null
          sender_entity_id?: string | null
          sender_name?: string | null
          sender_type?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          channel?: string
          city_branch_id?: string | null
          contact_identifier?: string
          country_id?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          message_language?: string | null
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          reply_mode?: string | null
          sender_entity_id?: string | null
          sender_name?: string | null
          sender_type?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_conversations_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_conversations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_conversations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      communication_messages: {
        Row: {
          ai_generated_reply: string | null
          approved_at: string | null
          approved_by: string | null
          body: string
          channel: string
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          detected_language: string | null
          direction: string
          edited_reply: string | null
          error_reason: string | null
          id: string
          is_sensitive: boolean | null
          message_category: string | null
          raw_payload: Json | null
          read_at: string | null
          recipient_identifier: string
          sender_identifier: string
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string | null
        }
        Insert: {
          ai_generated_reply?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body: string
          channel: string
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          detected_language?: string | null
          direction: string
          edited_reply?: string | null
          error_reason?: string | null
          id?: string
          is_sensitive?: boolean | null
          message_category?: string | null
          raw_payload?: Json | null
          read_at?: string | null
          recipient_identifier: string
          sender_identifier: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string | null
        }
        Update: {
          ai_generated_reply?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          channel?: string
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          detected_language?: string | null
          direction?: string
          edited_reply?: string | null
          error_reason?: string | null
          id?: string
          is_sensitive?: boolean | null
          message_category?: string | null
          raw_payload?: Json | null
          read_at?: string | null
          recipient_identifier?: string
          sender_identifier?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "communication_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_reminder_rules: {
        Row: {
          channel: string | null
          city_branch_id: string | null
          country_id: string | null
          created_at: string | null
          created_by: string | null
          days_offset: number | null
          id: string
          is_active: boolean | null
          max_reminders: number | null
          preferred_language: string | null
          recipient_type: string | null
          reminder_interval_days: number | null
          require_approval: boolean | null
          rule_name: string
          template_id: string | null
          trigger_event: string
          trigger_time: string | null
          updated_at: string | null
        }
        Insert: {
          channel?: string | null
          city_branch_id?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          days_offset?: number | null
          id?: string
          is_active?: boolean | null
          max_reminders?: number | null
          preferred_language?: string | null
          recipient_type?: string | null
          reminder_interval_days?: number | null
          require_approval?: boolean | null
          rule_name: string
          template_id?: string | null
          trigger_event: string
          trigger_time?: string | null
          updated_at?: string | null
        }
        Update: {
          channel?: string | null
          city_branch_id?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          days_offset?: number | null
          id?: string
          is_active?: boolean | null
          max_reminders?: number | null
          preferred_language?: string | null
          recipient_type?: string | null
          reminder_interval_days?: number | null
          require_approval?: boolean | null
          rule_name?: string
          template_id?: string | null
          trigger_event?: string
          trigger_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_reminder_rules_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_reminder_rules_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_reminder_rules_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "communication_reminder_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          applies_to_branch_id: string | null
          applies_to_country_id: string | null
          body_en: string
          body_fa: string
          body_ps: string
          body_ur: string
          category: string
          code: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          applies_to_branch_id?: string | null
          applies_to_country_id?: string | null
          body_en: string
          body_fa: string
          body_ps: string
          body_ur: string
          category: string
          code: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          applies_to_branch_id?: string | null
          applies_to_country_id?: string | null
          body_en?: string
          body_fa?: string
          body_ps?: string
          body_ur?: string
          category?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_applies_to_branch_id_fkey"
            columns: ["applies_to_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_templates_applies_to_country_id_fkey"
            columns: ["applies_to_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_templates_applies_to_country_id_fkey"
            columns: ["applies_to_country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          area_location_id: string | null
          area_name: string | null
          base_currency: string
          business_type: string | null
          city_id: string | null
          city_name: string | null
          contacts: Json
          country_id: string | null
          country_name: string | null
          created_at: string
          deleted_at: string | null
          district_id: string | null
          district_name: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          owner_ids: Json
          owner_name: string | null
          registrations: Json
          state_name: string | null
          state_province_id: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          area_location_id?: string | null
          area_name?: string | null
          base_currency?: string
          business_type?: string | null
          city_id?: string | null
          city_name?: string | null
          contacts?: Json
          country_id?: string | null
          country_name?: string | null
          created_at?: string
          deleted_at?: string | null
          district_id?: string | null
          district_name?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          owner_ids?: Json
          owner_name?: string | null
          registrations?: Json
          state_name?: string | null
          state_province_id?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          area_location_id?: string | null
          area_name?: string | null
          base_currency?: string
          business_type?: string | null
          city_id?: string | null
          city_name?: string | null
          contacts?: Json
          country_id?: string | null
          country_name?: string | null
          created_at?: string
          deleted_at?: string | null
          district_id?: string | null
          district_name?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          owner_ids?: Json
          owner_name?: string | null
          registrations?: Json
          state_name?: string | null
          state_province_id?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      contact_types: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          key: Database["public"]["Enums"]["contact_type_key"]
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          key: Database["public"]["Enums"]["contact_type_key"]
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          key?: Database["public"]["Enums"]["contact_type_key"]
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          admin_email: string
          created_at: string
          currency_code: string
          default_company_profile_id: string | null
          default_country_branch_id: string | null
          default_language_code: string | null
          deleted_at: string | null
          email_domain: string | null
          email_server_settings: Json
          id: string
          is_active: boolean
          iso2: string | null
          iso3: string | null
          name: string
          official_email: string
          parent_business_group_id: string | null
          phone_code: string | null
          reporting_currency: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          admin_email: string
          created_at?: string
          currency_code: string
          default_company_profile_id?: string | null
          default_country_branch_id?: string | null
          default_language_code?: string | null
          deleted_at?: string | null
          email_domain?: string | null
          email_server_settings?: Json
          id?: string
          is_active?: boolean
          iso2?: string | null
          iso3?: string | null
          name: string
          official_email: string
          parent_business_group_id?: string | null
          phone_code?: string | null
          reporting_currency?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          admin_email?: string
          created_at?: string
          currency_code?: string
          default_company_profile_id?: string | null
          default_country_branch_id?: string | null
          default_language_code?: string | null
          deleted_at?: string | null
          email_domain?: string | null
          email_server_settings?: Json
          id?: string
          is_active?: boolean
          iso2?: string | null
          iso3?: string | null
          name?: string
          official_email?: string
          parent_business_group_id?: string | null
          phone_code?: string | null
          reporting_currency?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "countries_default_company_profile_id_fkey"
            columns: ["default_company_profile_id"]
            isOneToOne: false
            referencedRelation: "country_company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "countries_default_country_branch_id_fkey"
            columns: ["default_country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "countries_default_language_fk"
            columns: ["default_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "countries_parent_business_group_id_fkey"
            columns: ["parent_business_group_id"]
            isOneToOne: false
            referencedRelation: "parent_business_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      country_branches: {
        Row: {
          address: string | null
          branding_address: string | null
          branding_company_name: string | null
          branding_email: string | null
          branding_letterhead_url: string | null
          branding_logo_url: string | null
          branding_phone: string | null
          branding_report_footer: string | null
          branding_report_header: string | null
          branding_stamp_url: string | null
          city_id: string | null
          code: string
          company_id: string | null
          contacts: Json
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          district_id: string | null
          documents: Json
          email: string
          id: string
          is_main: boolean
          local_currency: string
          name: string
          owner_name: string | null
          permission_grants: Json
          permission_template: string | null
          phone: string | null
          state_province_id: string | null
          status: Database["public"]["Enums"]["branch_status"]
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          branding_address?: string | null
          branding_company_name?: string | null
          branding_email?: string | null
          branding_letterhead_url?: string | null
          branding_logo_url?: string | null
          branding_phone?: string | null
          branding_report_footer?: string | null
          branding_report_header?: string | null
          branding_stamp_url?: string | null
          city_id?: string | null
          code: string
          company_id?: string | null
          contacts?: Json
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          documents?: Json
          email: string
          id?: string
          is_main?: boolean
          local_currency: string
          name: string
          owner_name?: string | null
          permission_grants?: Json
          permission_template?: string | null
          phone?: string | null
          state_province_id?: string | null
          status?: Database["public"]["Enums"]["branch_status"]
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          branding_address?: string | null
          branding_company_name?: string | null
          branding_email?: string | null
          branding_letterhead_url?: string | null
          branding_logo_url?: string | null
          branding_phone?: string | null
          branding_report_footer?: string | null
          branding_report_header?: string | null
          branding_stamp_url?: string | null
          city_id?: string | null
          code?: string
          company_id?: string | null
          contacts?: Json
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          documents?: Json
          email?: string
          id?: string
          is_main?: boolean
          local_currency?: string
          name?: string
          owner_name?: string | null
          permission_grants?: Json
          permission_template?: string | null
          phone?: string | null
          state_province_id?: string | null
          status?: Database["public"]["Enums"]["branch_status"]
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "country_branches_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_branches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_branches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "country_branches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_branches_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_branches_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      country_company_profiles: {
        Row: {
          banking_information: Json
          base_currency: string
          certificate_header: string | null
          company_address: string | null
          company_logo_url: string | null
          company_name: string
          company_name_ar: string | null
          company_name_en: string | null
          company_name_fa: string | null
          company_name_ps: string | null
          company_name_ur: string | null
          company_stamp_url: string | null
          contact_information: Json
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_footer_template: Json
          document_header_template: Json
          email_information: Json
          hr_department_name: string | null
          hr_manager_name: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          letterhead_url: string | null
          parent_business_group_id: string | null
          qr_enabled: boolean
          registration_number: string | null
          report_header: string | null
          tax_information: Json
          updated_at: string
          watermark_text: string | null
          website_information: Json
        }
        Insert: {
          banking_information?: Json
          base_currency: string
          certificate_header?: string | null
          company_address?: string | null
          company_logo_url?: string | null
          company_name: string
          company_name_ar?: string | null
          company_name_en?: string | null
          company_name_fa?: string | null
          company_name_ps?: string | null
          company_name_ur?: string | null
          company_stamp_url?: string | null
          contact_information?: Json
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_footer_template?: Json
          document_header_template?: Json
          email_information?: Json
          hr_department_name?: string | null
          hr_manager_name?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          letterhead_url?: string | null
          parent_business_group_id?: string | null
          qr_enabled?: boolean
          registration_number?: string | null
          report_header?: string | null
          tax_information?: Json
          updated_at?: string
          watermark_text?: string | null
          website_information?: Json
        }
        Update: {
          banking_information?: Json
          base_currency?: string
          certificate_header?: string | null
          company_address?: string | null
          company_logo_url?: string | null
          company_name?: string
          company_name_ar?: string | null
          company_name_en?: string | null
          company_name_fa?: string | null
          company_name_ps?: string | null
          company_name_ur?: string | null
          company_stamp_url?: string | null
          contact_information?: Json
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_footer_template?: Json
          document_header_template?: Json
          email_information?: Json
          hr_department_name?: string | null
          hr_manager_name?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          letterhead_url?: string | null
          parent_business_group_id?: string | null
          qr_enabled?: boolean
          registration_number?: string | null
          report_header?: string | null
          tax_information?: Json
          updated_at?: string
          watermark_text?: string | null
          website_information?: Json
        }
        Relationships: [
          {
            foreignKeyName: "country_company_profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_company_profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "country_company_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_company_profiles_parent_business_group_id_fkey"
            columns: ["parent_business_group_id"]
            isOneToOne: false
            referencedRelation: "parent_business_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      country_contact_type_rules: {
        Row: {
          calling_code: string
          contact_type_id: string
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          example: string | null
          format_mask: string | null
          id: string
          is_active: boolean
          prefix: string | null
          updated_at: string
        }
        Insert: {
          calling_code: string
          contact_type_id: string
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          example?: string | null
          format_mask?: string | null
          id?: string
          is_active?: boolean
          prefix?: string | null
          updated_at?: string
        }
        Update: {
          calling_code?: string
          contact_type_id?: string
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          example?: string | null
          format_mask?: string | null
          id?: string
          is_active?: boolean
          prefix?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_contact_type_rules_contact_type_id_fkey"
            columns: ["contact_type_id"]
            isOneToOne: false
            referencedRelation: "contact_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_contact_type_rules_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_contact_type_rules_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "country_contact_type_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_rates: {
        Row: {
          country_id: string | null
          created_at: string
          created_by: string | null
          credit_rate: number | null
          debit_rate: number | null
          deleted_at: string | null
          effective_date: string
          from_currency: string
          id: string
          rate: number
          to_currency: string
          updated_at: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_rate?: number | null
          debit_rate?: number | null
          deleted_at?: string | null
          effective_date: string
          from_currency: string
          id?: string
          rate: number
          to_currency?: string
          updated_at?: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_rate?: number | null
          debit_rate?: number | null
          deleted_at?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_rates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "currency_rates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "currency_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          contact_type: string
          contact_value: string
          created_at: string
          customer_id: string
          deleted_at: string | null
          id: string
          is_primary: boolean
          updated_at: string
        }
        Insert: {
          contact_type: string
          contact_value: string
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          updated_at?: string
        }
        Update: {
          contact_type?: string
          contact_value?: string
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_registrations: {
        Row: {
          created_at: string
          customer_id: string
          deleted_at: string | null
          id: string
          registration_type: string
          registration_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          id?: string
          registration_type: string
          registration_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          id?: string
          registration_type?: string
          registration_value?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_registrations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          area_location_id: string | null
          branch_serial: string | null
          city_id: string | null
          company_name: string | null
          contact_person: string | null
          country_id: string
          country_serial: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          deleted_at: string | null
          district_id: string | null
          email: string | null
          entry_serial: string | null
          id: string
          is_active: boolean
          mobile: string | null
          notes: string | null
          original_language_code: string
          state_province_id: string | null
          super_admin_serial: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          area_location_id?: string | null
          branch_serial?: string | null
          city_id?: string | null
          company_name?: string | null
          contact_person?: string | null
          country_id: string
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          deleted_at?: string | null
          district_id?: string | null
          email?: string | null
          entry_serial?: string | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          notes?: string | null
          original_language_code?: string
          state_province_id?: string | null
          super_admin_serial?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          area_location_id?: string | null
          branch_serial?: string | null
          city_id?: string | null
          company_name?: string | null
          contact_person?: string | null
          country_id?: string
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          deleted_at?: string | null
          district_id?: string | null
          email?: string | null
          entry_serial?: string | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          notes?: string | null
          original_language_code?: string
          state_province_id?: string | null
          super_admin_serial?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_area_location_id_fkey"
            columns: ["area_location_id"]
            isOneToOne: false
            referencedRelation: "areas_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_original_language_code_fkey"
            columns: ["original_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "customers_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_usd_rates: {
        Row: {
          approval_request_id: string | null
          approved_at: string | null
          approved_by: string | null
          branch_name: string | null
          buying_rate: number
          country_branch_id: string | null
          country_id: string
          created_at: string
          credit_rate: number
          debit_rate: number
          deleted_at: string | null
          entered_by: string | null
          id: string
          rate_date: string
          rate_time: string | null
          selling_rate: number
          updated_at: string
          user_name: string | null
        }
        Insert: {
          approval_request_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_name?: string | null
          buying_rate: number
          country_branch_id?: string | null
          country_id: string
          created_at?: string
          credit_rate: number
          debit_rate: number
          deleted_at?: string | null
          entered_by?: string | null
          id?: string
          rate_date: string
          rate_time?: string | null
          selling_rate: number
          updated_at?: string
          user_name?: string | null
        }
        Update: {
          approval_request_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_name?: string | null
          buying_rate?: number
          country_branch_id?: string | null
          country_id?: string
          created_at?: string
          credit_rate?: number
          debit_rate?: number
          deleted_at?: string | null
          entered_by?: string | null
          id?: string
          rate_date?: string
          rate_time?: string | null
          selling_rate?: number
          updated_at?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_usd_rates_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_usd_rates_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_usd_rates_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_usd_rates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_usd_rates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "daily_usd_rates_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          code: string | null
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          phone_area_code: string | null
          postal_code: string | null
          state_province_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone_area_code?: string | null
          postal_code?: string | null
          state_province_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone_area_code?: string | null
          postal_code?: string | null
          state_province_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "districts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "districts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "districts_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_advances_loans: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          employee_id: string
          end_month: string | null
          id: string
          journal_entry_id: string | null
          monthly_deduction: number
          payment_account_id: string | null
          payment_date: string
          recovery_method: string | null
          remaining_balance: number
          remarks: string | null
          start_month: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          employee_id: string
          end_month?: string | null
          id?: string
          journal_entry_id?: string | null
          monthly_deduction?: number
          payment_account_id?: string | null
          payment_date: string
          recovery_method?: string | null
          remaining_balance?: number
          remarks?: string | null
          start_month?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          employee_id?: string
          end_month?: string | null
          id?: string
          journal_entry_id?: string | null
          monthly_deduction?: number
          payment_account_id?: string | null
          payment_date?: string
          recovery_method?: string | null
          remaining_balance?: number
          remarks?: string | null
          start_month?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_advances_loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_advances_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_advances_loans_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_advances_loans_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_advances_loans_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salaries_due: {
        Row: {
          advance_recovery: number
          allowances: number
          approved_by: string | null
          basic_salary: number
          branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deductions: number
          deleted_at: string | null
          due_date: string
          employee_id: string
          exchange_rate: number
          id: string
          journal_entry_id: string | null
          loan_recovery: number
          local_currency_amount: number
          net_salary: number
          overtime: number
          paid_date: string | null
          payment_account_id: string | null
          payment_journal_entry_id: string | null
          payment_method: string | null
          posting_date: string | null
          salary_month: string
          status: string
          transfer_date: string | null
          transferred_by: string | null
          updated_at: string
        }
        Insert: {
          advance_recovery?: number
          allowances?: number
          approved_by?: string | null
          basic_salary?: number
          branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deductions?: number
          deleted_at?: string | null
          due_date: string
          employee_id: string
          exchange_rate?: number
          id?: string
          journal_entry_id?: string | null
          loan_recovery?: number
          local_currency_amount?: number
          net_salary?: number
          overtime?: number
          paid_date?: string | null
          payment_account_id?: string | null
          payment_journal_entry_id?: string | null
          payment_method?: string | null
          posting_date?: string | null
          salary_month: string
          status?: string
          transfer_date?: string | null
          transferred_by?: string | null
          updated_at?: string
        }
        Update: {
          advance_recovery?: number
          allowances?: number
          approved_by?: string | null
          basic_salary?: number
          branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deductions?: number
          deleted_at?: string | null
          due_date?: string
          employee_id?: string
          exchange_rate?: number
          id?: string
          journal_entry_id?: string | null
          loan_recovery?: number
          local_currency_amount?: number
          net_salary?: number
          overtime?: number
          paid_date?: string | null
          payment_account_id?: string | null
          payment_journal_entry_id?: string | null
          payment_method?: string | null
          posting_date?: string | null
          salary_month?: string
          status?: string
          transfer_date?: string | null
          transferred_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salaries_due_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_due_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_due_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_due_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "employee_salaries_due_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_due_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_due_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_due_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_due_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_due_payment_journal_entry_id_fkey"
            columns: ["payment_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_due_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          accommodation_allowance: number
          advance_deduction: number
          advance_salary_account_id: string | null
          allowance: number
          bank_account_id: string | null
          basic_salary: number
          branch_serial: string | null
          cash_account_id: string | null
          category: string
          city_branch_id: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          country_branch_id: string | null
          country_id: string | null
          country_serial: string | null
          created_at: string
          created_by: string | null
          daily_salary: number
          deduction: number
          deduction_account_id: string | null
          deleted_at: string | null
          department: string | null
          designation: string | null
          duty_end_time: string | null
          duty_start_time: string | null
          employee_code: string
          employee_payable_account_id: string | null
          employment_type: string | null
          entry_serial: string | null
          food_allowance: number
          hourly_salary: number
          id: string
          job_status: string | null
          joining_date: string | null
          loan_account_id: string | null
          loan_deduction: number
          mobile_allowance: number
          monthly_salary: number
          net_salary: number
          other_allowance: number
          overtime_rate: number
          person_master_id: string
          probation_end_date: string | null
          probation_start_date: string | null
          reporting_manager_id: string | null
          salary_currency: string
          salary_expense_account_id: string | null
          salary_payment_date: string | null
          salary_payment_method: string | null
          salary_schedule: string | null
          salary_schedule_date: string | null
          salary_start_date: string | null
          salary_type: string | null
          status: string
          super_admin_serial: string | null
          tax_deduction: number
          transport_allowance: number
          updated_at: string
          weekly_off_day: string | null
          working_shift: string | null
        }
        Insert: {
          accommodation_allowance?: number
          advance_deduction?: number
          advance_salary_account_id?: string | null
          allowance?: number
          bank_account_id?: string | null
          basic_salary?: number
          branch_serial?: string | null
          cash_account_id?: string | null
          category: string
          city_branch_id?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          daily_salary?: number
          deduction?: number
          deduction_account_id?: string | null
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          duty_end_time?: string | null
          duty_start_time?: string | null
          employee_code: string
          employee_payable_account_id?: string | null
          employment_type?: string | null
          entry_serial?: string | null
          food_allowance?: number
          hourly_salary?: number
          id?: string
          job_status?: string | null
          joining_date?: string | null
          loan_account_id?: string | null
          loan_deduction?: number
          mobile_allowance?: number
          monthly_salary?: number
          net_salary?: number
          other_allowance?: number
          overtime_rate?: number
          person_master_id: string
          probation_end_date?: string | null
          probation_start_date?: string | null
          reporting_manager_id?: string | null
          salary_currency?: string
          salary_expense_account_id?: string | null
          salary_payment_date?: string | null
          salary_payment_method?: string | null
          salary_schedule?: string | null
          salary_schedule_date?: string | null
          salary_start_date?: string | null
          salary_type?: string | null
          status?: string
          super_admin_serial?: string | null
          tax_deduction?: number
          transport_allowance?: number
          updated_at?: string
          weekly_off_day?: string | null
          working_shift?: string | null
        }
        Update: {
          accommodation_allowance?: number
          advance_deduction?: number
          advance_salary_account_id?: string | null
          allowance?: number
          bank_account_id?: string | null
          basic_salary?: number
          branch_serial?: string | null
          cash_account_id?: string | null
          category?: string
          city_branch_id?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          daily_salary?: number
          deduction?: number
          deduction_account_id?: string | null
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          duty_end_time?: string | null
          duty_start_time?: string | null
          employee_code?: string
          employee_payable_account_id?: string | null
          employment_type?: string | null
          entry_serial?: string | null
          food_allowance?: number
          hourly_salary?: number
          id?: string
          job_status?: string | null
          joining_date?: string | null
          loan_account_id?: string | null
          loan_deduction?: number
          mobile_allowance?: number
          monthly_salary?: number
          net_salary?: number
          other_allowance?: number
          overtime_rate?: number
          person_master_id?: string
          probation_end_date?: string | null
          probation_start_date?: string | null
          reporting_manager_id?: string | null
          salary_currency?: string
          salary_expense_account_id?: string | null
          salary_payment_date?: string | null
          salary_payment_method?: string | null
          salary_schedule?: string | null
          salary_schedule_date?: string | null
          salary_start_date?: string | null
          salary_type?: string | null
          status?: string
          super_admin_serial?: string | null
          tax_deduction?: number
          transport_allowance?: number
          updated_at?: string
          weekly_off_day?: string | null
          working_shift?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_advance_salary_account_id_fkey"
            columns: ["advance_salary_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_advance_salary_account_id_fkey"
            columns: ["advance_salary_account_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_deduction_account_id_fkey"
            columns: ["deduction_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_deduction_account_id_fkey"
            columns: ["deduction_account_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_employee_payable_account_id_fkey"
            columns: ["employee_payable_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_employee_payable_account_id_fkey"
            columns: ["employee_payable_account_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_loan_account_id_fkey"
            columns: ["loan_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_loan_account_id_fkey"
            columns: ["loan_account_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_person_master_id_fkey"
            columns: ["person_master_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_salary_expense_account_id_fkey"
            columns: ["salary_expense_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_salary_expense_account_id_fkey"
            columns: ["salary_expense_account_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_account_history: {
        Row: {
          account_number: string
          created_by: string | null
          credit_total: number
          current_balance: number
          debit_total: number
          details: Json
          enterprise_account_id: string
          event_at: string
          event_type: string
          id: string
          last_transaction_at: string | null
        }
        Insert: {
          account_number: string
          created_by?: string | null
          credit_total?: number
          current_balance?: number
          debit_total?: number
          details?: Json
          enterprise_account_id: string
          event_at?: string
          event_type: string
          id?: string
          last_transaction_at?: string | null
        }
        Update: {
          account_number?: string
          created_by?: string | null
          credit_total?: number
          current_balance?: number
          debit_total?: number
          details?: Json
          enterprise_account_id?: string
          event_at?: string
          event_type?: string
          id?: string
          last_transaction_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_account_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_account_history_enterprise_account_id_fkey"
            columns: ["enterprise_account_id"]
            isOneToOne: false
            referencedRelation: "enterprise_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_accounts: {
        Row: {
          account_number: string
          account_serial_number: number
          approval_request_id: string | null
          approved_by: string | null
          bank_id: string | null
          branch_account_sequence: number
          branch_code: string
          branch_serial: string | null
          branch_serial_number: string
          city_branch_id: string | null
          code: string
          company_id: string | null
          contacts: Json | null
          country_branch_id: string | null
          country_id: string | null
          country_serial: string | null
          country_serial_number: string
          created_at: string
          created_by: string | null
          creation_date: string
          currency: string
          current_balance: number
          customer_id: string | null
          customer_number: string
          deleted_at: string | null
          entry_serial: string | null
          id: string
          is_control_account: boolean
          kind: Database["public"]["Enums"]["account_kind"]
          manual_reference_number: string | null
          name: string
          opening_balance: number
          parent_id: string | null
          scope: Database["public"]["Enums"]["ledger_scope"]
          status: Database["public"]["Enums"]["account_status"]
          super_admin_serial: string | null
          updated_at: string
        }
        Insert: {
          account_number: string
          account_serial_number: number
          approval_request_id?: string | null
          approved_by?: string | null
          bank_id?: string | null
          branch_account_sequence: number
          branch_code: string
          branch_serial?: string | null
          branch_serial_number: string
          city_branch_id?: string | null
          code: string
          company_id?: string | null
          contacts?: Json | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          country_serial_number: string
          created_at?: string
          created_by?: string | null
          creation_date: string
          currency: string
          current_balance?: number
          customer_id?: string | null
          customer_number: string
          deleted_at?: string | null
          entry_serial?: string | null
          id?: string
          is_control_account?: boolean
          kind: Database["public"]["Enums"]["account_kind"]
          manual_reference_number?: string | null
          name: string
          opening_balance?: number
          parent_id?: string | null
          scope: Database["public"]["Enums"]["ledger_scope"]
          status?: Database["public"]["Enums"]["account_status"]
          super_admin_serial?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string
          account_serial_number?: number
          approval_request_id?: string | null
          approved_by?: string | null
          bank_id?: string | null
          branch_account_sequence?: number
          branch_code?: string
          branch_serial?: string | null
          branch_serial_number?: string
          city_branch_id?: string | null
          code?: string
          company_id?: string | null
          contacts?: Json | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          country_serial_number?: string
          created_at?: string
          created_by?: string | null
          creation_date?: string
          currency?: string
          current_balance?: number
          customer_id?: string | null
          customer_number?: string
          deleted_at?: string | null
          entry_serial?: string | null
          id?: string
          is_control_account?: boolean
          kind?: Database["public"]["Enums"]["account_kind"]
          manual_reference_number?: string | null
          name?: string
          opening_balance?: number
          parent_id?: string | null
          scope?: Database["public"]["Enums"]["ledger_scope"]
          status?: Database["public"]["Enums"]["account_status"]
          super_admin_serial?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_accounts_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_accounts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_accounts_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_accounts_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_accounts_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_accounts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_accounts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "enterprise_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "enterprise_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_ledger_reversals: {
        Row: {
          approval_request_id: string | null
          created_at: string
          id: string
          original_batch_id: string
          reason: string
          reversal_batch_id: string
          reversed_at: string
          reversed_by: string | null
        }
        Insert: {
          approval_request_id?: string | null
          created_at?: string
          id?: string
          original_batch_id: string
          reason: string
          reversal_batch_id: string
          reversed_at?: string
          reversed_by?: string | null
        }
        Update: {
          approval_request_id?: string | null
          created_at?: string
          id?: string
          original_batch_id?: string
          reason?: string
          reversal_batch_id?: string
          reversed_at?: string
          reversed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_ledger_reversals_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_ledger_reversals_original_batch_id_fkey"
            columns: ["original_batch_id"]
            isOneToOne: false
            referencedRelation: "branch_ledger_transaction_report"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "enterprise_ledger_reversals_original_batch_id_fkey"
            columns: ["original_batch_id"]
            isOneToOne: false
            referencedRelation: "ledger_posting_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_ledger_reversals_reversal_batch_id_fkey"
            columns: ["reversal_batch_id"]
            isOneToOne: false
            referencedRelation: "branch_ledger_transaction_report"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "enterprise_ledger_reversals_reversal_batch_id_fkey"
            columns: ["reversal_batch_id"]
            isOneToOne: false
            referencedRelation: "ledger_posting_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_ledger_reversals_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_activity_events: {
        Row: {
          action: string
          actor_id: string | null
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          record_id: string | null
          record_table: string | null
          resource: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          record_id?: string | null
          record_table?: string | null
          resource: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          record_id?: string | null
          record_table?: string | null
          resource?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_activity_events_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_activity_events_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_activity_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_activity_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      erp_assignments: {
        Row: {
          assigned_by: string | null
          assigned_to_user_id: string | null
          assignment_no: string
          city_branch_id: string | null
          clearing_agent_branch_id: string | null
          clearing_agent_id: string | null
          completed_at: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          deleted_at: string | null
          due_at: string | null
          id: string
          message: string | null
          status: string
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to_user_id?: string | null
          assignment_no: string
          city_branch_id?: string | null
          clearing_agent_branch_id?: string | null
          clearing_agent_id?: string | null
          completed_at?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          id?: string
          message?: string | null
          status?: string
          target_type: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to_user_id?: string | null
          assignment_no?: string
          city_branch_id?: string | null
          clearing_agent_branch_id?: string | null
          clearing_agent_id?: string | null
          completed_at?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          id?: string
          message?: string | null
          status?: string
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_assignments_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_assignments_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_assignments_clearing_agent_branch_id_fkey"
            columns: ["clearing_agent_branch_id"]
            isOneToOne: false
            referencedRelation: "clearing_agent_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_assignments_clearing_agent_id_fkey"
            columns: ["clearing_agent_id"]
            isOneToOne: false
            referencedRelation: "clearing_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_assignments_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_assignments_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_assignments_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      erp_email_accounts: {
        Row: {
          admin_email: string | null
          cc_country_admin: boolean
          cc_super_admin: boolean
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_name: string
          email_address: string
          id: string
          is_active: boolean
          is_default: boolean
          last_sent_at: string | null
          last_test_result: string | null
          last_tested_at: string | null
          provider_id: string | null
          reply_to: string | null
          scope: string
          settings: Json
          updated_at: string
        }
        Insert: {
          admin_email?: string | null
          cc_country_admin?: boolean
          cc_super_admin?: boolean
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name: string
          email_address: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_sent_at?: string | null
          last_test_result?: string | null
          last_tested_at?: string | null
          provider_id?: string | null
          reply_to?: string | null
          scope: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          admin_email?: string | null
          cc_country_admin?: boolean
          cc_super_admin?: boolean
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string
          email_address?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_sent_at?: string | null
          last_test_result?: string | null
          last_tested_at?: string | null
          provider_id?: string | null
          reply_to?: string | null
          scope?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_email_accounts_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_email_accounts_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_email_accounts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_email_accounts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "erp_email_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_email_accounts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "erp_email_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_email_messages: {
        Row: {
          attachment_count: number
          attachments: Json
          audit_payload: Json
          body: string
          channel: string
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          delivery_status: string
          direction: string
          email_account_id: string | null
          external_message_id: string | null
          folder: string
          id: string
          labels: string[]
          linked_document_no: string | null
          linked_module: string | null
          linked_route: string | null
          provider_id: string | null
          received_at: string | null
          recipient_bcc: string
          recipient_cc: string
          recipient_to: string
          sender_email: string | null
          sender_name: string
          sender_user_id: string | null
          sent_at: string | null
          subject: string
          supplier_id: string | null
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          attachment_count?: number
          attachments?: Json
          audit_payload?: Json
          body: string
          channel?: string
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          delivery_status?: string
          direction?: string
          email_account_id?: string | null
          external_message_id?: string | null
          folder?: string
          id?: string
          labels?: string[]
          linked_document_no?: string | null
          linked_module?: string | null
          linked_route?: string | null
          provider_id?: string | null
          received_at?: string | null
          recipient_bcc?: string
          recipient_cc?: string
          recipient_to?: string
          sender_email?: string | null
          sender_name: string
          sender_user_id?: string | null
          sent_at?: string | null
          subject: string
          supplier_id?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          attachment_count?: number
          attachments?: Json
          audit_payload?: Json
          body?: string
          channel?: string
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          delivery_status?: string
          direction?: string
          email_account_id?: string | null
          external_message_id?: string | null
          folder?: string
          id?: string
          labels?: string[]
          linked_document_no?: string | null
          linked_module?: string | null
          linked_route?: string | null
          provider_id?: string | null
          received_at?: string | null
          recipient_bcc?: string
          recipient_cc?: string
          recipient_to?: string
          sender_email?: string | null
          sender_name?: string
          sender_user_id?: string | null
          sent_at?: string | null
          subject?: string
          supplier_id?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_email_messages_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_email_messages_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_email_messages_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_email_messages_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "erp_email_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_email_messages_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "erp_email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_email_messages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "erp_email_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_email_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_email_providers: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          domain: string
          id: string
          imap_host: string | null
          imap_port: number | null
          is_active: boolean
          provider_name: string
          provider_type: string
          security_mode: string
          settings: Json
          smtp_host: string | null
          smtp_port: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          domain: string
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          is_active?: boolean
          provider_name: string
          provider_type?: string
          security_mode?: string
          settings?: Json
          smtp_host?: string | null
          smtp_port?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          domain?: string
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          is_active?: boolean
          provider_name?: string
          provider_type?: string
          security_mode?: string
          settings?: Json
          smtp_host?: string | null
          smtp_port?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_email_providers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_modules: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_financial: boolean
          name: string
          sort_order: number
          status: Database["public"]["Enums"]["erp_module_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_financial?: boolean
          name: string
          sort_order?: number
          status?: Database["public"]["Enums"]["erp_module_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_financial?: boolean
          name?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["erp_module_status"]
          updated_at?: string
        }
        Relationships: []
      }
      erp_multilingual_events: {
        Row: {
          actor_id: string | null
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          deleted_at: string | null
          entity_id: string | null
          entity_table: string | null
          event_type: string
          id: string
          is_read: boolean
          message_language_code: string
          message_original: string
          message_translations: Json
          message_urdu: string
          notify_email: boolean
          notify_local_admin: boolean
          notify_mobile: boolean
          notify_super_admin: boolean
          payload: Json
          severity: string
          source_module: string | null
        }
        Insert: {
          actor_id?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_table?: string | null
          event_type: string
          id?: string
          is_read?: boolean
          message_language_code?: string
          message_original: string
          message_translations?: Json
          message_urdu: string
          notify_email?: boolean
          notify_local_admin?: boolean
          notify_mobile?: boolean
          notify_super_admin?: boolean
          payload?: Json
          severity?: string
          source_module?: string | null
        }
        Update: {
          actor_id?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_table?: string | null
          event_type?: string
          id?: string
          is_read?: boolean
          message_language_code?: string
          message_original?: string
          message_translations?: Json
          message_urdu?: string
          notify_email?: boolean
          notify_local_admin?: boolean
          notify_mobile?: boolean
          notify_super_admin?: boolean
          payload?: Json
          severity?: string
          source_module?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_multilingual_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_multilingual_events_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_multilingual_events_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_multilingual_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_multilingual_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "erp_multilingual_events_message_language_code_fkey"
            columns: ["message_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      erp_page_database_bindings: {
        Row: {
          api_route: string | null
          created_at: string
          id: string
          module_code: string
          notes: string | null
          primary_table: string
          route_path: string
          status: string
          updated_at: string
        }
        Insert: {
          api_route?: string | null
          created_at?: string
          id?: string
          module_code: string
          notes?: string | null
          primary_table: string
          route_path: string
          status?: string
          updated_at?: string
        }
        Update: {
          api_route?: string | null
          created_at?: string
          id?: string
          module_code?: string
          notes?: string | null
          primary_table?: string
          route_path?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      erp_pdf_email_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_title: string
          email_subject: string | null
          email_to: string | null
          error_message: string | null
          id: string
          job_no: string
          language_code: string | null
          pdf_path: string | null
          sent_at: string | null
          source_id: string
          source_table: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_title: string
          email_subject?: string | null
          email_to?: string | null
          error_message?: string | null
          id?: string
          job_no: string
          language_code?: string | null
          pdf_path?: string | null
          sent_at?: string | null
          source_id: string
          source_table: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_title?: string
          email_subject?: string | null
          email_to?: string | null
          error_message?: string | null
          id?: string
          job_no?: string
          language_code?: string | null
          pdf_path?: string | null
          sent_at?: string | null
          source_id?: string
          source_table?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_pdf_email_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_pdf_email_jobs_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      erp_record_transfers: {
        Row: {
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          decided_at: string | null
          deleted_at: string | null
          id: string
          reason: string | null
          receiver_user_id: string | null
          record_id: string
          record_table: string
          sender_user_id: string | null
          sent_at: string
          status: string
          transfer_no: string
          updated_at: string
        }
        Insert: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          decided_at?: string | null
          deleted_at?: string | null
          id?: string
          reason?: string | null
          receiver_user_id?: string | null
          record_id: string
          record_table: string
          sender_user_id?: string | null
          sent_at?: string
          status?: string
          transfer_no: string
          updated_at?: string
        }
        Update: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          decided_at?: string | null
          deleted_at?: string | null
          id?: string
          reason?: string | null
          receiver_user_id?: string | null
          record_id?: string
          record_table?: string
          sender_user_id?: string | null
          sent_at?: string
          status?: string
          transfer_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_record_transfers_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_record_transfers_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_record_transfers_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_record_transfers_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "erp_record_transfers_receiver_user_id_fkey"
            columns: ["receiver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_record_transfers_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_report_exports: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          export_format: string
          export_status: string
          file_name: string | null
          file_url: string | null
          id: string
          language_code: string
          module_key: string
          payload: Json
          source_id: string | null
          source_table: string | null
          template_key: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          export_format?: string
          export_status?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          language_code?: string
          module_key: string
          payload?: Json
          source_id?: string | null
          source_table?: string | null
          template_key: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          export_format?: string
          export_status?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          language_code?: string
          module_key?: string
          payload?: Json
          source_id?: string | null
          source_table?: string | null
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_report_exports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_report_exports_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      erp_report_templates: {
        Row: {
          created_at: string
          created_by: string | null
          css_template: string | null
          deleted_at: string | null
          html_template: string | null
          id: string
          is_active: boolean
          is_default: boolean
          language_code: string
          module_key: string
          orientation: string
          paper_size: string
          report_title: string
          report_title_translations: Json
          template_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          css_template?: string | null
          deleted_at?: string | null
          html_template?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          language_code?: string
          module_key: string
          orientation?: string
          paper_size?: string
          report_title: string
          report_title_translations?: Json
          template_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          css_template?: string | null
          deleted_at?: string | null
          html_template?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          language_code?: string
          module_key?: string
          orientation?: string
          paper_size?: string
          report_title?: string
          report_title_translations?: Json
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_report_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_report_templates_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      erp_role_template_permissions: {
        Row: {
          permission_id: string
          role_template_id: string
        }
        Insert: {
          permission_id: string
          role_template_id: string
        }
        Update: {
          permission_id?: string
          role_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_role_template_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_role_template_permissions_role_template_id_fkey"
            columns: ["role_template_id"]
            isOneToOne: false
            referencedRelation: "erp_role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_role_templates: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          scope_level: Database["public"]["Enums"]["branch_level"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          scope_level: Database["public"]["Enums"]["branch_level"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          scope_level?: Database["public"]["Enums"]["branch_level"]
          updated_at?: string
        }
        Relationships: []
      }
      erp_schema_migrations: {
        Row: {
          applied_at: string
          name: string
          status: string
        }
        Insert: {
          applied_at?: string
          name: string
          status: string
        }
        Update: {
          applied_at?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      exchange_rate_history: {
        Row: {
          approval_request_id: string | null
          changed_by: string | null
          country_id: string | null
          created_at: string
          effective_date: string
          from_currency: string
          id: string
          new_rate: number
          old_rate: number | null
          reason: string | null
          to_currency: string
        }
        Insert: {
          approval_request_id?: string | null
          changed_by?: string | null
          country_id?: string | null
          created_at?: string
          effective_date: string
          from_currency: string
          id?: string
          new_rate: number
          old_rate?: number | null
          reason?: string | null
          to_currency?: string
        }
        Update: {
          approval_request_id?: string | null
          changed_by?: string | null
          country_id?: string | null
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          new_rate?: number
          old_rate?: number | null
          reason?: string | null
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rate_history_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_rate_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_rate_history_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_rate_history_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      expenses_bill_lines: {
        Row: {
          amount: number
          bill_id: string
          created_at: string | null
          currency: string
          details: string
          exchange_rate: number
          final_amount: number
          grand_amount: number
          id: string
          operation: string
          qty: number
          row_serial: number
          tax_amt: number
          tax_on: boolean
          tax_pct: number
          unit_price: number
        }
        Insert: {
          amount?: number
          bill_id: string
          created_at?: string | null
          currency: string
          details: string
          exchange_rate?: number
          final_amount?: number
          grand_amount?: number
          id?: string
          operation: string
          qty?: number
          row_serial: number
          tax_amt?: number
          tax_on?: boolean
          tax_pct?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string | null
          currency?: string
          details?: string
          exchange_rate?: number
          final_amount?: number
          grand_amount?: number
          id?: string
          operation?: string
          qty?: number
          row_serial?: number
          tax_amt?: number
          tax_on?: boolean
          tax_pct?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "expenses_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses_bills: {
        Row: {
          bill_date: string
          bill_mode: string
          bill_title: string
          branch_id: string
          branch_serial: string | null
          country_serial: string | null
          created_at: string | null
          created_by: string | null
          credit_ledger_id: string | null
          debit_ledger_id: string | null
          deleted_at: string | null
          entry_serial: string | null
          id: string
          reference_no: string | null
          roznamcha_entry_id: string | null
          serial_no: string
          super_admin_serial: string | null
          transferred_to_roznamcha: boolean | null
          updated_at: string | null
        }
        Insert: {
          bill_date: string
          bill_mode: string
          bill_title: string
          branch_id: string
          branch_serial?: string | null
          country_serial?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_ledger_id?: string | null
          debit_ledger_id?: string | null
          deleted_at?: string | null
          entry_serial?: string | null
          id?: string
          reference_no?: string | null
          roznamcha_entry_id?: string | null
          serial_no: string
          super_admin_serial?: string | null
          transferred_to_roznamcha?: boolean | null
          updated_at?: string | null
        }
        Update: {
          bill_date?: string
          bill_mode?: string
          bill_title?: string
          branch_id?: string
          branch_serial?: string | null
          country_serial?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_ledger_id?: string | null
          debit_ledger_id?: string | null
          deleted_at?: string | null
          entry_serial?: string | null
          id?: string
          reference_no?: string | null
          roznamcha_entry_id?: string | null
          serial_no?: string
          super_admin_serial?: string | null
          transferred_to_roznamcha?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bills_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bills_credit_ledger_id_fkey"
            columns: ["credit_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bills_credit_ledger_id_fkey"
            columns: ["credit_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bills_debit_ledger_id_fkey"
            columns: ["debit_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bills_debit_ledger_id_fkey"
            columns: ["debit_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bills_roznamcha_entry_id_fkey"
            columns: ["roznamcha_entry_id"]
            isOneToOne: false
            referencedRelation: "roznamcha_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_periods: {
        Row: {
          approval_request_id: string | null
          city_branch_id: string | null
          closed_at: string | null
          closed_by: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string
          id: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          period_name: string
          scope: Database["public"]["Enums"]["ledger_scope"]
          start_date: string
          status: Database["public"]["Enums"]["financial_period_status"]
          updated_at: string
        }
        Insert: {
          approval_request_id?: string | null
          city_branch_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date: string
          id?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          period_name: string
          scope: Database["public"]["Enums"]["ledger_scope"]
          start_date: string
          status?: Database["public"]["Enums"]["financial_period_status"]
          updated_at?: string
        }
        Update: {
          approval_request_id?: string | null
          city_branch_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string
          id?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          period_name?: string
          scope?: Database["public"]["Enums"]["ledger_scope"]
          start_date?: string
          status?: Database["public"]["Enums"]["financial_period_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_periods_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "financial_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goods: {
        Row: {
          branch_serial: string | null
          chs_code: string
          country_serial: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entry_serial: string | null
          goods_name: string
          id: string
          is_active: boolean
          origin_country_id: string | null
          original_language_code: string
          super_admin_serial: string | null
          updated_at: string
        }
        Insert: {
          branch_serial?: string | null
          chs_code: string
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_serial?: string | null
          goods_name: string
          id?: string
          is_active?: boolean
          origin_country_id?: string | null
          original_language_code?: string
          super_admin_serial?: string | null
          updated_at?: string
        }
        Update: {
          branch_serial?: string | null
          chs_code?: string
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_serial?: string | null
          goods_name?: string
          id?: string
          is_active?: boolean
          origin_country_id?: string | null
          original_language_code?: string
          super_admin_serial?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_origin_country_id_fkey"
            columns: ["origin_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_origin_country_id_fkey"
            columns: ["origin_country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "goods_original_language_code_fkey"
            columns: ["original_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      goods_variations: {
        Row: {
          brand: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          goods_id: string
          id: string
          is_active: boolean
          size: string
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          goods_id: string
          id?: string
          is_active?: boolean
          size: string
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          goods_id?: string
          id?: string
          is_active?: boolean
          size?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_variations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_variations_goods_id_fkey"
            columns: ["goods_id"]
            isOneToOne: false
            referencedRelation: "goods"
            referencedColumns: ["id"]
          },
        ]
      }
      import_truck_loadings: {
        Row: {
          border_crossing: string | null
          branch_serial: string | null
          city_branch_id: string | null
          clearing_agent: string | null
          country_branch_id: string | null
          country_id: string | null
          country_of_origin: string | null
          country_serial: string | null
          created_at: string
          created_by: string | null
          customs_office: string | null
          deleted_at: string | null
          dest_city_id: string | null
          dest_country_id: string | null
          dest_district_id: string | null
          dest_state_province_id: string | null
          destination_country: string | null
          driver_mobile: string | null
          driver_name: string | null
          entry_serial: string | null
          goods_name: string | null
          id: string
          import_bill_number: string | null
          import_date: string
          import_serial: string | null
          importer_name: string | null
          is_active: boolean
          quantity: number | null
          remarks: string | null
          status: string
          super_admin_serial: string | null
          supplier_name: string | null
          truck_id: string | null
          truck_number: string | null
          truck_type: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          border_crossing?: string | null
          branch_serial?: string | null
          city_branch_id?: string | null
          clearing_agent?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_of_origin?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          customs_office?: string | null
          deleted_at?: string | null
          dest_city_id?: string | null
          dest_country_id?: string | null
          dest_district_id?: string | null
          dest_state_province_id?: string | null
          destination_country?: string | null
          driver_mobile?: string | null
          driver_name?: string | null
          entry_serial?: string | null
          goods_name?: string | null
          id?: string
          import_bill_number?: string | null
          import_date?: string
          import_serial?: string | null
          importer_name?: string | null
          is_active?: boolean
          quantity?: number | null
          remarks?: string | null
          status?: string
          super_admin_serial?: string | null
          supplier_name?: string | null
          truck_id?: string | null
          truck_number?: string | null
          truck_type?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          border_crossing?: string | null
          branch_serial?: string | null
          city_branch_id?: string | null
          clearing_agent?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_of_origin?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          customs_office?: string | null
          deleted_at?: string | null
          dest_city_id?: string | null
          dest_country_id?: string | null
          dest_district_id?: string | null
          dest_state_province_id?: string | null
          destination_country?: string | null
          driver_mobile?: string | null
          driver_name?: string | null
          entry_serial?: string | null
          goods_name?: string | null
          id?: string
          import_bill_number?: string | null
          import_date?: string
          import_serial?: string | null
          importer_name?: string | null
          is_active?: boolean
          quantity?: number | null
          remarks?: string | null
          status?: string
          super_admin_serial?: string | null
          supplier_name?: string | null
          truck_id?: string | null
          truck_number?: string | null
          truck_type?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_truck_loadings_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_truck_loadings_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_truck_loadings_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_truck_loadings_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "import_truck_loadings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_truck_loadings_dest_city_id_fkey"
            columns: ["dest_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_truck_loadings_dest_country_id_fkey"
            columns: ["dest_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_truck_loadings_dest_country_id_fkey"
            columns: ["dest_country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "import_truck_loadings_dest_district_id_fkey"
            columns: ["dest_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_truck_loadings_dest_state_province_id_fkey"
            columns: ["dest_state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_truck_loadings_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_branch_ledger_transfers: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          country_company_profile_id: string | null
          country_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          destination_city_branch_id: string | null
          destination_country_branch_id: string | null
          destination_ledger_id: string
          exchange_rate: number
          id: string
          ledger_posting_batch_id: string | null
          posted_at: string | null
          reference_no: string | null
          remarks: string | null
          source_city_branch_id: string | null
          source_country_branch_id: string | null
          source_ledger_id: string
          status: string
          transfer_no: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          country_company_profile_id?: string | null
          country_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          deleted_at?: string | null
          destination_city_branch_id?: string | null
          destination_country_branch_id?: string | null
          destination_ledger_id: string
          exchange_rate?: number
          id?: string
          ledger_posting_batch_id?: string | null
          posted_at?: string | null
          reference_no?: string | null
          remarks?: string | null
          source_city_branch_id?: string | null
          source_country_branch_id?: string | null
          source_ledger_id: string
          status?: string
          transfer_no: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          country_company_profile_id?: string | null
          country_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          destination_city_branch_id?: string | null
          destination_country_branch_id?: string | null
          destination_ledger_id?: string
          exchange_rate?: number
          id?: string
          ledger_posting_batch_id?: string | null
          posted_at?: string | null
          reference_no?: string | null
          remarks?: string | null
          source_city_branch_id?: string | null
          source_country_branch_id?: string | null
          source_ledger_id?: string
          status?: string
          transfer_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_branch_ledger_transfers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_country_company_profile_id_fkey"
            columns: ["country_company_profile_id"]
            isOneToOne: false
            referencedRelation: "country_company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_destination_city_branch_id_fkey"
            columns: ["destination_city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_destination_country_branch_i_fkey"
            columns: ["destination_country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_destination_ledger_id_fkey"
            columns: ["destination_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_destination_ledger_id_fkey"
            columns: ["destination_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_ledger_posting_batch_id_fkey"
            columns: ["ledger_posting_batch_id"]
            isOneToOne: false
            referencedRelation: "branch_ledger_transaction_report"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_ledger_posting_batch_id_fkey"
            columns: ["ledger_posting_batch_id"]
            isOneToOne: false
            referencedRelation: "ledger_posting_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_source_city_branch_id_fkey"
            columns: ["source_city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_source_country_branch_id_fkey"
            columns: ["source_country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_source_ledger_id_fkey"
            columns: ["source_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_branch_ledger_transfers_source_ledger_id_fkey"
            columns: ["source_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          branch_id: string | null
          branch_serial: string | null
          company_id: string
          country_serial: string | null
          created_at: string
          deleted_at: string | null
          entry_date: string
          entry_no: string
          entry_serial: string | null
          id: string
          memo: string | null
          posted_at: string | null
          posted_by: string | null
          source_id: string | null
          source_type: string
          status: Database["public"]["Enums"]["document_status"]
          super_admin_serial: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          branch_serial?: string | null
          company_id: string
          country_serial?: string | null
          created_at?: string
          deleted_at?: string | null
          entry_date: string
          entry_no: string
          entry_serial?: string | null
          id?: string
          memo?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_id?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["document_status"]
          super_admin_serial?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          branch_serial?: string | null
          company_id?: string
          country_serial?: string | null
          created_at?: string
          deleted_at?: string | null
          entry_date?: string
          entry_no?: string
          entry_serial?: string | null
          id?: string
          memo?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_id?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["document_status"]
          super_admin_serial?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_reversals: {
        Row: {
          approval_request_id: string | null
          created_at: string
          id: string
          original_journal_entry_id: string
          reason: string
          reversal_journal_entry_id: string
          reversed_at: string
          reversed_by: string | null
        }
        Insert: {
          approval_request_id?: string | null
          created_at?: string
          id?: string
          original_journal_entry_id: string
          reason: string
          reversal_journal_entry_id: string
          reversed_at?: string
          reversed_by?: string | null
        }
        Update: {
          approval_request_id?: string | null
          created_at?: string
          id?: string
          original_journal_entry_id?: string
          reason?: string
          reversal_journal_entry_id?: string
          reversed_at?: string
          reversed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_reversals_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_reversals_original_journal_entry_id_fkey"
            columns: ["original_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_reversals_reversal_journal_entry_id_fkey"
            columns: ["reversal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_reversals_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          created_at: string
          direction: Database["public"]["Enums"]["language_direction"]
          english_name: string
          is_active: boolean
          is_default: boolean
          native_name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          direction: Database["public"]["Enums"]["language_direction"]
          english_name: string
          is_active?: boolean
          is_default?: boolean
          native_name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["language_direction"]
          english_name?: string
          is_active?: boolean
          is_default?: boolean
          native_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ledger_balances: {
        Row: {
          balance_date: string
          closing_balance: number
          created_at: string
          credit_total: number
          debit_total: number
          id: string
          ledger_id: string
          opening_balance: number
          updated_at: string
        }
        Insert: {
          balance_date: string
          closing_balance?: number
          created_at?: string
          credit_total?: number
          debit_total?: number
          id?: string
          ledger_id: string
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          balance_date?: string
          closing_balance?: number
          created_at?: string
          credit_total?: number
          debit_total?: number
          id?: string
          ledger_id?: string
          opening_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_balances_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_balances_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          amount: number
          base_amount: number
          branch_id: string | null
          branch_serial: string | null
          company_id: string
          country_serial: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          direction: Database["public"]["Enums"]["ledger_direction"]
          entry_date: string
          entry_serial: string | null
          exchange_rate: number
          id: string
          journal_entry_id: string
          journal_line_id: string
          super_admin_serial: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          base_amount: number
          branch_id?: string | null
          branch_serial?: string | null
          company_id: string
          country_serial?: string | null
          created_at?: string
          currency: string
          deleted_at?: string | null
          direction: Database["public"]["Enums"]["ledger_direction"]
          entry_date: string
          entry_serial?: string | null
          exchange_rate?: number
          id?: string
          journal_entry_id: string
          journal_line_id: string
          super_admin_serial?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          base_amount?: number
          branch_id?: string | null
          branch_serial?: string | null
          company_id?: string
          country_serial?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          direction?: Database["public"]["Enums"]["ledger_direction"]
          entry_date?: string
          entry_serial?: string | null
          exchange_rate?: number
          id?: string
          journal_entry_id?: string
          journal_line_id?: string
          super_admin_serial?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_journal_line_id_fkey"
            columns: ["journal_line_id"]
            isOneToOne: false
            referencedRelation: "journal_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_opening_balances: {
        Row: {
          approval_request_id: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          financial_period_id: string
          id: string
          ledger_id: string
          opening_balance: number
          posted_at: string
        }
        Insert: {
          approval_request_id?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          deleted_at?: string | null
          financial_period_id: string
          id?: string
          ledger_id: string
          opening_balance?: number
          posted_at?: string
        }
        Update: {
          approval_request_id?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          financial_period_id?: string
          id?: string
          ledger_id?: string
          opening_balance?: number
          posted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_opening_balances_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_opening_balances_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_opening_balances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_opening_balances_financial_period_id_fkey"
            columns: ["financial_period_id"]
            isOneToOne: false
            referencedRelation: "financial_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_opening_balances_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_opening_balances_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_posting_batches: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          branch_name_snapshot: string | null
          city_branch_id: string | null
          country_branch_id: string | null
          country_company_profile_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          destination_city_branch_id: string | null
          destination_country_branch_id: string | null
          entry_date: string
          id: string
          modification_history: Json
          narration: string | null
          posted_at: string
          reference_no: string | null
          scope: Database["public"]["Enums"]["ledger_scope"]
          source_city_branch_id: string | null
          source_country_branch_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          transaction_type: string
          updated_at: string
          user_name_snapshot: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          branch_name_snapshot?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_company_profile_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          destination_city_branch_id?: string | null
          destination_country_branch_id?: string | null
          entry_date: string
          id?: string
          modification_history?: Json
          narration?: string | null
          posted_at?: string
          reference_no?: string | null
          scope: Database["public"]["Enums"]["ledger_scope"]
          source_city_branch_id?: string | null
          source_country_branch_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          transaction_type?: string
          updated_at?: string
          user_name_snapshot?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          branch_name_snapshot?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_company_profile_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          destination_city_branch_id?: string | null
          destination_country_branch_id?: string | null
          entry_date?: string
          id?: string
          modification_history?: Json
          narration?: string | null
          posted_at?: string
          reference_no?: string | null
          scope?: Database["public"]["Enums"]["ledger_scope"]
          source_city_branch_id?: string | null
          source_country_branch_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          transaction_type?: string
          updated_at?: string
          user_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_posting_batches_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_country_company_profile_id_fkey"
            columns: ["country_company_profile_id"]
            isOneToOne: false
            referencedRelation: "country_company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_destination_city_branch_id_fkey"
            columns: ["destination_city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_destination_country_branch_id_fkey"
            columns: ["destination_country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_source_city_branch_id_fkey"
            columns: ["source_city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_source_country_branch_id_fkey"
            columns: ["source_country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_posting_lines: {
        Row: {
          account_id: string | null
          account_number: string | null
          batch_id: string
          branch_name_snapshot: string | null
          branch_serial_number: string | null
          country_serial_number: string | null
          created_at: string
          credit: number
          currency: string
          customer_number: string | null
          debit: number
          description: string | null
          enterprise_account_id: string | null
          id: string
          ledger_id: string
          ledger_name_snapshot: string | null
          manual_reference_number: string | null
          reference_no_snapshot: string | null
          remarks: string | null
          usd_amount: number
          usd_rate: number
          user_name_snapshot: string | null
        }
        Insert: {
          account_id?: string | null
          account_number?: string | null
          batch_id: string
          branch_name_snapshot?: string | null
          branch_serial_number?: string | null
          country_serial_number?: string | null
          created_at?: string
          credit?: number
          currency: string
          customer_number?: string | null
          debit?: number
          description?: string | null
          enterprise_account_id?: string | null
          id?: string
          ledger_id: string
          ledger_name_snapshot?: string | null
          manual_reference_number?: string | null
          reference_no_snapshot?: string | null
          remarks?: string | null
          usd_amount?: number
          usd_rate?: number
          user_name_snapshot?: string | null
        }
        Update: {
          account_id?: string | null
          account_number?: string | null
          batch_id?: string
          branch_name_snapshot?: string | null
          branch_serial_number?: string | null
          country_serial_number?: string | null
          created_at?: string
          credit?: number
          currency?: string
          customer_number?: string | null
          debit?: number
          description?: string | null
          enterprise_account_id?: string | null
          id?: string
          ledger_id?: string
          ledger_name_snapshot?: string | null
          manual_reference_number?: string | null
          reference_no_snapshot?: string | null
          remarks?: string | null
          usd_amount?: number
          usd_rate?: number
          user_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_posting_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "branch_ledger_transaction_report"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "ledger_posting_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ledger_posting_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_lines_enterprise_account_id_fkey"
            columns: ["enterprise_account_id"]
            isOneToOne: false
            referencedRelation: "enterprise_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_lines_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_lines_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transaction_audit_trail: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          city_branch_id: string | null
          country_branch_id: string | null
          country_company_profile_id: string | null
          country_id: string | null
          created_at: string
          id: string
          inter_branch_transfer_id: string | null
          ledger_id: string | null
          ledger_posting_batch_id: string | null
          ledger_posting_line_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_company_profile_id?: string | null
          country_id?: string | null
          created_at?: string
          id?: string
          inter_branch_transfer_id?: string | null
          ledger_id?: string | null
          ledger_posting_batch_id?: string | null
          ledger_posting_line_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_company_profile_id?: string | null
          country_id?: string | null
          created_at?: string
          id?: string
          inter_branch_transfer_id?: string | null
          ledger_id?: string | null
          ledger_posting_batch_id?: string | null
          ledger_posting_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transaction_audit_trail_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_country_company_profile_id_fkey"
            columns: ["country_company_profile_id"]
            isOneToOne: false
            referencedRelation: "country_company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_inter_branch_transfer_id_fkey"
            columns: ["inter_branch_transfer_id"]
            isOneToOne: false
            referencedRelation: "inter_branch_ledger_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_ledger_posting_batch_id_fkey"
            columns: ["ledger_posting_batch_id"]
            isOneToOne: false
            referencedRelation: "branch_ledger_transaction_report"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_ledger_posting_batch_id_fkey"
            columns: ["ledger_posting_batch_id"]
            isOneToOne: false
            referencedRelation: "ledger_posting_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_ledger_posting_line_id_fkey"
            columns: ["ledger_posting_line_id"]
            isOneToOne: false
            referencedRelation: "branch_ledger_transaction_report"
            referencedColumns: ["line_id"]
          },
          {
            foreignKeyName: "ledger_transaction_audit_trail_ledger_posting_line_id_fkey"
            columns: ["ledger_posting_line_id"]
            isOneToOne: false
            referencedRelation: "ledger_posting_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ledgers: {
        Row: {
          account_id: string | null
          city_branch_id: string | null
          code: string
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          credit_total: number
          currency: string
          current_balance: number
          debit_total: number
          deleted_at: string | null
          enterprise_account_id: string | null
          id: string
          is_active: boolean
          name: string
          normal_balance: Database["public"]["Enums"]["ledger_direction"]
          opening_balance: number
          parent_ledger_id: string | null
          scope: Database["public"]["Enums"]["ledger_scope"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          city_branch_id?: string | null
          code: string
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_total?: number
          currency: string
          current_balance?: number
          debit_total?: number
          deleted_at?: string | null
          enterprise_account_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          normal_balance?: Database["public"]["Enums"]["ledger_direction"]
          opening_balance?: number
          parent_ledger_id?: string | null
          scope: Database["public"]["Enums"]["ledger_scope"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          city_branch_id?: string | null
          code?: string
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_total?: number
          currency?: string
          current_balance?: number
          debit_total?: number
          deleted_at?: string | null
          enterprise_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          normal_balance?: Database["public"]["Enums"]["ledger_direction"]
          opening_balance?: number
          parent_ledger_id?: string | null
          scope?: Database["public"]["Enums"]["ledger_scope"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledgers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "ledgers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_enterprise_account_id_fkey"
            columns: ["enterprise_account_id"]
            isOneToOne: false
            referencedRelation: "enterprise_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_parent_ledger_id_fkey"
            columns: ["parent_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_parent_ledger_id_fkey"
            columns: ["parent_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      local_applied_migrations: {
        Row: {
          applied_at: string | null
          filename: string | null
          id: number
        }
        Insert: {
          applied_at?: string | null
          filename?: string | null
          id?: number
        }
        Update: {
          applied_at?: string | null
          filename?: string | null
          id?: number
        }
        Relationships: []
      }
      local_purchases: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          advance_amount: number | null
          advance_percentage: number | null
          apply_tax: string | null
          branch_serial: string | null
          branch_serial_no: string | null
          brand: string | null
          broker_account_no: string | null
          chassis_code: string | null
          city_branch_id: string | null
          company_id: string | null
          country_branch_id: string | null
          country_id: string | null
          country_serial: string | null
          country_serial_no: string | null
          created_at: string
          created_by: string | null
          credit_journal_serial: string | null
          debit_journal_serial: string | null
          deleted_at: string | null
          divide_kgs: number
          driver_name: string | null
          empty_kgs: number
          entry_serial: string | null
          exchange_rate: number
          final_cost: number
          goods_id: string | null
          goods_name: string
          id: string
          journal_entry_id: string | null
          journal_serial_no: string | null
          local_currency: string
          lot_no: string | null
          manual_bill_no: string | null
          net_weight: number
          numbers: number
          origin_country_id: string | null
          origin_country_name: string | null
          payment_mode: string | null
          purchase_account_no: string | null
          purchase_cost: number
          purchase_currency: string
          purchase_rate: number
          quantity_kgs: number
          quantity_name: string
          rate_type: string
          remaining_balance: number | null
          roznamcha_entry_id: string | null
          sales_account_no: string | null
          shipping_mode: string | null
          size: string | null
          status: string
          super_admin_serial: string | null
          supplier_name: string | null
          tax_amount: number | null
          tax_percentage: number | null
          tax_type: string | null
          total_gross_weight: number
          transfer_date: string | null
          transferred_at: string | null
          truck_no: string | null
          updated_at: string
          warehouse_name: string | null
          warehouse_plot_no: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          advance_amount?: number | null
          advance_percentage?: number | null
          apply_tax?: string | null
          branch_serial?: string | null
          branch_serial_no?: string | null
          brand?: string | null
          broker_account_no?: string | null
          chassis_code?: string | null
          city_branch_id?: string | null
          company_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          country_serial_no?: string | null
          created_at?: string
          created_by?: string | null
          credit_journal_serial?: string | null
          debit_journal_serial?: string | null
          deleted_at?: string | null
          divide_kgs?: number
          driver_name?: string | null
          empty_kgs?: number
          entry_serial?: string | null
          exchange_rate?: number
          final_cost?: number
          goods_id?: string | null
          goods_name: string
          id?: string
          journal_entry_id?: string | null
          journal_serial_no?: string | null
          local_currency?: string
          lot_no?: string | null
          manual_bill_no?: string | null
          net_weight?: number
          numbers?: number
          origin_country_id?: string | null
          origin_country_name?: string | null
          payment_mode?: string | null
          purchase_account_no?: string | null
          purchase_cost?: number
          purchase_currency?: string
          purchase_rate?: number
          quantity_kgs?: number
          quantity_name?: string
          rate_type?: string
          remaining_balance?: number | null
          roznamcha_entry_id?: string | null
          sales_account_no?: string | null
          shipping_mode?: string | null
          size?: string | null
          status?: string
          super_admin_serial?: string | null
          supplier_name?: string | null
          tax_amount?: number | null
          tax_percentage?: number | null
          tax_type?: string | null
          total_gross_weight?: number
          transfer_date?: string | null
          transferred_at?: string | null
          truck_no?: string | null
          updated_at?: string
          warehouse_name?: string | null
          warehouse_plot_no?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          advance_amount?: number | null
          advance_percentage?: number | null
          apply_tax?: string | null
          branch_serial?: string | null
          branch_serial_no?: string | null
          brand?: string | null
          broker_account_no?: string | null
          chassis_code?: string | null
          city_branch_id?: string | null
          company_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          country_serial_no?: string | null
          created_at?: string
          created_by?: string | null
          credit_journal_serial?: string | null
          debit_journal_serial?: string | null
          deleted_at?: string | null
          divide_kgs?: number
          driver_name?: string | null
          empty_kgs?: number
          entry_serial?: string | null
          exchange_rate?: number
          final_cost?: number
          goods_id?: string | null
          goods_name?: string
          id?: string
          journal_entry_id?: string | null
          journal_serial_no?: string | null
          local_currency?: string
          lot_no?: string | null
          manual_bill_no?: string | null
          net_weight?: number
          numbers?: number
          origin_country_id?: string | null
          origin_country_name?: string | null
          payment_mode?: string | null
          purchase_account_no?: string | null
          purchase_cost?: number
          purchase_currency?: string
          purchase_rate?: number
          quantity_kgs?: number
          quantity_name?: string
          rate_type?: string
          remaining_balance?: number | null
          roznamcha_entry_id?: string | null
          sales_account_no?: string | null
          shipping_mode?: string | null
          size?: string | null
          status?: string
          super_admin_serial?: string | null
          supplier_name?: string | null
          tax_amount?: number | null
          tax_percentage?: number | null
          tax_type?: string | null
          total_gross_weight?: number
          transfer_date?: string | null
          transferred_at?: string | null
          truck_no?: string | null
          updated_at?: string
          warehouse_name?: string | null
          warehouse_plot_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_purchases_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_purchases_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_purchases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_purchases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "local_purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_purchases_goods_id_fkey"
            columns: ["goods_id"]
            isOneToOne: false
            referencedRelation: "goods"
            referencedColumns: ["id"]
          },
        ]
      }
      management_categories: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      management_parameter_values: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          metadata: Json
          parameter_id: string
          parent_value_id: string | null
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          parameter_id: string
          parent_value_id?: string | null
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          parameter_id?: string
          parent_value_id?: string | null
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_parameter_values_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_parameter_values_parameter_id_fkey"
            columns: ["parameter_id"]
            isOneToOne: false
            referencedRelation: "management_parameters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_parameter_values_parent_value_id_fkey"
            columns: ["parent_value_id"]
            isOneToOne: false
            referencedRelation: "management_parameter_values"
            referencedColumns: ["id"]
          },
        ]
      }
      management_parameters: {
        Row: {
          category_id: string
          code: string
          created_at: string
          data_type: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          code: string
          created_at?: string
          data_type?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          code?: string
          created_at?: string
          data_type?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_parameters_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "management_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          role_id: string
          scope: Database["public"]["Enums"]["branch_scope"]
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          role_id: string
          scope?: Database["public"]["Enums"]["branch_scope"]
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          role_id?: string
          scope?: Database["public"]["Enums"]["branch_scope"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      module_audit_rules: {
        Row: {
          action: string
          created_at: string
          id: string
          module_id: string
          requires_approval: boolean
          updated_at: string
          writes_audit: boolean
          writes_ledger: boolean
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          module_id: string
          requires_approval?: boolean
          updated_at?: string
          writes_audit?: boolean
          writes_ledger?: boolean
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          module_id?: string
          requires_approval?: boolean
          updated_at?: string
          writes_audit?: boolean
          writes_ledger?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "module_audit_rules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "erp_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_dependencies: {
        Row: {
          depends_on_module_id: string
          module_id: string
        }
        Insert: {
          depends_on_module_id: string
          module_id: string
        }
        Update: {
          depends_on_module_id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_dependencies_depends_on_module_id_fkey"
            columns: ["depends_on_module_id"]
            isOneToOne: false
            referencedRelation: "erp_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_dependencies_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "erp_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_number_sequences: {
        Row: {
          city_branch_id: string | null
          country_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          module_id: string
          next_number: number
          padding: number
          prefix: string
          sequence_key: string
          updated_at: string
        }
        Insert: {
          city_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          module_id: string
          next_number?: number
          padding?: number
          prefix: string
          sequence_key: string
          updated_at?: string
        }
        Update: {
          city_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          module_id?: string
          next_number?: number
          padding?: number
          prefix?: string
          sequence_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_number_sequences_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_number_sequences_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_number_sequences_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "module_number_sequences_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "erp_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_settings: {
        Row: {
          created_at: string
          id: string
          module_id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_settings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "erp_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      money_exchange_entries: {
        Row: {
          account_no: string | null
          branch_id: string
          branch_serial: string | null
          country_serial: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          details: string | null
          entry_date: string
          entry_serial: string | null
          ex_currency: string
          final_amount: number
          id: string
          mobile: string | null
          operation: string
          profit_base_currency: number
          purchase_city: string | null
          purchase_country: string | null
          purchased_from: string | null
          qty_currency: string
          quantity: number
          rate: number
          receipt_name: string | null
          received_city: string | null
          received_country: string | null
          received_from: string | null
          received_office_name: string | null
          received_office_numbers: string | null
          received_type: string | null
          serial_no: string
          super_admin_serial: string | null
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          account_no?: string | null
          branch_id: string
          branch_serial?: string | null
          country_serial?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          details?: string | null
          entry_date: string
          entry_serial?: string | null
          ex_currency: string
          final_amount?: number
          id?: string
          mobile?: string | null
          operation: string
          profit_base_currency?: number
          purchase_city?: string | null
          purchase_country?: string | null
          purchased_from?: string | null
          qty_currency: string
          quantity?: number
          rate?: number
          receipt_name?: string | null
          received_city?: string | null
          received_country?: string | null
          received_from?: string | null
          received_office_name?: string | null
          received_office_numbers?: string | null
          received_type?: string | null
          serial_no: string
          super_admin_serial?: string | null
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          account_no?: string | null
          branch_id?: string
          branch_serial?: string | null
          country_serial?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          details?: string | null
          entry_date?: string
          entry_serial?: string | null
          ex_currency?: string
          final_amount?: number
          id?: string
          mobile?: string | null
          operation?: string
          profit_base_currency?: number
          purchase_city?: string | null
          purchase_country?: string | null
          purchased_from?: string | null
          qty_currency?: string
          quantity?: number
          rate?: number
          receipt_name?: string | null
          received_city?: string | null
          received_country?: string | null
          received_from?: string | null
          received_office_name?: string | null
          received_office_numbers?: string | null
          received_type?: string | null
          serial_no?: string
          super_admin_serial?: string | null
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      "nex.js": {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      office_documents: {
        Row: {
          category: string | null
          city_branch_id: string | null
          city_branch_name: string | null
          company_code: string | null
          company_id: string | null
          company_name: string | null
          country_branch_id: string | null
          country_id: string | null
          country_name: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          account_code: string | null
          account_id: string | null
          account_name: string | null
          main_branch_name: string | null
          metadata: Json | null
          module_type: string
          person_account_code: string | null
          person_account_id: string | null
          person_account_name: string | null
          person_account_type: string | null
          scanned_at: string | null
          source_module: string | null
          source_record_id: string | null
          source_record_no: string | null
          document_path: string | null
          storage_key: string | null
          tags: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          city_branch_id?: string | null
          city_branch_name?: string | null
          company_code?: string | null
          company_id?: string | null
          company_name?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          account_code?: string | null
          account_id?: string | null
          account_name?: string | null
          main_branch_name?: string | null
          metadata?: Json | null
          module_type?: string
          person_account_code?: string | null
          person_account_id?: string | null
          person_account_name?: string | null
          person_account_type?: string | null
          scanned_at?: string | null
          source_module?: string | null
          source_record_id?: string | null
          source_record_no?: string | null
          document_path?: string | null
          storage_key?: string | null
          tags?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          city_branch_id?: string | null
          city_branch_name?: string | null
          company_code?: string | null
          company_id?: string | null
          company_name?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          account_code?: string | null
          account_id?: string | null
          account_name?: string | null
          main_branch_name?: string | null
          metadata?: Json | null
          module_type?: string
          person_account_code?: string | null
          person_account_id?: string | null
          person_account_name?: string | null
          person_account_type?: string | null
          scanned_at?: string | null
          source_module?: string | null
          source_record_id?: string | null
          source_record_no?: string | null
          document_path?: string | null
          storage_key?: string | null
          tags?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      parent_business_groups: {
        Row: {
          address: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          contact_information: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          is_default: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          contact_information?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          contact_information?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_business_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          is_bank_required: boolean
          is_reference_required: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_bank_required?: boolean
          is_reference_required?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_bank_required?: boolean
          is_reference_required?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          description: string | null
          id: string
          resource: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          description?: string | null
          id?: string
          resource: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          description?: string | null
          id?: string
          resource?: string
        }
        Relationships: []
      }
      ports: {
        Row: {
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          port_code: string | null
          port_name: string
          transport_type: string | null
          updated_at: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          port_code?: string | null
          port_name: string
          transport_type?: string | null
          updated_at?: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          port_code?: string | null
          port_name?: string
          transport_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ports_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ports_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "ports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      postal_codes: {
        Row: {
          accuracy: string | null
          admin1_code: string | null
          admin1_name: string | null
          admin2_code: string | null
          admin2_name: string | null
          admin3_code: string | null
          admin3_name: string | null
          city_id: string | null
          country_code: string
          country_id: string
          created_at: string
          deleted_at: string | null
          district_id: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          place_name: string
          postal_code: string
          source: string
          state_province_id: string | null
          updated_at: string
        }
        Insert: {
          accuracy?: string | null
          admin1_code?: string | null
          admin1_name?: string | null
          admin2_code?: string | null
          admin2_name?: string | null
          admin3_code?: string | null
          admin3_name?: string | null
          city_id?: string | null
          country_code: string
          country_id: string
          created_at?: string
          deleted_at?: string | null
          district_id?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          place_name: string
          postal_code: string
          source?: string
          state_province_id?: string | null
          updated_at?: string
        }
        Update: {
          accuracy?: string | null
          admin1_code?: string | null
          admin1_name?: string | null
          admin2_code?: string | null
          admin2_name?: string | null
          admin3_code?: string | null
          admin3_name?: string | null
          city_id?: string | null
          country_code?: string
          country_id?: string
          created_at?: string
          deleted_at?: string | null
          district_id?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          place_name?: string
          postal_code?: string
          source?: string
          state_province_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "postal_codes_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postal_codes_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postal_codes_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "postal_codes_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postal_codes_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_branch_mapping: {
        Row: {
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          product_id: string
          updated_at: string
        }
        Insert: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          product_id: string
          updated_at?: string
        }
        Update: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_branch_mapping_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_branch_mapping_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_branch_mapping_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_branch_mapping_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "product_branch_mapping_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_branch_mapping_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_brands: {
        Row: {
          brand_code: string | null
          brand_name: string
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          original_language_code: string
          updated_at: string
        }
        Insert: {
          brand_code?: string | null
          brand_name: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          original_language_code?: string
          updated_at?: string
        }
        Update: {
          brand_code?: string | null
          brand_name?: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          original_language_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_brands_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_brands_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "product_brands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_brands_original_language_code_fkey"
            columns: ["original_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_code: string | null
          category_name: string
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          original_language_code: string
          updated_at: string
        }
        Insert: {
          category_code?: string | null
          category_name: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          original_language_code?: string
          updated_at?: string
        }
        Update: {
          category_code?: string | null
          category_name?: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          original_language_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "product_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_original_language_code_fkey"
            columns: ["original_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      product_city_mapping: {
        Row: {
          city_id: string
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          product_id: string
          state_province_id: string | null
          updated_at: string
        }
        Insert: {
          city_id: string
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          product_id: string
          state_province_id?: string | null
          updated_at?: string
        }
        Update: {
          city_id?: string
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          product_id?: string
          state_province_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_city_mapping_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_city_mapping_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_city_mapping_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "product_city_mapping_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_city_mapping_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_city_mapping_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_country_mapping: {
        Row: {
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          product_id: string
          updated_at: string
        }
        Insert: {
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          product_id: string
          updated_at?: string
        }
        Update: {
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_country_mapping_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_country_mapping_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "product_country_mapping_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_country_mapping_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_inventory_balances: {
        Row: {
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string
          id: string
          product_id: string
          quantity_available: number | null
          quantity_on_hand: number
          quantity_reserved: number
          unit_id: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id: string
          id?: string
          product_id: string
          quantity_available?: number | null
          quantity_on_hand?: number
          quantity_reserved?: number
          unit_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string
          id?: string
          product_id?: string
          quantity_available?: number | null
          quantity_on_hand?: number
          quantity_reserved?: number
          unit_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_balances_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_balances_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_balances_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_balances_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "product_inventory_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_balances_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_balances_warehouse_fk"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translations: {
        Row: {
          corrected_at: string | null
          corrected_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_machine_generated: boolean
          language_code: string
          product_brand: string | null
          product_category: string | null
          product_description: string | null
          product_id: string
          product_name: string
          product_specifications: string | null
          updated_at: string
        }
        Insert: {
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_machine_generated?: boolean
          language_code: string
          product_brand?: string | null
          product_category?: string | null
          product_description?: string | null
          product_id: string
          product_name: string
          product_specifications?: string | null
          updated_at?: string
        }
        Update: {
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_machine_generated?: boolean
          language_code?: string
          product_brand?: string | null
          product_category?: string | null
          product_description?: string | null
          product_id?: string
          product_name?: string
          product_specifications?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_translations_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "product_translations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          base_unit_code: string | null
          conversion_factor: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          unit_code: string
          unit_name: string
          updated_at: string
        }
        Insert: {
          base_unit_code?: string | null
          conversion_factor?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          unit_code: string
          unit_name: string
          updated_at?: string
        }
        Update: {
          base_unit_code?: string | null
          conversion_factor?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          unit_code?: string
          unit_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_units_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_warehouse_mapping: {
        Row: {
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          product_id: string
          updated_at: string
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Insert: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          product_id: string
          updated_at?: string
          warehouse_code?: string | null
          warehouse_id?: string | null
          warehouse_name?: string | null
        }
        Update: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          product_id?: string
          updated_at?: string
          warehouse_code?: string | null
          warehouse_id?: string | null
          warehouse_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_warehouse_mapping_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_warehouse_mapping_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_warehouse_mapping_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_warehouse_mapping_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "product_warehouse_mapping_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_warehouse_mapping_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_warehouse_mapping_warehouse_fk"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          branch_serial: string | null
          brand_id: string | null
          category_id: string | null
          city_branch_id: string | null
          city_id: string | null
          country_branch_id: string | null
          country_id: string
          country_serial: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entry_serial: string | null
          hs_code: string | null
          id: string
          image_url: string | null
          is_active: boolean
          origin_country_id: string | null
          original_language_code: string
          product_code: string
          product_description: string | null
          product_name: string
          product_specifications: Json
          size: string | null
          sku: string | null
          state_province_id: string | null
          super_admin_serial: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          branch_serial?: string | null
          brand_id?: string | null
          category_id?: string | null
          city_branch_id?: string | null
          city_id?: string | null
          country_branch_id?: string | null
          country_id: string
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_serial?: string | null
          hs_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          origin_country_id?: string | null
          original_language_code?: string
          product_code: string
          product_description?: string | null
          product_name: string
          product_specifications?: Json
          size?: string | null
          sku?: string | null
          state_province_id?: string | null
          super_admin_serial?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_serial?: string | null
          brand_id?: string | null
          category_id?: string | null
          city_branch_id?: string | null
          city_id?: string | null
          country_branch_id?: string | null
          country_id?: string
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_serial?: string | null
          hs_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          origin_country_id?: string | null
          original_language_code?: string
          product_code?: string
          product_description?: string | null
          product_name?: string
          product_specifications?: Json
          size?: string | null
          sku?: string | null
          state_province_id?: string | null
          super_admin_serial?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_origin_country_id_fkey"
            columns: ["origin_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_origin_country_id_fkey"
            columns: ["origin_country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "products_original_language_code_fkey"
            columns: ["original_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "products_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_company_id: string | null
          deleted_at: string | null
          full_name: string
          id: string
          preferred_language_code: string | null
          raw_password: string | null
          updated_at: string
          user_code: string | null
        }
        Insert: {
          created_at?: string
          default_company_id?: string | null
          deleted_at?: string | null
          full_name: string
          id: string
          preferred_language_code?: string | null
          raw_password?: string | null
          updated_at?: string
          user_code?: string | null
        }
        Update: {
          created_at?: string
          default_company_id?: string | null
          deleted_at?: string | null
          full_name?: string
          id?: string
          preferred_language_code?: string | null
          raw_password?: string | null
          updated_at?: string
          user_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_company_id_fkey"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_preferred_language_fk"
            columns: ["preferred_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      purchase_loading_records: {
        Row: {
          carrier_name: string | null
          city_branch_id: string | null
          container_number: string
          container_type: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          exchange_rate: number
          id: string
          journal_entry_id: string | null
          journal_posted_at: string | null
          journal_posted_by: string | null
          loaded_advance_amount: number
          loaded_advance_local: number
          loaded_at: string | null
          loaded_purchase_amount: number
          loaded_purchase_local: number
          loaded_quantity: number
          loading_location: string | null
          loading_percentage: number
          loading_record_no: string
          loading_status: string
          local_currency: string
          payment_made: number
          posted_to_journal: boolean
          purchase_currency: string
          purchase_order_id: string | null
          purchase_order_no: string | null
          receiving_location: string | null
          remaining_loading_balance: number
          remarks: string | null
          report_payload: Json
          shipment_status: string | null
          total_quantity: number
          updated_at: string
        }
        Insert: {
          carrier_name?: string | null
          city_branch_id?: string | null
          container_number: string
          container_type?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          exchange_rate?: number
          id?: string
          journal_entry_id?: string | null
          journal_posted_at?: string | null
          journal_posted_by?: string | null
          loaded_advance_amount?: number
          loaded_advance_local?: number
          loaded_at?: string | null
          loaded_purchase_amount?: number
          loaded_purchase_local?: number
          loaded_quantity?: number
          loading_location?: string | null
          loading_percentage?: number
          loading_record_no: string
          loading_status?: string
          local_currency?: string
          payment_made?: number
          posted_to_journal?: boolean
          purchase_currency?: string
          purchase_order_id?: string | null
          purchase_order_no?: string | null
          receiving_location?: string | null
          remaining_loading_balance?: number
          remarks?: string | null
          report_payload?: Json
          shipment_status?: string | null
          total_quantity?: number
          updated_at?: string
        }
        Update: {
          carrier_name?: string | null
          city_branch_id?: string | null
          container_number?: string
          container_type?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          exchange_rate?: number
          id?: string
          journal_entry_id?: string | null
          journal_posted_at?: string | null
          journal_posted_by?: string | null
          loaded_advance_amount?: number
          loaded_advance_local?: number
          loaded_at?: string | null
          loaded_purchase_amount?: number
          loaded_purchase_local?: number
          loaded_quantity?: number
          loading_location?: string | null
          loading_percentage?: number
          loading_record_no?: string
          loading_status?: string
          local_currency?: string
          payment_made?: number
          posted_to_journal?: boolean
          purchase_currency?: string
          purchase_order_id?: string | null
          purchase_order_no?: string | null
          receiving_location?: string | null
          remaining_loading_balance?: number
          remarks?: string | null
          report_payload?: Json
          shipment_status?: string | null
          total_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_loading_records_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_loading_records_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_loading_records_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_loading_records_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "purchase_loading_records_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_expenses: {
        Row: {
          amount_local: number
          amount_original: number
          amount_usd: number
          created_at: string
          description: string | null
          exchange_rate: number
          expense_currency: string
          expense_type: string
          id: string
          ledger_id: string | null
          purchase_order_id: string
          updated_at: string
        }
        Insert: {
          amount_local?: number
          amount_original?: number
          amount_usd?: number
          created_at?: string
          description?: string | null
          exchange_rate?: number
          expense_currency?: string
          expense_type: string
          id?: string
          ledger_id?: string | null
          purchase_order_id: string
          updated_at?: string
        }
        Update: {
          amount_local?: number
          amount_original?: number
          amount_usd?: number
          created_at?: string
          description?: string | null
          exchange_rate?: number
          expense_currency?: string
          expense_type?: string
          id?: string
          ledger_id?: string | null
          purchase_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_expenses_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_expenses_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_expenses_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          brand: string | null
          created_at: string
          goods_name: string
          gross_weight: number
          hs_code: string | null
          id: string
          net_weight: number
          origin: string | null
          product_id: string | null
          purchase_order_id: string
          quantity: number
          rate_local: number
          rate_original: number
          rate_usd: number
          size: string | null
          total_local: number
          total_original: number
          total_usd: number
          unit_name: string
          unit_weight: number
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          goods_name: string
          gross_weight?: number
          hs_code?: string | null
          id?: string
          net_weight?: number
          origin?: string | null
          product_id?: string | null
          purchase_order_id: string
          quantity?: number
          rate_local?: number
          rate_original?: number
          rate_usd?: number
          size?: string | null
          total_local?: number
          total_original?: number
          total_usd?: number
          unit_name: string
          unit_weight?: number
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          goods_name?: string
          gross_weight?: number
          hs_code?: string | null
          id?: string
          net_weight?: number
          origin?: string | null
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          rate_local?: number
          rate_original?: number
          rate_usd?: number
          size?: string | null
          total_local?: number
          total_original?: number
          total_usd?: number
          unit_name?: string
          unit_weight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_payments: {
        Row: {
          amount: number
          base_currency_amount: number | null
          branch_serial: string | null
          country_serial: string | null
          created_at: string
          created_by: string | null
          credit_ledger_id: string
          currency_code: string
          currency_name: string | null
          debit_ledger_id: string
          deleted_at: string | null
          entry_date: string
          entry_serial: string | null
          exchange_rate: number
          id: string
          journal_posted_at: string | null
          journal_posted_by: string | null
          kind: Database["public"]["Enums"]["purchase_order_payment_kind"]
          loading_record_id: string | null
          narration: string | null
          original_currency_code: string | null
          posted_to_journal: boolean
          purchase_order_id: string
          reference_no: string | null
          roznamcha_entry_id: string | null
          source_module: string | null
          source_reference_no: string | null
          source_transaction_type: string | null
          status: Database["public"]["Enums"]["document_status"]
          super_admin_serial: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          base_currency_amount?: number | null
          branch_serial?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          credit_ledger_id: string
          currency_code?: string
          currency_name?: string | null
          debit_ledger_id: string
          deleted_at?: string | null
          entry_date: string
          entry_serial?: string | null
          exchange_rate?: number
          id?: string
          journal_posted_at?: string | null
          journal_posted_by?: string | null
          kind: Database["public"]["Enums"]["purchase_order_payment_kind"]
          loading_record_id?: string | null
          narration?: string | null
          original_currency_code?: string | null
          posted_to_journal?: boolean
          purchase_order_id: string
          reference_no?: string | null
          roznamcha_entry_id?: string | null
          source_module?: string | null
          source_reference_no?: string | null
          source_transaction_type?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          super_admin_serial?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          base_currency_amount?: number | null
          branch_serial?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          credit_ledger_id?: string
          currency_code?: string
          currency_name?: string | null
          debit_ledger_id?: string
          deleted_at?: string | null
          entry_date?: string
          entry_serial?: string | null
          exchange_rate?: number
          id?: string
          journal_posted_at?: string | null
          journal_posted_by?: string | null
          kind?: Database["public"]["Enums"]["purchase_order_payment_kind"]
          loading_record_id?: string | null
          narration?: string | null
          original_currency_code?: string | null
          posted_to_journal?: boolean
          purchase_order_id?: string
          reference_no?: string | null
          roznamcha_entry_id?: string | null
          source_module?: string | null
          source_reference_no?: string | null
          source_transaction_type?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          super_admin_serial?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_payments_credit_ledger_id_fkey"
            columns: ["credit_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_payments_credit_ledger_id_fkey"
            columns: ["credit_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_payments_debit_ledger_id_fkey"
            columns: ["debit_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_payments_debit_ledger_id_fkey"
            columns: ["debit_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_payments_loading_record_id_fkey"
            columns: ["loading_record_id"]
            isOneToOne: false
            referencedRelation: "purchase_loading_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_payments_roznamcha_entry_id_fkey"
            columns: ["roznamcha_entry_id"]
            isOneToOne: false
            referencedRelation: "roznamcha_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          advance_paid: number
          branch_serial: string | null
          branch_transaction_serial_number: string | null
          city_branch_id: string | null
          city_branch_transaction_serial: string | null
          country_branch_id: string | null
          country_id: string | null
          country_serial: string | null
          country_transaction_serial_number: string | null
          created_at: string
          created_by: string | null
          credit_amount: number
          currency_code: string
          deleted_at: string | null
          entry_serial: string | null
          exchange_rate: number
          form_data: Json | null
          id: string
          is_edited_since_transfer: boolean | null
          landed_cost_local: number
          landed_cost_original: number
          landed_cost_usd: number
          ledger_posting_status: string
          main_branch_transaction_serial: string | null
          order_total: number
          payment_currency: string
          payment_status: string
          purchase_contract_no: string | null
          purchase_currency: string
          purchase_order_no: string
          remaining_due: number
          remaining_paid: number
          status: string | null
          super_admin_serial: string | null
          super_admin_serial_number: string | null
          supplier_company_id: string | null
          total_expenses_local: number
          total_expenses_original: number
          total_expenses_usd: number
          total_goods_local: number
          total_goods_original: number
          total_goods_usd: number
          updated_at: string
        }
        Insert: {
          advance_paid?: number
          branch_serial?: string | null
          branch_transaction_serial_number?: string | null
          city_branch_id?: string | null
          city_branch_transaction_serial?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          country_transaction_serial_number?: string | null
          created_at?: string
          created_by?: string | null
          credit_amount?: number
          currency_code?: string
          deleted_at?: string | null
          entry_serial?: string | null
          exchange_rate?: number
          form_data?: Json | null
          id?: string
          is_edited_since_transfer?: boolean | null
          landed_cost_local?: number
          landed_cost_original?: number
          landed_cost_usd?: number
          ledger_posting_status?: string
          main_branch_transaction_serial?: string | null
          order_total?: number
          payment_currency?: string
          payment_status?: string
          purchase_contract_no?: string | null
          purchase_currency?: string
          purchase_order_no: string
          remaining_due?: number
          remaining_paid?: number
          status?: string | null
          super_admin_serial?: string | null
          super_admin_serial_number?: string | null
          supplier_company_id?: string | null
          total_expenses_local?: number
          total_expenses_original?: number
          total_expenses_usd?: number
          total_goods_local?: number
          total_goods_original?: number
          total_goods_usd?: number
          updated_at?: string
        }
        Update: {
          advance_paid?: number
          branch_serial?: string | null
          branch_transaction_serial_number?: string | null
          city_branch_id?: string | null
          city_branch_transaction_serial?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          country_transaction_serial_number?: string | null
          created_at?: string
          created_by?: string | null
          credit_amount?: number
          currency_code?: string
          deleted_at?: string | null
          entry_serial?: string | null
          exchange_rate?: number
          form_data?: Json | null
          id?: string
          is_edited_since_transfer?: boolean | null
          landed_cost_local?: number
          landed_cost_original?: number
          landed_cost_usd?: number
          ledger_posting_status?: string
          main_branch_transaction_serial?: string | null
          order_total?: number
          payment_currency?: string
          payment_status?: string
          purchase_contract_no?: string | null
          purchase_currency?: string
          purchase_order_no?: string
          remaining_due?: number
          remaining_paid?: number
          status?: string | null
          super_admin_serial?: string | null
          super_admin_serial_number?: string | null
          supplier_company_id?: string | null
          total_expenses_local?: number
          total_expenses_original?: number
          total_expenses_usd?: number
          total_goods_local?: number
          total_goods_original?: number
          total_goods_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_company_id_fkey"
            columns: ["supplier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      record_change_history: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          approval_request_id: string | null
          before_data: Json | null
          city_branch_id: string | null
          country_id: string | null
          created_at: string
          id: string
          record_id: string
          record_table: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          approval_request_id?: string | null
          before_data?: Json | null
          city_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          id?: string
          record_id: string
          record_table: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          approval_request_id?: string | null
          before_data?: Json | null
          city_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          id?: string
          record_id?: string
          record_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_change_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_change_history_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_change_history_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_change_history_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_change_history_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      record_locks: {
        Row: {
          approval_request_id: string | null
          id: string
          is_active: boolean
          locked_at: string
          locked_by: string | null
          locked_reason: string | null
          record_id: string
          record_table: string
          unlocked_at: string | null
          unlocked_by: string | null
        }
        Insert: {
          approval_request_id?: string | null
          id?: string
          is_active?: boolean
          locked_at?: string
          locked_by?: string | null
          locked_reason?: string | null
          record_id: string
          record_table: string
          unlocked_at?: string | null
          unlocked_by?: string | null
        }
        Update: {
          approval_request_id?: string | null
          id?: string
          is_active?: boolean
          locked_at?: string
          locked_by?: string | null
          locked_reason?: string | null
          record_id?: string
          record_table?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "record_locks_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_locks_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_locks_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      record_translations_legacy: {
        Row: {
          arabic_text: string | null
          corrected_at: string | null
          corrected_by: string | null
          created_at: string
          deleted_at: string | null
          english_text: string | null
          field_name: string
          id: string
          language_texts: Json
          original_language_code: string
          original_text: string
          pashto_text: string | null
          persian_text: string | null
          record_id: string
          record_table: string
          source: Database["public"]["Enums"]["translation_source"]
          translated_at: string
          translated_by_engine: string
          translation_status: string
          updated_at: string
          urdu_text: string | null
        }
        Insert: {
          arabic_text?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          english_text?: string | null
          field_name: string
          id?: string
          language_texts?: Json
          original_language_code: string
          original_text: string
          pashto_text?: string | null
          persian_text?: string | null
          record_id: string
          record_table: string
          source?: Database["public"]["Enums"]["translation_source"]
          translated_at?: string
          translated_by_engine?: string
          translation_status?: string
          updated_at?: string
          urdu_text?: string | null
        }
        Update: {
          arabic_text?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          english_text?: string | null
          field_name?: string
          id?: string
          language_texts?: Json
          original_language_code?: string
          original_text?: string
          pashto_text?: string | null
          persian_text?: string | null
          record_id?: string
          record_table?: string
          source?: Database["public"]["Enums"]["translation_source"]
          translated_at?: string
          translated_by_engine?: string
          translation_status?: string
          updated_at?: string
          urdu_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "record_translations_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_translations_original_language_code_fkey"
            columns: ["original_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      report_definitions: {
        Row: {
          code: string
          created_at: string
          default_currency: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          module_code: string | null
          name: string
          supports_excel: boolean
          supports_pdf: boolean
          supports_print: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          module_code?: string | null
          name: string
          supports_excel?: boolean
          supports_pdf?: boolean
          supports_print?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          module_code?: string | null
          name?: string
          supports_excel?: boolean
          supports_pdf?: boolean
          supports_print?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      report_exports: {
        Row: {
          created_at: string
          created_by: string | null
          export_type: string
          id: string
          report_run_id: string
          storage_bucket: string | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          export_type: string
          id?: string
          report_run_id: string
          storage_bucket?: string | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          export_type?: string
          id?: string
          report_run_id?: string
          storage_bucket?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_exports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_exports_report_run_id_fkey"
            columns: ["report_run_id"]
            isOneToOne: false
            referencedRelation: "report_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          city_branch_id: string | null
          completed_at: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          error_message: string | null
          filters: Json
          id: string
          language_code: string | null
          report_definition_id: string
          requested_by: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["report_run_status"]
        }
        Insert: {
          city_branch_id?: string | null
          completed_at?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          error_message?: string | null
          filters?: Json
          id?: string
          language_code?: string | null
          report_definition_id: string
          requested_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["report_run_status"]
        }
        Update: {
          city_branch_id?: string | null
          completed_at?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          error_message?: string | null
          filters?: Json
          id?: string
          language_code?: string | null
          report_definition_id?: string
          requested_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["report_run_status"]
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "report_runs_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "report_runs_report_definition_id_fkey"
            columns: ["report_definition_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_snapshots: {
        Row: {
          created_at: string
          currency: string
          id: string
          report_run_id: string
          rows: Json
          totals: Json
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          report_run_id: string
          rows?: Json
          totals?: Json
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          report_run_id?: string
          rows?: Json
          totals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "report_snapshots_report_run_id_fkey"
            columns: ["report_run_id"]
            isOneToOne: false
            referencedRelation: "report_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          city_branch_id: string | null
          country_id: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          generated_at: string
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          report_type: string
          totals: Json
        }
        Insert: {
          city_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          report_type: string
          totals?: Json
        }
        Update: {
          city_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          report_type?: string
          totals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reports_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      roznamcha_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          base_currency_amount: number | null
          branch_serial: string | null
          branch_transaction_serial_number: string | null
          city_branch_id: string | null
          city_branch_transaction_serial: string | null
          country_branch_id: string | null
          country_id: string | null
          country_serial: string | null
          country_transaction_serial_number: string | null
          created_at: string
          created_by: string | null
          currency_name: string | null
          deleted_at: string | null
          entry_category: string | null
          entry_date: string
          entry_serial: string | null
          entry_serial_number: string | null
          id: string
          journal_entry_id: string | null
          journal_no: string
          main_branch_transaction_serial: string | null
          narration: string | null
          original_currency_code: string | null
          payment_method_id: string | null
          posted_at: string | null
          reference_no: string | null
          source_module: string | null
          source_reference_no: string | null
          source_transaction_id: string | null
          source_transaction_type: string | null
          status: Database["public"]["Enums"]["document_status"]
          super_admin_serial: string | null
          super_admin_serial_number: string | null
          type: Database["public"]["Enums"]["roznamcha_type"]
          updated_at: string
          voucher_no: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          base_currency_amount?: number | null
          branch_serial?: string | null
          branch_transaction_serial_number?: string | null
          city_branch_id?: string | null
          city_branch_transaction_serial?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          country_transaction_serial_number?: string | null
          created_at?: string
          created_by?: string | null
          currency_name?: string | null
          deleted_at?: string | null
          entry_category?: string | null
          entry_date: string
          entry_serial?: string | null
          entry_serial_number?: string | null
          id?: string
          journal_entry_id?: string | null
          journal_no: string
          main_branch_transaction_serial?: string | null
          narration?: string | null
          original_currency_code?: string | null
          payment_method_id?: string | null
          posted_at?: string | null
          reference_no?: string | null
          source_module?: string | null
          source_reference_no?: string | null
          source_transaction_id?: string | null
          source_transaction_type?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          super_admin_serial?: string | null
          super_admin_serial_number?: string | null
          type: Database["public"]["Enums"]["roznamcha_type"]
          updated_at?: string
          voucher_no: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          base_currency_amount?: number | null
          branch_serial?: string | null
          branch_transaction_serial_number?: string | null
          city_branch_id?: string | null
          city_branch_transaction_serial?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          country_transaction_serial_number?: string | null
          created_at?: string
          created_by?: string | null
          currency_name?: string | null
          deleted_at?: string | null
          entry_category?: string | null
          entry_date?: string
          entry_serial?: string | null
          entry_serial_number?: string | null
          id?: string
          journal_entry_id?: string | null
          journal_no?: string
          main_branch_transaction_serial?: string | null
          narration?: string | null
          original_currency_code?: string | null
          payment_method_id?: string | null
          posted_at?: string | null
          reference_no?: string | null
          source_module?: string | null
          source_reference_no?: string | null
          source_transaction_id?: string | null
          source_transaction_type?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          super_admin_serial?: string | null
          super_admin_serial_number?: string | null
          type?: Database["public"]["Enums"]["roznamcha_type"]
          updated_at?: string
          voucher_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "roznamcha_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_entries_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_entries_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_entries_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_entries_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "roznamcha_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_entries_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      roznamcha_lines: {
        Row: {
          account_id: string | null
          account_number: string | null
          branch_serial_number: string | null
          branch_transaction_serial_number: string | null
          city_branch_transaction_serial: string | null
          country_serial_number: string | null
          country_transaction_serial_number: string | null
          credit: number
          currency: string
          customer_number: string | null
          debit: number
          description: string | null
          enterprise_account_id: string | null
          entry_serial_number: string | null
          id: string
          ledger_id: string | null
          main_branch_transaction_serial: string | null
          manual_reference_number: string | null
          payment_entry_type: Database["public"]["Enums"]["payment_entry_type"]
          roznamcha_entry_id: string
          super_admin_serial_number: string | null
          usd_amount: number
          usd_rate: number
        }
        Insert: {
          account_id?: string | null
          account_number?: string | null
          branch_serial_number?: string | null
          branch_transaction_serial_number?: string | null
          city_branch_transaction_serial?: string | null
          country_serial_number?: string | null
          country_transaction_serial_number?: string | null
          credit?: number
          currency: string
          customer_number?: string | null
          debit?: number
          description?: string | null
          enterprise_account_id?: string | null
          entry_serial_number?: string | null
          id?: string
          ledger_id?: string | null
          main_branch_transaction_serial?: string | null
          manual_reference_number?: string | null
          payment_entry_type: Database["public"]["Enums"]["payment_entry_type"]
          roznamcha_entry_id: string
          super_admin_serial_number?: string | null
          usd_amount?: number
          usd_rate?: number
        }
        Update: {
          account_id?: string | null
          account_number?: string | null
          branch_serial_number?: string | null
          branch_transaction_serial_number?: string | null
          city_branch_transaction_serial?: string | null
          country_serial_number?: string | null
          country_transaction_serial_number?: string | null
          credit?: number
          currency?: string
          customer_number?: string | null
          debit?: number
          description?: string | null
          enterprise_account_id?: string | null
          entry_serial_number?: string | null
          id?: string
          ledger_id?: string | null
          main_branch_transaction_serial?: string | null
          manual_reference_number?: string | null
          payment_entry_type?: Database["public"]["Enums"]["payment_entry_type"]
          roznamcha_entry_id?: string
          super_admin_serial_number?: string | null
          usd_amount?: number
          usd_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "roznamcha_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_lines_enterprise_account_id_fkey"
            columns: ["enterprise_account_id"]
            isOneToOne: false
            referencedRelation: "enterprise_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_lines_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_lines_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_lines_roznamcha_entry_id_fkey"
            columns: ["roznamcha_entry_id"]
            isOneToOne: false
            referencedRelation: "roznamcha_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      roznamcha_reversals: {
        Row: {
          approval_request_id: string | null
          created_at: string
          id: string
          original_roznamcha_entry_id: string
          reason: string
          reversal_roznamcha_entry_id: string
          reversed_at: string
          reversed_by: string | null
        }
        Insert: {
          approval_request_id?: string | null
          created_at?: string
          id?: string
          original_roznamcha_entry_id: string
          reason: string
          reversal_roznamcha_entry_id: string
          reversed_at?: string
          reversed_by?: string | null
        }
        Update: {
          approval_request_id?: string | null
          created_at?: string
          id?: string
          original_roznamcha_entry_id?: string
          reason?: string
          reversal_roznamcha_entry_id?: string
          reversed_at?: string
          reversed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roznamcha_reversals_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_reversals_original_roznamcha_entry_id_fkey"
            columns: ["original_roznamcha_entry_id"]
            isOneToOne: false
            referencedRelation: "roznamcha_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_reversals_reversal_roznamcha_entry_id_fkey"
            columns: ["reversal_roznamcha_entry_id"]
            isOneToOne: false
            referencedRelation: "roznamcha_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roznamcha_reversals_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_payments: {
        Row: {
          account_number: string | null
          amount: number
          branch_serial: string | null
          country_serial: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          customer_number: string | null
          deleted_at: string | null
          entry_serial: string | null
          exchange_rate: number
          id: string
          ledger_posting_batch_id: string | null
          manual_reference_number: string | null
          payment_date: string
          payment_kind: string
          remarks: string | null
          roznamcha_entry_id: string | null
          sales_order_id: string
          status: string
          super_admin_serial: string | null
        }
        Insert: {
          account_number?: string | null
          amount?: number
          branch_serial?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_number?: string | null
          deleted_at?: string | null
          entry_serial?: string | null
          exchange_rate?: number
          id?: string
          ledger_posting_batch_id?: string | null
          manual_reference_number?: string | null
          payment_date?: string
          payment_kind?: string
          remarks?: string | null
          roznamcha_entry_id?: string | null
          sales_order_id: string
          status?: string
          super_admin_serial?: string | null
        }
        Update: {
          account_number?: string | null
          amount?: number
          branch_serial?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_number?: string | null
          deleted_at?: string | null
          entry_serial?: string | null
          exchange_rate?: number
          id?: string
          ledger_posting_batch_id?: string | null
          manual_reference_number?: string | null
          payment_date?: string
          payment_kind?: string
          remarks?: string | null
          roznamcha_entry_id?: string | null
          sales_order_id?: string
          status?: string
          super_admin_serial?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_payments_ledger_posting_batch_id_fkey"
            columns: ["ledger_posting_batch_id"]
            isOneToOne: false
            referencedRelation: "branch_ledger_transaction_report"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "sales_order_payments_ledger_posting_batch_id_fkey"
            columns: ["ledger_posting_batch_id"]
            isOneToOne: false
            referencedRelation: "ledger_posting_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_payments_roznamcha_entry_id_fkey"
            columns: ["roznamcha_entry_id"]
            isOneToOne: false
            referencedRelation: "roznamcha_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_payments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          account_number: string | null
          base_currency_amount: number | null
          branch_serial: string | null
          branch_serial_number: string | null
          branch_transaction_serial_number: string | null
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          country_serial: string | null
          country_serial_number: string | null
          country_transaction_serial_number: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          currency_name: string | null
          customer_account_id: string | null
          customer_ledger_id: string | null
          customer_name: string | null
          customer_number: string | null
          deleted_at: string | null
          delivery_status: string
          entry_serial: string | null
          exchange_rate: number
          form_data: Json
          id: string
          ledger_posting_status: string
          manual_reference_number: string | null
          order_date: string
          order_total: number
          original_currency_code: string | null
          paid_amount: number
          payment_status: string
          product_summary: string | null
          purchase_order_id: string | null
          quantity: number
          remaining_amount: number
          sales_contract_no: string | null
          sales_order_no: string
          sales_status: string
          super_admin_serial: string | null
          super_admin_serial_number: string | null
          total_weight: number
          transfer_date: string | null
          transfer_serial_number: string | null
          transfer_user: string | null
          updated_at: string
          updated_by: string | null
          workflow_state: Json
        }
        Insert: {
          account_number?: string | null
          base_currency_amount?: number | null
          branch_serial?: string | null
          branch_serial_number?: string | null
          branch_transaction_serial_number?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          country_serial_number?: string | null
          country_transaction_serial_number?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          currency_name?: string | null
          customer_account_id?: string | null
          customer_ledger_id?: string | null
          customer_name?: string | null
          customer_number?: string | null
          deleted_at?: string | null
          delivery_status?: string
          entry_serial?: string | null
          exchange_rate?: number
          form_data?: Json
          id?: string
          ledger_posting_status?: string
          manual_reference_number?: string | null
          order_date?: string
          order_total?: number
          original_currency_code?: string | null
          paid_amount?: number
          payment_status?: string
          product_summary?: string | null
          purchase_order_id?: string | null
          quantity?: number
          remaining_amount?: number
          sales_contract_no?: string | null
          sales_order_no: string
          sales_status?: string
          super_admin_serial?: string | null
          super_admin_serial_number?: string | null
          total_weight?: number
          transfer_date?: string | null
          transfer_serial_number?: string | null
          transfer_user?: string | null
          updated_at?: string
          updated_by?: string | null
          workflow_state?: Json
        }
        Update: {
          account_number?: string | null
          base_currency_amount?: number | null
          branch_serial?: string | null
          branch_serial_number?: string | null
          branch_transaction_serial_number?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          country_serial_number?: string | null
          country_transaction_serial_number?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          currency_name?: string | null
          customer_account_id?: string | null
          customer_ledger_id?: string | null
          customer_name?: string | null
          customer_number?: string | null
          deleted_at?: string | null
          delivery_status?: string
          entry_serial?: string | null
          exchange_rate?: number
          form_data?: Json
          id?: string
          ledger_posting_status?: string
          manual_reference_number?: string | null
          order_date?: string
          order_total?: number
          original_currency_code?: string | null
          paid_amount?: number
          payment_status?: string
          product_summary?: string | null
          purchase_order_id?: string | null
          quantity?: number
          remaining_amount?: number
          sales_contract_no?: string | null
          sales_order_no?: string
          sales_status?: string
          super_admin_serial?: string | null
          super_admin_serial_number?: string | null
          total_weight?: number
          transfer_date?: string | null
          transfer_serial_number?: string | null
          transfer_user?: string | null
          updated_at?: string
          updated_by?: string | null
          workflow_state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "enterprise_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_ledger_id_fkey"
            columns: ["customer_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_ledger_id_fkey"
            columns: ["customer_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_documents: {
        Row: {
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_date: string | null
          document_no: string | null
          document_type: string
          file_url: string | null
          id: string
          metadata: Json
          purchase_order_id: string | null
          sales_order_id: string | null
          shipping_bl_record_id: string | null
          shipping_line_record_id: string | null
          status: string
        }
        Insert: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_date?: string | null
          document_no?: string | null
          document_type: string
          file_url?: string | null
          id?: string
          metadata?: Json
          purchase_order_id?: string | null
          sales_order_id?: string | null
          shipping_bl_record_id?: string | null
          shipping_line_record_id?: string | null
          status?: string
        }
        Update: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_date?: string | null
          document_no?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          metadata?: Json
          purchase_order_id?: string | null
          sales_order_id?: string | null
          shipping_bl_record_id?: string | null
          shipping_line_record_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_documents_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "shipment_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_shipping_bl_record_id_fkey"
            columns: ["shipping_bl_record_id"]
            isOneToOne: false
            referencedRelation: "shipping_bl_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_shipping_line_record_id_fkey"
            columns: ["shipping_line_record_id"]
            isOneToOne: false
            referencedRelation: "shipping_line_records"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_bl_records: {
        Row: {
          account_number: string | null
          bl_number: string
          city_branch_id: string | null
          container_number: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          credit: number
          currency_code: string
          debit: number
          deleted_at: string | null
          discharge_port: string | null
          eta: string | null
          etd: string | null
          id: string
          ledger_id: string | null
          loading_port: string | null
          loading_record_id: string | null
          purchase_order_id: string | null
          report_payload: Json
          roznamcha_entry_id: string | null
          sales_order_id: string | null
          shipment_status: string
          shipping_line_name: string
          updated_at: string
          vessel_name: string | null
          voyage_number: string | null
        }
        Insert: {
          account_number?: string | null
          bl_number: string
          city_branch_id?: string | null
          container_number?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number
          currency_code?: string
          debit?: number
          deleted_at?: string | null
          discharge_port?: string | null
          eta?: string | null
          etd?: string | null
          id?: string
          ledger_id?: string | null
          loading_port?: string | null
          loading_record_id?: string | null
          purchase_order_id?: string | null
          report_payload?: Json
          roznamcha_entry_id?: string | null
          sales_order_id?: string | null
          shipment_status?: string
          shipping_line_name: string
          updated_at?: string
          vessel_name?: string | null
          voyage_number?: string | null
        }
        Update: {
          account_number?: string | null
          bl_number?: string
          city_branch_id?: string | null
          container_number?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number
          currency_code?: string
          debit?: number
          deleted_at?: string | null
          discharge_port?: string | null
          eta?: string | null
          etd?: string | null
          id?: string
          ledger_id?: string | null
          loading_port?: string | null
          loading_record_id?: string | null
          purchase_order_id?: string | null
          report_payload?: Json
          roznamcha_entry_id?: string | null
          sales_order_id?: string | null
          shipment_status?: string
          shipping_line_name?: string
          updated_at?: string
          vessel_name?: string | null
          voyage_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_bl_records_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_bl_records_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_bl_records_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_bl_records_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "shipping_bl_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_bl_records_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_bl_records_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_bl_records_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_bl_records_roznamcha_entry_id_fkey"
            columns: ["roznamcha_entry_id"]
            isOneToOne: false
            referencedRelation: "roznamcha_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_line_records: {
        Row: {
          account_id: string | null
          account_number: string | null
          branch_serial_number: string | null
          city_branch_id: string | null
          container_numbers: string[]
          country_branch_id: string | null
          country_id: string | null
          country_serial_number: string | null
          created_at: string
          created_by: string | null
          customer_number: string | null
          deleted_at: string | null
          eta: string | null
          etd: string | null
          form_data: Json
          id: string
          ledger_id: string | null
          manual_reference_number: string | null
          port_of_discharge: string | null
          port_of_loading: string | null
          purchase_order_id: string | null
          sales_order_id: string | null
          shipment_status: string
          shipping_line_name: string
          shipping_reference_no: string | null
          updated_at: string
          updated_by: string | null
          vessel_name: string | null
          voyage_number: string | null
          workflow_state: Json
        }
        Insert: {
          account_id?: string | null
          account_number?: string | null
          branch_serial_number?: string | null
          city_branch_id?: string | null
          container_numbers?: string[]
          country_branch_id?: string | null
          country_id?: string | null
          country_serial_number?: string | null
          created_at?: string
          created_by?: string | null
          customer_number?: string | null
          deleted_at?: string | null
          eta?: string | null
          etd?: string | null
          form_data?: Json
          id?: string
          ledger_id?: string | null
          manual_reference_number?: string | null
          port_of_discharge?: string | null
          port_of_loading?: string | null
          purchase_order_id?: string | null
          sales_order_id?: string | null
          shipment_status?: string
          shipping_line_name: string
          shipping_reference_no?: string | null
          updated_at?: string
          updated_by?: string | null
          vessel_name?: string | null
          voyage_number?: string | null
          workflow_state?: Json
        }
        Update: {
          account_id?: string | null
          account_number?: string | null
          branch_serial_number?: string | null
          city_branch_id?: string | null
          container_numbers?: string[]
          country_branch_id?: string | null
          country_id?: string | null
          country_serial_number?: string | null
          created_at?: string
          created_by?: string | null
          customer_number?: string | null
          deleted_at?: string | null
          eta?: string | null
          etd?: string | null
          form_data?: Json
          id?: string
          ledger_id?: string | null
          manual_reference_number?: string | null
          port_of_discharge?: string | null
          port_of_loading?: string | null
          purchase_order_id?: string | null
          sales_order_id?: string | null
          shipment_status?: string
          shipping_line_name?: string
          shipping_reference_no?: string | null
          updated_at?: string
          updated_by?: string | null
          vessel_name?: string | null
          voyage_number?: string | null
          workflow_state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "shipping_line_records_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "enterprise_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_line_records_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_line_records_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_line_records_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_line_records_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "shipping_line_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_line_records_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_outstanding_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_line_records_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_line_records_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_line_records_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_line_records_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_delete_logs: {
        Row: {
          approval_request_id: string | null
          city_branch_id: string | null
          country_id: string | null
          deleted_at: string
          deleted_by: string | null
          id: string
          reason: string | null
          record_id: string
          record_table: string
          restore_by: string | null
          restored_at: string | null
        }
        Insert: {
          approval_request_id?: string | null
          city_branch_id?: string | null
          country_id?: string | null
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          reason?: string | null
          record_id: string
          record_table: string
          restore_by?: string | null
          restored_at?: string | null
        }
        Update: {
          approval_request_id?: string | null
          city_branch_id?: string | null
          country_id?: string | null
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          reason?: string | null
          record_id?: string
          record_table?: string
          restore_by?: string | null
          restored_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soft_delete_logs_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_delete_logs_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_delete_logs_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_delete_logs_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "soft_delete_logs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_delete_logs_restore_by_fkey"
            columns: ["restore_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      states_provinces: {
        Row: {
          code: string | null
          country_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          phone_area_code: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          country_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone_area_code?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          country_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone_area_code?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "states_provinces_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "states_provinces_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "states_provinces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_codes: {
        Row: {
          country_name: string
          created_at: string
          id: string
          is_active: boolean
          tax_name: string
          tax_pct: number
          updated_at: string
        }
        Insert: {
          country_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          tax_name: string
          tax_pct?: number
          updated_at?: string
        }
        Update: {
          country_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          tax_name?: string
          tax_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      transaction_serial_sequences: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          next_value: number
          prefix: string
          scope_key: string
          scope_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type?: string
          id?: string
          next_value?: number
          prefix: string
          scope_key: string
          scope_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          next_value?: number
          prefix?: string
          scope_key?: string
          scope_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          branch_serial: string | null
          city_branch_id: string | null
          country_id: string
          country_serial: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          entry_serial: string | null
          id: string
          local_amount: number
          local_currency: string
          posted_at: string | null
          source_id: string | null
          source_table: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          super_admin_serial: string | null
          transaction_date: string
          transaction_no: string
          updated_at: string
          usd_amount: number | null
          usd_rate: number
        }
        Insert: {
          branch_serial?: string | null
          city_branch_id?: string | null
          country_id: string
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          entry_serial?: string | null
          id?: string
          local_amount: number
          local_currency: string
          posted_at?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          super_admin_serial?: string | null
          transaction_date: string
          transaction_no: string
          updated_at?: string
          usd_amount?: number | null
          usd_rate: number
        }
        Update: {
          branch_serial?: string | null
          city_branch_id?: string | null
          country_id?: string
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          entry_serial?: string | null
          id?: string
          local_amount?: number
          local_currency?: string
          posted_at?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          super_admin_serial?: string | null
          transaction_date?: string
          transaction_no?: string
          updated_at?: string
          usd_amount?: number | null
          usd_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transit_truck_loadings: {
        Row: {
          border: string | null
          branch_serial: string | null
          city_branch_id: string | null
          container_number: string | null
          country_branch_id: string | null
          country_id: string | null
          country_serial: string | null
          created_at: string
          created_by: string | null
          customs_information: string | null
          deleted_at: string | null
          dest_city_id: string | null
          dest_country_id: string | null
          dest_district_id: string | null
          dest_state_province_id: string | null
          destination: string | null
          driver_mobile: string | null
          driver_name: string | null
          entry_serial: string | null
          goods_name: string | null
          id: string
          is_active: boolean
          quantity: number | null
          remarks: string | null
          seal_number: string | null
          status: string
          super_admin_serial: string | null
          transit_company: string | null
          transit_date: string
          transit_route: string | null
          transit_serial: string | null
          truck_id: string | null
          truck_number: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          border?: string | null
          branch_serial?: string | null
          city_branch_id?: string | null
          container_number?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          customs_information?: string | null
          deleted_at?: string | null
          dest_city_id?: string | null
          dest_country_id?: string | null
          dest_district_id?: string | null
          dest_state_province_id?: string | null
          destination?: string | null
          driver_mobile?: string | null
          driver_name?: string | null
          entry_serial?: string | null
          goods_name?: string | null
          id?: string
          is_active?: boolean
          quantity?: number | null
          remarks?: string | null
          seal_number?: string | null
          status?: string
          super_admin_serial?: string | null
          transit_company?: string | null
          transit_date?: string
          transit_route?: string | null
          transit_serial?: string | null
          truck_id?: string | null
          truck_number?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          border?: string | null
          branch_serial?: string | null
          city_branch_id?: string | null
          container_number?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          customs_information?: string | null
          deleted_at?: string | null
          dest_city_id?: string | null
          dest_country_id?: string | null
          dest_district_id?: string | null
          dest_state_province_id?: string | null
          destination?: string | null
          driver_mobile?: string | null
          driver_name?: string | null
          entry_serial?: string | null
          goods_name?: string | null
          id?: string
          is_active?: boolean
          quantity?: number | null
          remarks?: string | null
          seal_number?: string | null
          status?: string
          super_admin_serial?: string | null
          transit_company?: string | null
          transit_date?: string
          transit_route?: string | null
          transit_serial?: string | null
          truck_id?: string | null
          truck_number?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transit_truck_loadings_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_truck_loadings_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_truck_loadings_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_truck_loadings_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "transit_truck_loadings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_truck_loadings_dest_city_id_fkey"
            columns: ["dest_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_truck_loadings_dest_country_id_fkey"
            columns: ["dest_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_truck_loadings_dest_country_id_fkey"
            columns: ["dest_country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "transit_truck_loadings_dest_district_id_fkey"
            columns: ["dest_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_truck_loadings_dest_state_province_id_fkey"
            columns: ["dest_state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_truck_loadings_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          record_translation_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          record_translation_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          record_translation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "translation_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translation_audit_logs_record_translation_id_fkey"
            columns: ["record_translation_id"]
            isOneToOne: false
            referencedRelation: "record_translations_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_generation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          field_names: string[]
          id: string
          provider: string
          record_id: string
          record_table: string
          requested_by: string | null
          source_language_code: string
          status: string
          target_language_codes: string[]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          field_names?: string[]
          id?: string
          provider?: string
          record_id: string
          record_table: string
          requested_by?: string | null
          source_language_code: string
          status?: string
          target_language_codes?: string[]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          field_names?: string[]
          id?: string
          provider?: string
          record_id?: string
          record_table?: string
          requested_by?: string | null
          source_language_code?: string
          status?: string
          target_language_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "translation_generation_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translation_generation_jobs_source_language_code_fkey"
            columns: ["source_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      translation_keys: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          key: string
          namespace: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          key: string
          namespace: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          key?: string
          namespace?: string
          updated_at?: string
        }
        Relationships: []
      }
      translation_values: {
        Row: {
          corrected_at: string | null
          corrected_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          language_code: string
          source: Database["public"]["Enums"]["translation_source"]
          translation_key_id: string
          updated_at: string
          value: string
        }
        Insert: {
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          language_code: string
          source?: Database["public"]["Enums"]["translation_source"]
          translation_key_id: string
          updated_at?: string
          value: string
        }
        Update: {
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          language_code?: string
          source?: Database["public"]["Enums"]["translation_source"]
          translation_key_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_values_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translation_values_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "translation_values_translation_key_id_fkey"
            columns: ["translation_key_id"]
            isOneToOne: false
            referencedRelation: "translation_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      translations_arabic: {
        Row: {
          created_at: string
          deleted_at: string | null
          field_name: string
          id: string
          record_id: string
          record_table: string
          text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          field_name: string
          id?: string
          record_id: string
          record_table: string
          text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          field_name?: string
          id?: string
          record_id?: string
          record_table?: string
          text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      translations_english: {
        Row: {
          corrected_at: string | null
          corrected_by: string | null
          created_at: string
          deleted_at: string | null
          field_name: string
          id: string
          original_language_code: string
          original_text: string
          record_id: string
          record_table: string
          source: Database["public"]["Enums"]["translation_source"]
          text: string | null
          translated_at: string
          translated_by_engine: string
          translation_status: string
          updated_at: string
        }
        Insert: {
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          field_name: string
          id?: string
          original_language_code?: string
          original_text?: string
          record_id: string
          record_table: string
          source?: Database["public"]["Enums"]["translation_source"]
          text?: string | null
          translated_at?: string
          translated_by_engine?: string
          translation_status?: string
          updated_at?: string
        }
        Update: {
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          field_name?: string
          id?: string
          original_language_code?: string
          original_text?: string
          record_id?: string
          record_table?: string
          source?: Database["public"]["Enums"]["translation_source"]
          text?: string | null
          translated_at?: string
          translated_by_engine?: string
          translation_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translations_english_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      translations_pashto: {
        Row: {
          created_at: string
          deleted_at: string | null
          field_name: string
          id: string
          record_id: string
          record_table: string
          text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          field_name: string
          id?: string
          record_id: string
          record_table: string
          text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          field_name?: string
          id?: string
          record_id?: string
          record_table?: string
          text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      translations_persian: {
        Row: {
          created_at: string
          deleted_at: string | null
          field_name: string
          id: string
          record_id: string
          record_table: string
          text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          field_name: string
          id?: string
          record_id: string
          record_table: string
          text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          field_name?: string
          id?: string
          record_id?: string
          record_table?: string
          text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      translations_urdu: {
        Row: {
          created_at: string
          deleted_at: string | null
          field_name: string
          id: string
          record_id: string
          record_table: string
          text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          field_name: string
          id?: string
          record_id: string
          record_table: string
          text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          field_name?: string
          id?: string
          record_id?: string
          record_table?: string
          text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      truck_loadings: {
        Row: {
          branch_serial: string | null
          city_branch_id: string | null
          cnic_passport: string | null
          country_branch_id: string | null
          country_id: string | null
          country_serial: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dest_city_id: string | null
          dest_country_id: string | null
          dest_district_id: string | null
          dest_state_province_id: string | null
          destination: string | null
          driver_mobile_1: string | null
          driver_mobile_2: string | null
          driver_name: string | null
          entry_serial: string | null
          goods_name: string | null
          gross_weight: number | null
          id: string
          is_active: boolean
          loading_date: string
          loading_serial: string | null
          net_weight: number | null
          quantity: number | null
          remarks: string | null
          status: string
          super_admin_serial: string | null
          truck_id: string | null
          truck_name: string | null
          truck_number: string | null
          truck_owner_mobile: string | null
          truck_owner_name: string | null
          unit: string | null
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          branch_serial?: string | null
          city_branch_id?: string | null
          cnic_passport?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dest_city_id?: string | null
          dest_country_id?: string | null
          dest_district_id?: string | null
          dest_state_province_id?: string | null
          destination?: string | null
          driver_mobile_1?: string | null
          driver_mobile_2?: string | null
          driver_name?: string | null
          entry_serial?: string | null
          goods_name?: string | null
          gross_weight?: number | null
          id?: string
          is_active?: boolean
          loading_date?: string
          loading_serial?: string | null
          net_weight?: number | null
          quantity?: number | null
          remarks?: string | null
          status?: string
          super_admin_serial?: string | null
          truck_id?: string | null
          truck_name?: string | null
          truck_number?: string | null
          truck_owner_mobile?: string | null
          truck_owner_name?: string | null
          unit?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          branch_serial?: string | null
          city_branch_id?: string | null
          cnic_passport?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dest_city_id?: string | null
          dest_country_id?: string | null
          dest_district_id?: string | null
          dest_state_province_id?: string | null
          destination?: string | null
          driver_mobile_1?: string | null
          driver_mobile_2?: string | null
          driver_name?: string | null
          entry_serial?: string | null
          goods_name?: string | null
          gross_weight?: number | null
          id?: string
          is_active?: boolean
          loading_date?: string
          loading_serial?: string | null
          net_weight?: number | null
          quantity?: number | null
          remarks?: string | null
          status?: string
          super_admin_serial?: string | null
          truck_id?: string | null
          truck_name?: string | null
          truck_number?: string | null
          truck_owner_mobile?: string | null
          truck_owner_name?: string | null
          unit?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "truck_loadings_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_loadings_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_loadings_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_loadings_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "truck_loadings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_loadings_dest_city_id_fkey"
            columns: ["dest_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_loadings_dest_country_id_fkey"
            columns: ["dest_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_loadings_dest_country_id_fkey"
            columns: ["dest_country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "truck_loadings_dest_district_id_fkey"
            columns: ["dest_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_loadings_dest_state_province_id_fkey"
            columns: ["dest_state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_loadings_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          base_city_id: string | null
          base_district_id: string | null
          base_state_province_id: string | null
          branch_serial: string | null
          capacity: string | null
          chassis_number: string | null
          city_branch_id: string | null
          color: string | null
          country_branch_id: string | null
          country_id: string | null
          country_serial: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          driver_cnic_passport: string | null
          driver_docs_expiry_date: string | null
          driver_mobile: string | null
          driver_name: string | null
          engine_number: string | null
          entry_serial: string | null
          id: string
          insurance_expiry_date: string | null
          is_active: boolean
          make: string | null
          manufacturing_year: number | null
          model: string | null
          notes: string | null
          owner_mobile: string | null
          owner_name: string | null
          registration_country_id: string | null
          registration_expiry_date: string | null
          registration_number: string | null
          status: string
          super_admin_serial: string | null
          transport_company: string | null
          truck_number: string
          truck_serial: string | null
          truck_type: string | null
          updated_at: string
        }
        Insert: {
          base_city_id?: string | null
          base_district_id?: string | null
          base_state_province_id?: string | null
          branch_serial?: string | null
          capacity?: string | null
          chassis_number?: string | null
          city_branch_id?: string | null
          color?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          driver_cnic_passport?: string | null
          driver_docs_expiry_date?: string | null
          driver_mobile?: string | null
          driver_name?: string | null
          engine_number?: string | null
          entry_serial?: string | null
          id?: string
          insurance_expiry_date?: string | null
          is_active?: boolean
          make?: string | null
          manufacturing_year?: number | null
          model?: string | null
          notes?: string | null
          owner_mobile?: string | null
          owner_name?: string | null
          registration_country_id?: string | null
          registration_expiry_date?: string | null
          registration_number?: string | null
          status?: string
          super_admin_serial?: string | null
          transport_company?: string | null
          truck_number: string
          truck_serial?: string | null
          truck_type?: string | null
          updated_at?: string
        }
        Update: {
          base_city_id?: string | null
          base_district_id?: string | null
          base_state_province_id?: string | null
          branch_serial?: string | null
          capacity?: string | null
          chassis_number?: string | null
          city_branch_id?: string | null
          color?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          driver_cnic_passport?: string | null
          driver_docs_expiry_date?: string | null
          driver_mobile?: string | null
          driver_name?: string | null
          engine_number?: string | null
          entry_serial?: string | null
          id?: string
          insurance_expiry_date?: string | null
          is_active?: boolean
          make?: string | null
          manufacturing_year?: number | null
          model?: string | null
          notes?: string | null
          owner_mobile?: string | null
          owner_name?: string | null
          registration_country_id?: string | null
          registration_expiry_date?: string | null
          registration_number?: string | null
          status?: string
          super_admin_serial?: string | null
          transport_company?: string | null
          truck_number?: string
          truck_serial?: string | null
          truck_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trucks_base_city_id_fkey"
            columns: ["base_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trucks_base_district_id_fkey"
            columns: ["base_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trucks_base_state_province_id_fkey"
            columns: ["base_state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trucks_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trucks_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trucks_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trucks_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "trucks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trucks_registration_country_id_fkey"
            columns: ["registration_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trucks_registration_country_id_fkey"
            columns: ["registration_country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      usd_purchase_sales: {
        Row: {
          approval_request_id: string | null
          approved_by: string | null
          business_date: string
          city_branch_id: string | null
          closing_balance: number
          country_branch_id: string | null
          country_id: string
          created_at: string
          created_by: string | null
          credit_amount: number
          debit_amount: number
          deleted_at: string | null
          id: string
          opening_balance: number
          profit_loss: number
          purchase_rate: number
          sale_rate: number
          updated_at: string
          usd_purchased: number
          usd_sold: number
        }
        Insert: {
          approval_request_id?: string | null
          approved_by?: string | null
          business_date: string
          city_branch_id?: string | null
          closing_balance?: number
          country_branch_id?: string | null
          country_id: string
          created_at?: string
          created_by?: string | null
          credit_amount?: number
          debit_amount?: number
          deleted_at?: string | null
          id?: string
          opening_balance?: number
          profit_loss?: number
          purchase_rate?: number
          sale_rate?: number
          updated_at?: string
          usd_purchased?: number
          usd_sold?: number
        }
        Update: {
          approval_request_id?: string | null
          approved_by?: string | null
          business_date?: string
          city_branch_id?: string | null
          closing_balance?: number
          country_branch_id?: string | null
          country_id?: string
          created_at?: string
          created_by?: string | null
          credit_amount?: number
          debit_amount?: number
          deleted_at?: string | null
          id?: string
          opening_balance?: number
          profit_loss?: number
          purchase_rate?: number
          sale_rate?: number
          updated_at?: string
          usd_purchased?: number
          usd_sold?: number
        }
        Relationships: [
          {
            foreignKeyName: "usd_purchase_sales_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usd_purchase_sales_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usd_purchase_sales_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usd_purchase_sales_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usd_purchase_sales_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usd_purchase_sales_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "usd_purchase_sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_language_preferences: {
        Row: {
          created_at: string
          deleted_at: string | null
          direction: Database["public"]["Enums"]["language_direction"]
          id: string
          is_active: boolean
          language_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          direction: Database["public"]["Enums"]["language_direction"]
          id?: string
          is_active?: boolean
          language_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          direction?: Database["public"]["Enums"]["language_direction"]
          id?: string
          is_active?: boolean
          language_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_language_preferences_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_language_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_sets: {
        Row: {
          created_at: string
          deleted_at: string | null
          permissions: string[]
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          permissions?: string[]
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          permissions?: string[]
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_sets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "user_role_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_sequences: {
        Row: {
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          next_number: number
          padding: number
          prefix: string
          reset_policy: string
          scope: Database["public"]["Enums"]["ledger_scope"]
          updated_at: string
        }
        Insert: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          next_number?: number
          padding?: number
          prefix: string
          reset_policy?: string
          scope: Database["public"]["Enums"]["ledger_scope"]
          updated_at?: string
        }
        Update: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          next_number?: number
          padding?: number
          prefix?: string
          reset_policy?: string
          scope?: Database["public"]["Enums"]["ledger_scope"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_sequences_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_sequences_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_sequences_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_sequences_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      warehouses: {
        Row: {
          area_id: string | null
          branch_serial: string | null
          city_id: string | null
          contact_number: string | null
          country_id: string | null
          country_serial: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          district_id: string | null
          entry_serial: string | null
          full_address: string | null
          id: string
          is_active: boolean
          name_ar: string | null
          name_en: string | null
          name_fa: string | null
          name_ps: string | null
          name_ur: string | null
          original_language_code: string
          owner_name: string | null
          state_province_id: string | null
          status: string
          super_admin_serial: string | null
          updated_at: string
          warehouse_code: string | null
          warehouse_name: string
          warehouse_type: string | null
        }
        Insert: {
          area_id?: string | null
          branch_serial?: string | null
          city_id?: string | null
          contact_number?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          district_id?: string | null
          entry_serial?: string | null
          full_address?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en?: string | null
          name_fa?: string | null
          name_ps?: string | null
          name_ur?: string | null
          original_language_code?: string
          owner_name?: string | null
          state_province_id?: string | null
          status?: string
          super_admin_serial?: string | null
          updated_at?: string
          warehouse_code?: string | null
          warehouse_name: string
          warehouse_type?: string | null
        }
        Update: {
          area_id?: string | null
          branch_serial?: string | null
          city_id?: string | null
          contact_number?: string | null
          country_id?: string | null
          country_serial?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          district_id?: string | null
          entry_serial?: string | null
          full_address?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en?: string | null
          name_fa?: string | null
          name_ps?: string | null
          name_ur?: string | null
          original_language_code?: string
          owner_name?: string | null
          state_province_id?: string | null
          status?: string
          super_admin_serial?: string | null
          updated_at?: string
          warehouse_code?: string | null
          warehouse_name?: string
          warehouse_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "warehouses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_original_language_code_fkey"
            columns: ["original_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "warehouses_state_province_id_fkey"
            columns: ["state_province_id"]
            isOneToOne: false
            referencedRelation: "states_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          access_token: string
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_name: string
          id: string
          is_active: boolean
          is_default: boolean
          phone_number: string
          phone_number_id: string
          scope: Database["public"]["Enums"]["whatsapp_account_scope"]
          settings: Json
          updated_at: string
          verify_token: string | null
          waba_id: string
          webhook_registered: boolean
        }
        Insert: {
          access_token: string
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          phone_number: string
          phone_number_id: string
          scope: Database["public"]["Enums"]["whatsapp_account_scope"]
          settings?: Json
          updated_at?: string
          verify_token?: string | null
          waba_id: string
          webhook_registered?: boolean
        }
        Update: {
          access_token?: string
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          phone_number?: string
          phone_number_id?: string
          scope?: Database["public"]["Enums"]["whatsapp_account_scope"]
          settings?: Json
          updated_at?: string
          verify_token?: string | null
          waba_id?: string
          webhook_registered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_accounts_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_accounts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_accounts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "whatsapp_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_activity_log: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          city_branch_id: string | null
          conversation_id: string | null
          country_id: string | null
          created_at: string
          event_data: Json
          event_type: string
          id: string
          whatsapp_account_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          city_branch_id?: string | null
          conversation_id?: string | null
          country_id?: string | null
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          whatsapp_account_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          city_branch_id?: string | null
          conversation_id?: string | null
          country_id?: string | null
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_activity_log_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_activity_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_activity_log_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_activity_log_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "whatsapp_activity_log_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          display_name: string | null
          id: string
          is_blocked: boolean
          labels: string[]
          last_seen_at: string | null
          linked_account_id: string | null
          notes: string | null
          phone_number: string
          supplier_id: string | null
          updated_at: string
          wa_profile_name: string | null
          whatsapp_account_id: string
        }
        Insert: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          is_blocked?: boolean
          labels?: string[]
          last_seen_at?: string | null
          linked_account_id?: string | null
          notes?: string | null
          phone_number: string
          supplier_id?: string | null
          updated_at?: string
          wa_profile_name?: string | null
          whatsapp_account_id: string
        }
        Update: {
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          is_blocked?: boolean
          labels?: string[]
          last_seen_at?: string | null
          linked_account_id?: string | null
          notes?: string | null
          phone_number?: string
          supplier_id?: string | null
          updated_at?: string
          wa_profile_name?: string | null
          whatsapp_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_user_id: string | null
          city_branch_id: string | null
          contact_id: string
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          labels: string[]
          last_message_at: string | null
          last_message_dir:
            | Database["public"]["Enums"]["whatsapp_message_direction"]
            | null
          last_message_text: string | null
          linked_customer_id: string | null
          linked_document_no: string | null
          linked_module: string | null
          linked_supplier_id: string | null
          meta_conversation_id: string | null
          status: Database["public"]["Enums"]["whatsapp_conversation_status"]
          unread_count: number
          updated_at: string
          whatsapp_account_id: string
          window_expires_at: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          city_branch_id?: string | null
          contact_id: string
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          labels?: string[]
          last_message_at?: string | null
          last_message_dir?:
            | Database["public"]["Enums"]["whatsapp_message_direction"]
            | null
          last_message_text?: string | null
          linked_customer_id?: string | null
          linked_document_no?: string | null
          linked_module?: string | null
          linked_supplier_id?: string | null
          meta_conversation_id?: string | null
          status?: Database["public"]["Enums"]["whatsapp_conversation_status"]
          unread_count?: number
          updated_at?: string
          whatsapp_account_id: string
          window_expires_at?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          city_branch_id?: string | null
          contact_id?: string
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          labels?: string[]
          last_message_at?: string | null
          last_message_dir?:
            | Database["public"]["Enums"]["whatsapp_message_direction"]
            | null
          last_message_text?: string | null
          linked_customer_id?: string | null
          linked_document_no?: string | null
          linked_module?: string | null
          linked_supplier_id?: string | null
          meta_conversation_id?: string | null
          status?: Database["public"]["Enums"]["whatsapp_conversation_status"]
          unread_count?: number
          updated_at?: string
          whatsapp_account_id?: string
          window_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_media: {
        Row: {
          bucket: string
          conversation_id: string
          created_at: string
          duration_secs: number | null
          filename: string | null
          id: string
          message_id: string
          meta_media_id: string | null
          mime_type: string | null
          public_url: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          bucket?: string
          conversation_id: string
          created_at?: string
          duration_secs?: number | null
          filename?: string | null
          id?: string
          message_id: string
          meta_media_id?: string | null
          mime_type?: string | null
          public_url?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          bucket?: string
          conversation_id?: string
          created_at?: string
          duration_secs?: number | null
          filename?: string | null
          id?: string
          message_id?: string
          meta_media_id?: string | null
          mime_type?: string | null
          public_url?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_media_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          city_branch_id: string | null
          context_message_id: string | null
          conversation_id: string
          country_branch_id: string | null
          country_id: string | null
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          direction: Database["public"]["Enums"]["whatsapp_message_direction"]
          external_message_id: string | null
          failed_at: string | null
          failed_reason: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          media_filename: string | null
          media_mime_type: string | null
          media_sha256: string | null
          media_size_bytes: number | null
          media_url: string | null
          message_type: Database["public"]["Enums"]["whatsapp_message_type"]
          raw_payload: Json | null
          read_at: string | null
          sender_phone: string | null
          sender_user_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["whatsapp_message_status"]
          template_name: string | null
          template_params: Json | null
          updated_at: string
          whatsapp_account_id: string
        }
        Insert: {
          body?: string | null
          city_branch_id?: string | null
          context_message_id?: string | null
          conversation_id: string
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          direction: Database["public"]["Enums"]["whatsapp_message_direction"]
          external_message_id?: string | null
          failed_at?: string | null
          failed_reason?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_sha256?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["whatsapp_message_type"]
          raw_payload?: Json | null
          read_at?: string | null
          sender_phone?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_message_status"]
          template_name?: string | null
          template_params?: Json | null
          updated_at?: string
          whatsapp_account_id: string
        }
        Update: {
          body?: string | null
          city_branch_id?: string | null
          context_message_id?: string | null
          conversation_id?: string
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["whatsapp_message_direction"]
          external_message_id?: string | null
          failed_at?: string | null
          failed_reason?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_sha256?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["whatsapp_message_type"]
          raw_payload?: Json | null
          read_at?: string | null
          sender_phone?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_message_status"]
          template_name?: string | null
          template_params?: Json | null
          updated_at?: string
          whatsapp_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zz_bak_20260801_areas_locations: {
        Row: {
          city_id: string | null
          code: string | null
          country_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          district_id: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          phone_area_code: string | null
          postal_code: string | null
          state_province_id: string | null
          updated_at: string | null
        }
        Insert: {
          city_id?: string | null
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          phone_area_code?: string | null
          postal_code?: string | null
          state_province_id?: string | null
          updated_at?: string | null
        }
        Update: {
          city_id?: string | null
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          phone_area_code?: string | null
          postal_code?: string | null
          state_province_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_bak_20260801_cities: {
        Row: {
          code: string | null
          country_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          district_id: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          phone_area_code: string | null
          state_province_id: string | null
          updated_at: string | null
          updated_by: string | null
          zip_code: string | null
        }
        Insert: {
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          phone_area_code?: string | null
          state_province_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          zip_code?: string | null
        }
        Update: {
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          district_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          phone_area_code?: string | null
          state_province_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      zz_bak_20260801_countries: {
        Row: {
          admin_email: string | null
          created_at: string | null
          currency_code: string | null
          default_company_profile_id: string | null
          default_country_branch_id: string | null
          default_language_code: string | null
          deleted_at: string | null
          email_domain: string | null
          email_server_settings: Json | null
          id: string | null
          is_active: boolean | null
          iso2: string | null
          iso3: string | null
          name: string | null
          official_email: string | null
          parent_business_group_id: string | null
          phone_code: string | null
          reporting_currency: string | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          admin_email?: string | null
          created_at?: string | null
          currency_code?: string | null
          default_company_profile_id?: string | null
          default_country_branch_id?: string | null
          default_language_code?: string | null
          deleted_at?: string | null
          email_domain?: string | null
          email_server_settings?: Json | null
          id?: string | null
          is_active?: boolean | null
          iso2?: string | null
          iso3?: string | null
          name?: string | null
          official_email?: string | null
          parent_business_group_id?: string | null
          phone_code?: string | null
          reporting_currency?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          admin_email?: string | null
          created_at?: string | null
          currency_code?: string | null
          default_company_profile_id?: string | null
          default_country_branch_id?: string | null
          default_language_code?: string | null
          deleted_at?: string | null
          email_domain?: string | null
          email_server_settings?: Json | null
          id?: string | null
          is_active?: boolean | null
          iso2?: string | null
          iso3?: string | null
          name?: string | null
          official_email?: string | null
          parent_business_group_id?: string | null
          phone_code?: string | null
          reporting_currency?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      zz_bak_20260801_districts: {
        Row: {
          code: string | null
          country_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          phone_area_code: string | null
          postal_code: string | null
          state_province_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          phone_area_code?: string | null
          postal_code?: string | null
          state_province_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          phone_area_code?: string | null
          postal_code?: string | null
          state_province_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_bak_20260801_states_provinces: {
        Row: {
          code: string | null
          country_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          phone_area_code: string | null
          postal_code: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          phone_area_code?: string | null
          postal_code?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          phone_area_code?: string | null
          postal_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_bak2_20260801_banks: {
        Row: {
          account_number: string | null
          account_status: string | null
          account_title: string | null
          account_type: string | null
          bank_name: string | null
          bank_type: string | null
          branch_code: string | null
          branch_code_type: string | null
          branch_name: string | null
          city_id: string | null
          country_id: string | null
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          district_id: string | null
          email: string | null
          full_address: string | null
          iban_number: string | null
          id: string | null
          is_active: boolean | null
          phone: string | null
          remarks: string | null
          short_name: string | null
          state_province_id: string | null
          swift_bic: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          account_number?: string | null
          account_status?: string | null
          account_title?: string | null
          account_type?: string | null
          bank_name?: string | null
          bank_type?: string | null
          branch_code?: string | null
          branch_code_type?: string | null
          branch_name?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          district_id?: string | null
          email?: string | null
          full_address?: string | null
          iban_number?: string | null
          id?: string | null
          is_active?: boolean | null
          phone?: string | null
          remarks?: string | null
          short_name?: string | null
          state_province_id?: string | null
          swift_bic?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          account_number?: string | null
          account_status?: string | null
          account_title?: string | null
          account_type?: string | null
          bank_name?: string | null
          bank_type?: string | null
          branch_code?: string | null
          branch_code_type?: string | null
          branch_name?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          district_id?: string | null
          email?: string | null
          full_address?: string | null
          iban_number?: string | null
          id?: string | null
          is_active?: boolean | null
          phone?: string | null
          remarks?: string | null
          short_name?: string | null
          state_province_id?: string | null
          swift_bic?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      zz_bak2_20260801_companies: {
        Row: {
          address: string | null
          area_location_id: string | null
          area_name: string | null
          base_currency: string | null
          business_type: string | null
          city_id: string | null
          city_name: string | null
          contacts: Json | null
          country_id: string | null
          country_name: string | null
          created_at: string | null
          deleted_at: string | null
          district_id: string | null
          district_name: string | null
          id: string | null
          is_active: boolean | null
          legal_name: string | null
          name: string | null
          owner_ids: Json | null
          owner_name: string | null
          registrations: Json | null
          state_name: string | null
          state_province_id: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          area_location_id?: string | null
          area_name?: string | null
          base_currency?: string | null
          business_type?: string | null
          city_id?: string | null
          city_name?: string | null
          contacts?: Json | null
          country_id?: string | null
          country_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          district_id?: string | null
          district_name?: string | null
          id?: string | null
          is_active?: boolean | null
          legal_name?: string | null
          name?: string | null
          owner_ids?: Json | null
          owner_name?: string | null
          registrations?: Json | null
          state_name?: string | null
          state_province_id?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          area_location_id?: string | null
          area_name?: string | null
          base_currency?: string | null
          business_type?: string | null
          city_id?: string | null
          city_name?: string | null
          contacts?: Json | null
          country_id?: string | null
          country_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          district_id?: string | null
          district_name?: string | null
          id?: string | null
          is_active?: boolean | null
          legal_name?: string | null
          name?: string | null
          owner_ids?: Json | null
          owner_name?: string | null
          registrations?: Json | null
          state_name?: string | null
          state_province_id?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      zz_bak2_20260801_customers: {
        Row: {
          address: string | null
          area_location_id: string | null
          city_id: string | null
          company_name: string | null
          contact_person: string | null
          country_id: string | null
          created_at: string | null
          created_by: string | null
          customer_name: string | null
          deleted_at: string | null
          district_id: string | null
          email: string | null
          id: string | null
          is_active: boolean | null
          mobile: string | null
          notes: string | null
          original_language_code: string | null
          state_province_id: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          area_location_id?: string | null
          city_id?: string | null
          company_name?: string | null
          contact_person?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          district_id?: string | null
          email?: string | null
          id?: string | null
          is_active?: boolean | null
          mobile?: string | null
          notes?: string | null
          original_language_code?: string | null
          state_province_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          area_location_id?: string | null
          city_id?: string | null
          company_name?: string | null
          contact_person?: string | null
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          district_id?: string | null
          email?: string | null
          id?: string | null
          is_active?: boolean | null
          mobile?: string | null
          notes?: string | null
          original_language_code?: string | null
          state_province_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      branch_ledger_transaction_report: {
        Row: {
          approval_status: string | null
          batch_id: string | null
          branch_name: string | null
          city_branch_id: string | null
          country_branch_id: string | null
          country_company_name: string | null
          country_company_profile_id: string | null
          country_id: string | null
          created_at: string | null
          credit: number | null
          currency: string | null
          debit: number | null
          entry_date: string | null
          ledger_code: string | null
          ledger_name: string | null
          line_id: string | null
          narration: string | null
          reference_no: string | null
          status: Database["public"]["Enums"]["document_status"] | null
          transaction_type: string | null
          usd_amount: number | null
          usd_rate: number | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_posting_batches_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_country_company_profile_id_fkey"
            columns: ["country_company_profile_id"]
            isOneToOne: false
            referencedRelation: "country_company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "ledger_posting_batches_created_by_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      global_transaction_report_usd: {
        Row: {
          country_id: string | null
          country_name: string | null
          report_month: string | null
          total_usd_amount: number | null
          transaction_count: number | null
        }
        Relationships: []
      }
      ledger_outstanding_v: {
        Row: {
          account_id: string | null
          city_branch_id: string | null
          code: string | null
          country_branch_id: string | null
          country_id: string | null
          credit_total: number | null
          currency: string | null
          current_balance: number | null
          days_since_movement: number | null
          debit_total: number | null
          id: string | null
          last_movement_date: string | null
          name: string | null
          opening_balance: number | null
          scope: Database["public"]["Enums"]["ledger_scope"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ledgers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledgers_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
      loading_ports: {
        Row: {
          country_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string | null
          is_active: boolean | null
          port_code: string | null
          port_name: string | null
          transport_type: string | null
          updated_at: string | null
        }
        Insert: {
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string | null
          is_active?: boolean | null
          port_code?: string | null
          port_name?: string | null
          transport_type?: string | null
          updated_at?: string | null
        }
        Update: {
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string | null
          is_active?: boolean | null
          port_code?: string | null
          port_name?: string | null
          transport_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ports_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ports_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "ports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      received_ports: {
        Row: {
          country_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string | null
          is_active: boolean | null
          port_code: string | null
          port_name: string | null
          transport_type: string | null
          updated_at: string | null
        }
        Insert: {
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string | null
          is_active?: boolean | null
          port_code?: string | null
          port_name?: string | null
          transport_type?: string | null
          updated_at?: string | null
        }
        Update: {
          country_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string | null
          is_active?: boolean | null
          port_code?: string | null
          port_name?: string | null
          transport_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ports_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ports_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "ports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      record_translations: {
        Row: {
          arabic_text: string | null
          corrected_at: string | null
          corrected_by: string | null
          created_at: string | null
          deleted_at: string | null
          english_text: string | null
          field_name: string | null
          id: string | null
          language_texts: Json | null
          original_language_code: string | null
          original_text: string | null
          pashto_text: string | null
          persian_text: string | null
          record_id: string | null
          record_table: string | null
          source: Database["public"]["Enums"]["translation_source"] | null
          translated_at: string | null
          translated_by_engine: string | null
          translation_status: string | null
          updated_at: string | null
          urdu_text: string | null
        }
        Relationships: [
          {
            foreignKeyName: "translations_english_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_urdu_notifications: {
        Row: {
          actor_id: string | null
          city_branch_id: string | null
          country_branch_id: string | null
          country_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_table: string | null
          event_type: string | null
          id: string | null
          is_read: boolean | null
          message: string | null
          payload: Json | null
          severity: string | null
          source_module: string | null
        }
        Insert: {
          actor_id?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_table?: string | null
          event_type?: string | null
          id?: string | null
          is_read?: boolean | null
          message?: string | null
          payload?: Json | null
          severity?: string | null
          source_module?: string | null
        }
        Update: {
          actor_id?: string | null
          city_branch_id?: string | null
          country_branch_id?: string | null
          country_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_table?: string | null
          event_type?: string | null
          id?: string | null
          is_read?: boolean | null
          message?: string | null
          payload?: Json | null
          severity?: string | null
          source_module?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_multilingual_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_multilingual_events_city_branch_id_fkey"
            columns: ["city_branch_id"]
            isOneToOne: false
            referencedRelation: "city_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_multilingual_events_country_branch_id_fkey"
            columns: ["country_branch_id"]
            isOneToOne: false
            referencedRelation: "country_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_multilingual_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_multilingual_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "global_transaction_report_usd"
            referencedColumns: ["country_id"]
          },
        ]
      }
    }
    Functions: {
      assert_enterprise_scope_access: {
        Args: {
          p_city_branch_id: string
          p_country_branch_id: string
          p_country_id: string
          p_scope: Database["public"]["Enums"]["ledger_scope"]
        }
        Returns: undefined
      }
      assert_financial_period_open: {
        Args: {
          p_city_branch_id: string
          p_country_branch_id: string
          p_country_id: string
          p_entry_date: string
          p_scope: Database["public"]["Enums"]["ledger_scope"]
        }
        Returns: undefined
      }
      can_access_city_branch: {
        Args: { target_city_branch_id: string }
        Returns: boolean
      }
      can_access_country: {
        Args: { target_country_id: string }
        Returns: boolean
      }
      can_access_country_branch: {
        Args: { target_country_branch_id: string }
        Returns: boolean
      }
      can_access_whatsapp_account: {
        Args: { account_id: string }
        Returns: boolean
      }
      can_manage_country: {
        Args: { target_country_id: string }
        Returns: boolean
      }
      create_account: {
        Args: {
          account_code: string
          account_currency: string
          account_kind_value: Database["public"]["Enums"]["account_kind"]
          account_name: string
          is_control: boolean
          parent_account_id: string
          target_branch_id: string
          target_company_id: string
        }
        Returns: string
      }
      create_city_branch: {
        Args: {
          branch_code: string
          branch_currency: string
          branch_name: string
          city_name: string
          target_country_branch_id: string
          target_country_id: string
        }
        Returns: string
      }
      create_company_workspace: {
        Args: {
          base_currency: string
          branch_code: string
          branch_name: string
          company_name: string
          legal_name: string
          owner_full_name: string
        }
        Returns: string
      }
      create_country: {
        Args: {
          country_currency_code: string
          country_iso2: string
          country_iso3: string
          country_name: string
        }
        Returns: string
      }
      create_country_main_branch: {
        Args: {
          branch_code: string
          branch_name: string
          target_country_id: string
        }
        Returns: string
      }
      create_customer:
        | {
            Args: {
              p_address: string
              p_area_location_id: string
              p_city_id: string
              p_company_name: string
              p_contact_person: string
              p_country_id: string
              p_customer_name: string
              p_email: string
              p_mobile: string
              p_notes: string
              p_original_language_code: string
              p_state_province_id: string
              p_whatsapp: string
            }
            Returns: string
          }
        | {
            Args: {
              p_address: string
              p_area_location_id: string
              p_city_id: string
              p_company_name: string
              p_contact_person: string
              p_country_id: string
              p_customer_name: string
              p_district_id: string
              p_email: string
              p_mobile: string
              p_notes: string
              p_original_language_code: string
              p_state_province_id: string
              p_whatsapp: string
            }
            Returns: string
          }
      create_enterprise_account: {
        Args: {
          p_city_branch_id: string
          p_code: string
          p_country_branch_id: string
          p_country_id: string
          p_currency: string
          p_is_control_account: boolean
          p_kind: Database["public"]["Enums"]["account_kind"]
          p_name: string
          p_opening_balance: number
          p_parent_id: string
          p_scope: Database["public"]["Enums"]["ledger_scope"]
        }
        Returns: string
      }
      create_enterprise_ledger: {
        Args: {
          p_city_branch_id: string
          p_code: string
          p_country_branch_id: string
          p_country_id: string
          p_currency: string
          p_enterprise_account_id: string
          p_name: string
          p_normal_balance: Database["public"]["Enums"]["ledger_direction"]
          p_opening_balance: number
          p_parent_ledger_id: string
          p_scope: Database["public"]["Enums"]["ledger_scope"]
        }
        Returns: string
      }
      create_financial_period: {
        Args: {
          p_city_branch_id: string
          p_country_branch_id: string
          p_country_id: string
          p_end_date: string
          p_period_name: string
          p_scope: Database["public"]["Enums"]["ledger_scope"]
          p_start_date: string
        }
        Returns: string
      }
      create_goods: {
        Args: {
          p_brand: string
          p_country_id: string
          p_goods_name: string
          p_hs_code: string
          p_image_url: string
          p_origin_country_id: string
          p_original_language_code: string
          p_product_code: string
          p_size: string
        }
        Returns: string
      }
      enterprise_scope_matches: {
        Args: {
          p_city_branch_id: string
          p_country_branch_id: string
          p_country_id: string
          p_scope: Database["public"]["Enums"]["ledger_scope"]
          row_city_branch_id: string
          row_country_branch_id: string
          row_country_id: string
          row_scope: Database["public"]["Enums"]["ledger_scope"]
        }
        Returns: boolean
      }
      get_global_financial_consolidation: {
        Args: { p_from_date: string; p_to_date: string }
        Returns: {
          country_id: string
          country_name: string
          credit_usd: number
          debit_usd: number
          net_usd: number
        }[]
      }
      get_ledger_statement: {
        Args: { p_from_date: string; p_ledger_id: string; p_to_date: string }
        Returns: {
          credit: number
          currency: string
          debit: number
          description: string
          entry_date: string
          reference_no: string
          running_balance: number
          source_id: string
          source_table: string
          usd_amount: number
          usd_rate: number
        }[]
      }
      get_trial_balance: {
        Args: {
          p_as_of_date: string
          p_city_branch_id: string
          p_country_branch_id: string
          p_country_id: string
          p_scope: Database["public"]["Enums"]["ledger_scope"]
        }
        Returns: {
          balance: number
          code: string
          credit_balance: number
          credit_total: number
          currency: string
          debit_balance: number
          debit_total: number
          ledger_id: string
          name: string
          opening_balance: number
          parent_ledger_id: string
        }[]
      }
      has_company_permission: {
        Args: {
          target_action: Database["public"]["Enums"]["permission_action"]
          target_company_id: string
          target_resource: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      next_entity_serial: {
        Args: {
          p_entity_type: string
          p_prefix: string
          p_scope_key: string
          p_scope_type: string
        }
        Returns: string
      }
      next_transaction_serial: {
        Args: { p_prefix: string; p_scope_key: string; p_scope_type: string }
        Returns: string
      }
      normalize_transaction_serial_prefix: {
        Args: { p_prefix: string; p_scope_key: string; p_scope_type: string }
        Returns: string
      }
      post_enterprise_ledger_batch: {
        Args: {
          p_city_branch_id: string
          p_country_branch_id: string
          p_country_id: string
          p_entry_date: string
          p_lines: Json
          p_narration: string
          p_reference_no: string
          p_scope: Database["public"]["Enums"]["ledger_scope"]
        }
        Returns: string
      }
      post_journal_entry: {
        Args: { target_journal_entry_id: string }
        Returns: undefined
      }
      post_ledger_opening_balance: {
        Args: {
          p_approval_request_id?: string
          p_financial_period_id: string
          p_ledger_id: string
          p_opening_balance: number
        }
        Returns: string
      }
      post_purchase_booking_transfer: {
        Args: {
          p_actor_id: string
          p_amount: number
          p_credit_ledger_id: string
          p_currency_code: string
          p_debit_ledger_id: string
          p_entry_date: string
          p_exchange_rate: number
          p_kind: Database["public"]["Enums"]["purchase_order_payment_kind"]
          p_narration: string
          p_purchase_order_id: string
          p_reference_no: string
        }
        Returns: string
      }
      post_purchase_order_payment: {
        Args: {
          p_amount: number
          p_credit_ledger_id: string
          p_currency_code: string
          p_debit_ledger_id: string
          p_entry_date: string
          p_exchange_rate: number
          p_kind: Database["public"]["Enums"]["purchase_order_payment_kind"]
          p_narration: string
          p_purchase_order_id: string
          p_reference_no: string
        }
        Returns: string
      }
      post_roznamcha_entry:
        | {
            Args: {
              p_city_branch_id: string
              p_country_branch_id: string
              p_country_id: string
              p_entry_date: string
              p_journal_no: string
              p_lines: Json
              p_narration: string
              p_payment_method_id: string
              p_reference_no: string
              p_type: Database["public"]["Enums"]["roznamcha_type"]
              p_voucher_no: string
            }
            Returns: string
          }
        | {
            Args: {
              p_bypass_ledger_scope?: boolean
              p_city_branch_id: string
              p_country_branch_id: string
              p_country_id: string
              p_entry_date: string
              p_journal_no: string
              p_lines: Json
              p_narration: string
              p_payment_method_id: string
              p_reference_no: string
              p_type: Database["public"]["Enums"]["roznamcha_type"]
              p_voucher_no: string
            }
            Returns: string
          }
      post_sales_booking_transfer: {
        Args: {
          p_actor_id: string
          p_amount: number
          p_credit_ledger_id: string
          p_currency_code: string
          p_debit_ledger_id: string
          p_entry_date: string
          p_exchange_rate: number
          p_narration: string
          p_payment_kind: string
          p_reference_no: string
          p_sales_order_id: string
        }
        Returns: string
      }
      post_sales_order_payment: {
        Args: {
          p_amount: number
          p_credit_ledger_id: string
          p_currency_code: string
          p_debit_ledger_id: string
          p_entry_date: string
          p_exchange_rate: number
          p_narration: string
          p_payment_kind: string
          p_reference_no: string
          p_sales_order_id: string
        }
        Returns: string
      }
      recalc_purchase_order_payment_totals: {
        Args: { p_purchase_order_id: string }
        Returns: undefined
      }
      recalc_sales_order_payment_totals: {
        Args: { p_sales_order_id: string }
        Returns: undefined
      }
      resolve_record_translation: {
        Args: {
          p_field_name: string
          p_language_code: string
          p_record_id: string
          p_record_table: string
        }
        Returns: string
      }
      resolve_record_translation_v2: {
        Args: {
          p_field_name: string
          p_language_code: string
          p_record_id: string
          p_record_table: string
        }
        Returns: string
      }
      resolve_record_translation_v3: {
        Args: {
          p_field_name: string
          p_language_code: string
          p_record_id: string
          p_record_table: string
        }
        Returns: string
      }
      reverse_enterprise_ledger_batch: {
        Args: {
          p_approval_request_id?: string
          p_original_batch_id: string
          p_reason: string
        }
        Returns: string
      }
      reverse_roznamcha_entry: {
        Args: {
          p_approval_request_id?: string
          p_original_entry_id: string
          p_reason: string
        }
        Returns: string
      }
      search_record_translations: {
        Args: {
          p_language_code: string
          p_query: string
          p_record_table?: string
        }
        Returns: {
          field_name: string
          record_id: string
          record_table: string
          resolved_text: string
        }[]
      }
      search_record_translations_v2: {
        Args: {
          p_language_code: string
          p_query: string
          p_record_table?: string
        }
        Returns: {
          field_name: string
          record_id: string
          record_table: string
          resolved_text: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_record_translation: {
        Args: {
          p_actor_id: string
          p_arabic: string
          p_english: string
          p_field_name: string
          p_language_texts: Json
          p_original_language_code: string
          p_original_text: string
          p_pashto: string
          p_persian: string
          p_record_id: string
          p_record_table: string
          p_source: string
          p_translated_by_engine: string
          p_translation_status: string
          p_urdu: string
        }
        Returns: string
      }
      write_erp_audit_log: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_company_id?: string
          p_entity_id?: string
          p_entity_table: string
          p_ip_address?: string
        }
        Returns: string
      }
    }
    Enums: {
      account_kind: "asset" | "liability" | "equity" | "income" | "expense"
      account_status: "active" | "archived"
      app_role:
        | "super_admin"
        | "country_admin"
        | "branch_admin"
        | "staff"
        | "main_branch_admin"
        | "city_branch_admin"
        | "accountant"
        | "cashier"
        | "agent_user"
        | "auditor_viewer"
        | "country_user"
      approval_action_type:
        | "edit"
        | "delete"
        | "update"
        | "reverse"
        | "lock"
        | "unlock"
      approval_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "applied"
        | "cancelled"
      branch_level:
        | "super_admin"
        | "country"
        | "main_branch"
        | "city_branch"
        | "agent"
      branch_scope: "company" | "branch"
      branch_status: "active" | "inactive" | "closed"
      contact_type_key: "mobile" | "phone" | "whatsapp" | "fax" | "extension"
      document_status: "draft" | "posted" | "cancelled" | "transferred"
      erp_module_status: "planned" | "active" | "paused" | "retired"
      financial_period_status: "open" | "locked" | "closed"
      language_direction: "ltr" | "rtl"
      ledger_direction: "debit" | "credit"
      ledger_scope: "super_admin" | "country" | "main_branch" | "city_branch"
      payment_entry_type:
        | "cash_payment"
        | "cash_receipt"
        | "bank_cheque"
        | "bank_deposit"
        | "transfer"
        | "debit"
        | "credit"
      permission_action:
        | "create"
        | "read"
        | "update"
        | "delete"
        | "post"
        | "approve"
        | "export"
      purchase_order_payment_kind:
        | "advance"
        | "remaining"
        | "credit"
        | "booking"
      purchase_order_status: "pending" | "partial" | "completed" | "cancelled"
      report_run_status:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      roznamcha_type: "super_admin" | "country" | "branch"
      transaction_status: "draft" | "posted" | "cancelled"
      translation_source: "auto" | "manual" | "imported"
      whatsapp_account_scope:
        | "super_admin"
        | "country"
        | "country_branch"
        | "city_branch"
      whatsapp_conversation_status: "open" | "assigned" | "resolved" | "spam"
      whatsapp_message_direction: "inbound" | "outbound" | "internal_note"
      whatsapp_message_status:
        | "pending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
      whatsapp_message_type:
        | "text"
        | "image"
        | "document"
        | "audio"
        | "video"
        | "sticker"
        | "location"
        | "contact"
        | "template"
        | "reaction"
        | "unknown"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_kind: ["asset", "liability", "equity", "income", "expense"],
      account_status: ["active", "archived"],
      app_role: [
        "super_admin",
        "country_admin",
        "branch_admin",
        "staff",
        "main_branch_admin",
        "city_branch_admin",
        "accountant",
        "cashier",
        "agent_user",
        "auditor_viewer",
        "country_user",
      ],
      approval_action_type: [
        "edit",
        "delete",
        "update",
        "reverse",
        "lock",
        "unlock",
      ],
      approval_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "applied",
        "cancelled",
      ],
      branch_level: [
        "super_admin",
        "country",
        "main_branch",
        "city_branch",
        "agent",
      ],
      branch_scope: ["company", "branch"],
      branch_status: ["active", "inactive", "closed"],
      contact_type_key: ["mobile", "phone", "whatsapp", "fax", "extension"],
      document_status: ["draft", "posted", "cancelled", "transferred"],
      erp_module_status: ["planned", "active", "paused", "retired"],
      financial_period_status: ["open", "locked", "closed"],
      language_direction: ["ltr", "rtl"],
      ledger_direction: ["debit", "credit"],
      ledger_scope: ["super_admin", "country", "main_branch", "city_branch"],
      payment_entry_type: [
        "cash_payment",
        "cash_receipt",
        "bank_cheque",
        "bank_deposit",
        "transfer",
        "debit",
        "credit",
      ],
      permission_action: [
        "create",
        "read",
        "update",
        "delete",
        "post",
        "approve",
        "export",
      ],
      purchase_order_payment_kind: [
        "advance",
        "remaining",
        "credit",
        "booking",
      ],
      purchase_order_status: ["pending", "partial", "completed", "cancelled"],
      report_run_status: [
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      roznamcha_type: ["super_admin", "country", "branch"],
      transaction_status: ["draft", "posted", "cancelled"],
      translation_source: ["auto", "manual", "imported"],
      whatsapp_account_scope: [
        "super_admin",
        "country",
        "country_branch",
        "city_branch",
      ],
      whatsapp_conversation_status: ["open", "assigned", "resolved", "spam"],
      whatsapp_message_direction: ["inbound", "outbound", "internal_note"],
      whatsapp_message_status: [
        "pending",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
      whatsapp_message_type: [
        "text",
        "image",
        "document",
        "audio",
        "video",
        "sticker",
        "location",
        "contact",
        "template",
        "reaction",
        "unknown",
      ],
    },
  },
} as const
