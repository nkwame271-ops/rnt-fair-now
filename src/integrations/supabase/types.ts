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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          created_at: string
          event_detail: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_detail?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_detail?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string | null
          id: string
          new_state: Json | null
          old_state: Json | null
          reason: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string | null
          id?: string
          new_state?: Json | null
          old_state?: Json | null
          reason: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string | null
          id?: string
          new_state?: Json | null
          old_state?: Json | null
          reason?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      admin_staff: {
        Row: {
          admin_type: string
          allowed_features: string[] | null
          channel_permissions: Json
          created_at: string | null
          created_by: string | null
          id: string
          muted_features: string[] | null
          office_id: string | null
          office_name: string | null
          payment_permissions: Json
          phone: string | null
          sales_channel_id: string | null
          stock_alert_threshold: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_type?: string
          allowed_features?: string[] | null
          channel_permissions?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          muted_features?: string[] | null
          office_id?: string | null
          office_name?: string | null
          payment_permissions?: Json
          phone?: string | null
          sales_channel_id?: string | null
          stock_alert_threshold?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_type?: string
          allowed_features?: string[] | null
          channel_permissions?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          muted_features?: string[] | null
          office_id?: string | null
          office_name?: string | null
          payment_permissions?: Json
          phone?: string | null
          sales_channel_id?: string | null
          stock_alert_threshold?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_staff_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "rent_card_sales_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_action_log: {
        Row: {
          action: string
          agent_user_id: string
          created_at: string
          id: string
          ip_address: string | null
          payload: Json
          target_record_id: string | null
          target_table: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          agent_user_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          payload?: Json
          target_record_id?: string | null
          target_table?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          agent_user_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          payload?: Json
          target_record_id?: string | null
          target_table?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      agent_applications: {
        Row: {
          applicant_user_id: string | null
          approved_user_id: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          id: string
          id_number: string
          id_type: string
          operating_area: string | null
          phone: string
          professional_photo_url: string | null
          region: string
          residential_address: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          reviewer_user_id: string | null
          status: string
          supporting_documents: Json
          updated_at: string
        }
        Insert: {
          applicant_user_id?: string | null
          approved_user_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          id?: string
          id_number: string
          id_type: string
          operating_area?: string | null
          phone: string
          professional_photo_url?: string | null
          region: string
          residential_address?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          supporting_documents?: Json
          updated_at?: string
        }
        Update: {
          applicant_user_id?: string | null
          approved_user_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          id?: string
          id_number?: string
          id_type?: string
          operating_area?: string | null
          phone?: string
          professional_photo_url?: string | null
          region?: string
          residential_address?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          supporting_documents?: Json
          updated_at?: string
        }
        Relationships: []
      }
      agent_assignments: {
        Row: {
          active: boolean
          agent_user_id: string
          assigned_by: string | null
          created_at: string
          id: string
          owner_role: string
          owner_user_id: string
          scope_notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          agent_user_id: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          owner_role: string
          owner_user_id: string
          scope_notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          agent_user_id?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          owner_role?: string
          owner_user_id?: string
          scope_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_staff: {
        Row: {
          application_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          operating_area: string | null
          phone: string | null
          professional_photo_url: string | null
          region: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          operating_area?: string | null
          phone?: string | null
          professional_photo_url?: string | null
          region?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          operating_area?: string | null
          phone?: string | null
          professional_photo_url?: string | null
          region?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_staff_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "agent_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_template_config: {
        Row: {
          custom_fields: Json | null
          gra_tax_enabled: boolean
          id: string
          max_advance_months: number
          max_lease_duration: number
          min_lease_duration: number
          registration_deadline_days: number
          tax_rate: number
          tax_rates: Json
          template_label: string
          template_type: string
          terms: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          custom_fields?: Json | null
          gra_tax_enabled?: boolean
          id?: string
          max_advance_months?: number
          max_lease_duration?: number
          min_lease_duration?: number
          registration_deadline_days?: number
          tax_rate?: number
          tax_rates?: Json
          template_label?: string
          template_type?: string
          terms?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          custom_fields?: Json | null
          gra_tax_enabled?: boolean
          id?: string
          max_advance_months?: number
          max_lease_duration?: number
          min_lease_duration?: number
          registration_deadline_days?: number
          tax_rate?: number
          tax_rates?: Json
          template_label?: string
          template_type?: string
          terms?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_access_requests: {
        Row: {
          agency_type: string | null
          cancelled_at: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          id: string
          intended_volume_monthly: number | null
          issued_api_key_id: string | null
          justification: string | null
          notified_at: string | null
          org_id: string
          requested_environment: string
          requested_scopes: string[]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_type?: string | null
          cancelled_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          id?: string
          intended_volume_monthly?: number | null
          issued_api_key_id?: string | null
          justification?: string | null
          notified_at?: string | null
          org_id: string
          requested_environment?: string
          requested_scopes?: string[]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_type?: string | null
          cancelled_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          id?: string
          intended_volume_monthly?: number | null
          issued_api_key_id?: string | null
          justification?: string | null
          notified_at?: string | null
          org_id?: string
          requested_environment?: string
          requested_scopes?: string[]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_access_requests_issued_api_key_id_fkey"
            columns: ["issued_api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_access_requests_issued_api_key_id_fkey"
            columns: ["issued_api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_developer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_access_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "developer_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_dsa_versions: {
        Row: {
          body_markdown: string
          created_at: string
          effective_from: string
          id: string
          is_current: boolean
          title: string
          version: string
        }
        Insert: {
          body_markdown: string
          created_at?: string
          effective_from?: string
          id?: string
          is_current?: boolean
          title: string
          version: string
        }
        Update: {
          body_markdown?: string
          created_at?: string
          effective_from?: string
          id?: string
          is_current?: boolean
          title?: string
          version?: string
        }
        Relationships: []
      }
      api_idempotency_keys: {
        Row: {
          api_key_id: string
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          request_hash: string
          response_body: Json | null
          response_status: number
        }
        Insert: {
          api_key_id: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          request_hash: string
          response_body?: Json | null
          response_status: number
        }
        Update: {
          api_key_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          request_hash?: string
          response_body?: Json | null
          response_status?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_keys_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_idempotency_keys_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_developer_view"
            referencedColumns: ["id"]
          },
        ]
      }
      api_invoices: {
        Row: {
          amount_ghs: number
          api_key_id: string
          created_at: string
          id: string
          invoice_number: string
          line_items: Json
          paid_at: string | null
          paystack_reference: string | null
          period_end: string | null
          period_start: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_ghs: number
          api_key_id: string
          created_at?: string
          id?: string
          invoice_number?: string
          line_items?: Json
          paid_at?: string | null
          paystack_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_ghs?: number
          api_key_id?: string
          created_at?: string
          id?: string
          invoice_number?: string
          line_items?: Json
          paid_at?: string | null
          paystack_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_invoices_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_invoices_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_developer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "api_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          agency_contact_email: string | null
          agency_contact_phone: string | null
          agency_name: string
          allowed_ip_cidrs: string[] | null
          allowed_origins: string[] | null
          api_key_hash: string
          billing_override: string | null
          billing_override_price_ghs: number | null
          created_at: string
          created_by: string | null
          current_plan_id: string | null
          dsa_signed_at: string | null
          dsa_version_accepted: string | null
          environment: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_prefix: string | null
          last_used_at: string | null
          last_used_ip: unknown
          notes: string | null
          organization_id: string | null
          pinned_version: string | null
          previous_key_expires_at: string | null
          previous_key_hash: string | null
          rate_limit_per_minute: number
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          scopes: string[]
        }
        Insert: {
          agency_contact_email?: string | null
          agency_contact_phone?: string | null
          agency_name: string
          allowed_ip_cidrs?: string[] | null
          allowed_origins?: string[] | null
          api_key_hash: string
          billing_override?: string | null
          billing_override_price_ghs?: number | null
          created_at?: string
          created_by?: string | null
          current_plan_id?: string | null
          dsa_signed_at?: string | null
          dsa_version_accepted?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_prefix?: string | null
          last_used_at?: string | null
          last_used_ip?: unknown
          notes?: string | null
          organization_id?: string | null
          pinned_version?: string | null
          previous_key_expires_at?: string | null
          previous_key_hash?: string | null
          rate_limit_per_minute?: number
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
        }
        Update: {
          agency_contact_email?: string | null
          agency_contact_phone?: string | null
          agency_name?: string
          allowed_ip_cidrs?: string[] | null
          allowed_origins?: string[] | null
          api_key_hash?: string
          billing_override?: string | null
          billing_override_price_ghs?: number | null
          created_at?: string
          created_by?: string | null
          current_plan_id?: string | null
          dsa_signed_at?: string | null
          dsa_version_accepted?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_prefix?: string | null
          last_used_at?: string | null
          last_used_ip?: unknown
          notes?: string | null
          organization_id?: string | null
          pinned_version?: string | null
          previous_key_expires_at?: string | null
          previous_key_hash?: string | null
          rate_limit_per_minute?: number
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "developer_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_pricing_plans: {
        Row: {
          allowed_scopes: string[]
          created_at: string
          description: string | null
          environment_access: string
          id: string
          included_calls: number
          is_active: boolean
          is_enterprise: boolean
          is_public: boolean
          name: string
          overage_price_ghs_per_1k: number | null
          paystack_plan_code: string | null
          price_ghs: number
          rate_limit_per_minute: number
          slug: string
          sort_order: number
          updated_at: string
          webhook_endpoints_max: number
        }
        Insert: {
          allowed_scopes?: string[]
          created_at?: string
          description?: string | null
          environment_access?: string
          id?: string
          included_calls?: number
          is_active?: boolean
          is_enterprise?: boolean
          is_public?: boolean
          name: string
          overage_price_ghs_per_1k?: number | null
          paystack_plan_code?: string | null
          price_ghs?: number
          rate_limit_per_minute?: number
          slug: string
          sort_order?: number
          updated_at?: string
          webhook_endpoints_max?: number
        }
        Update: {
          allowed_scopes?: string[]
          created_at?: string
          description?: string | null
          environment_access?: string
          id?: string
          included_calls?: number
          is_active?: boolean
          is_enterprise?: boolean
          is_public?: boolean
          name?: string
          overage_price_ghs_per_1k?: number | null
          paystack_plan_code?: string | null
          price_ghs?: number
          rate_limit_per_minute?: number
          slug?: string
          sort_order?: number
          updated_at?: string
          webhook_endpoints_max?: number
        }
        Relationships: []
      }
      api_request_log: {
        Row: {
          agency_name: string | null
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip: unknown
          method: string
          request_params: Json | null
          response_ms: number | null
          scope_used: string | null
          status_code: number
          user_agent: string | null
        }
        Insert: {
          agency_name?: string | null
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip?: unknown
          method?: string
          request_params?: Json | null
          response_ms?: number | null
          scope_used?: string | null
          status_code: number
          user_agent?: string | null
        }
        Update: {
          agency_name?: string | null
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip?: unknown
          method?: string
          request_params?: Json | null
          response_ms?: number | null
          scope_used?: string | null
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_developer_view"
            referencedColumns: ["id"]
          },
        ]
      }
      api_scopes: {
        Row: {
          category: string
          created_at: string
          description: string | null
          is_active: boolean
          label: string
          scope_key: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label: string
          scope_key: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label?: string
          scope_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_subscriptions: {
        Row: {
          api_key_id: string
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          paystack_authorization_code: string | null
          paystack_customer_code: string | null
          paystack_subscription_code: string | null
          plan_id: string
          status: string
          updated_at: string
        }
        Insert: {
          api_key_id: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          paystack_authorization_code?: string | null
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          plan_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          api_key_id?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          paystack_authorization_code?: string | null
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_subscriptions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_subscriptions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_developer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "api_pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_counters: {
        Row: {
          api_key_id: string
          calls_count: number
          created_at: string
          id: string
          last_call_at: string | null
          overage_amount_ghs: number
          overage_calls: number
          period_end: string
          period_start: string
          updated_at: string
        }
        Insert: {
          api_key_id: string
          calls_count?: number
          created_at?: string
          id?: string
          last_call_at?: string | null
          overage_amount_ghs?: number
          overage_calls?: number
          period_end: string
          period_start: string
          updated_at?: string
        }
        Update: {
          api_key_id?: string
          calls_count?: number
          created_at?: string
          id?: string
          last_call_at?: string | null
          overage_amount_ghs?: number
          overage_calls?: number
          period_end?: string
          period_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_counters_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_counters_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_developer_view"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          duration_ms: number | null
          endpoint_id: string
          event_id: string
          event_type: string
          id: string
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          endpoint_id: string
          event_id?: string
          event_type: string
          id?: string
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          endpoint_id?: string
          event_id?: string
          event_type?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "api_webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhook_endpoints: {
        Row: {
          api_key_id: string
          consecutive_failures: number
          created_at: string
          description: string | null
          events: string[]
          id: string
          last_delivery_at: string | null
          last_success_at: string | null
          secret: string
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          api_key_id: string
          consecutive_failures?: number
          created_at?: string
          description?: string | null
          events?: string[]
          id?: string
          last_delivery_at?: string | null
          last_success_at?: string | null
          secret: string
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          api_key_id?: string
          consecutive_failures?: number
          created_at?: string
          description?: string | null
          events?: string[]
          id?: string
          last_delivery_at?: string | null
          last_success_at?: string | null
          secret?: string
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhook_endpoints_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_webhook_endpoints_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_developer_view"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          page_url: string | null
          rating: number | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          rating?: number | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          rating?: number | null
          user_id?: string
        }
        Relationships: []
      }
      case_payment_reconciliation_log: {
        Row: {
          action: string
          actor_id: string | null
          case_payment_id: string | null
          created_at: string
          id: string
          ledger_update_reference: string | null
          metadata: Json | null
          new_status: string | null
          notes: string | null
          previous_status: string | null
          transaction_reference: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          case_payment_id?: string | null
          created_at?: string
          id?: string
          ledger_update_reference?: string | null
          metadata?: Json | null
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
          transaction_reference?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          case_payment_id?: string | null
          created_at?: string
          id?: string
          ledger_update_reference?: string | null
          metadata?: Json | null
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_payment_reconciliation_log_case_payment_id_fkey"
            columns: ["case_payment_id"]
            isOneToOne: false
            referencedRelation: "case_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      case_payments: {
        Row: {
          amount_paid: number
          case_id: string | null
          created_at: string
          currency: string
          escrow_transaction_id: string | null
          id: string
          ledger_entry_id: string | null
          metadata: Json
          office_id: string | null
          paid_at: string | null
          payer_user_id: string | null
          payment_provider: string
          payment_reference: string
          payment_status: string
          payment_type: string
          receipt_number: string | null
          receipt_url: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          case_id?: string | null
          created_at?: string
          currency?: string
          escrow_transaction_id?: string | null
          id?: string
          ledger_entry_id?: string | null
          metadata?: Json
          office_id?: string | null
          paid_at?: string | null
          payer_user_id?: string | null
          payment_provider?: string
          payment_reference: string
          payment_status?: string
          payment_type: string
          receipt_number?: string | null
          receipt_url?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          case_id?: string | null
          created_at?: string
          currency?: string
          escrow_transaction_id?: string | null
          id?: string
          ledger_entry_id?: string | null
          metadata?: Json
          office_id?: string | null
          paid_at?: string | null
          payer_user_id?: string | null
          payment_provider?: string
          payment_reference?: string
          payment_status?: string
          payment_type?: string
          receipt_number?: string | null
          receipt_url?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_payments_escrow_transaction_id_fkey"
            columns: ["escrow_transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_number: string
          case_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          office_id: string
          related_complaint_id: string | null
          related_property_id: string | null
          related_tenancy_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          case_number: string
          case_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          office_id: string
          related_complaint_id?: string | null
          related_property_id?: string | null
          related_tenancy_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          case_number?: string
          case_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          office_id?: string
          related_complaint_id?: string | null
          related_property_id?: string | null
          related_tenancy_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          assigned_to: string
          complaint_id: string
          complaint_table: string
          id: string
          reason: string | null
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          assigned_to: string
          complaint_id: string
          complaint_table: string
          id?: string
          reason?: string | null
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          assigned_to?: string
          complaint_id?: string
          complaint_table?: string
          id?: string
          reason?: string | null
          unassigned_at?: string | null
        }
        Relationships: []
      }
      complaint_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          case_id: string | null
          case_kind: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          case_id?: string | null
          case_kind?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          case_id?: string | null
          case_kind?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      complaint_basket_items: {
        Row: {
          admin_pct: number
          amount: number
          complaint_id: string
          complaint_table: string
          complaint_type_id: string | null
          computation_meta: Json | null
          created_at: string
          created_by: string
          fee_scope: string
          id: string
          igf_pct: number
          is_nugs_revenue: boolean
          kind: string
          label: string
          paid_at: string | null
          platform_pct: number
        }
        Insert: {
          admin_pct?: number
          amount: number
          complaint_id: string
          complaint_table: string
          complaint_type_id?: string | null
          computation_meta?: Json | null
          created_at?: string
          created_by: string
          fee_scope?: string
          id?: string
          igf_pct?: number
          is_nugs_revenue?: boolean
          kind: string
          label: string
          paid_at?: string | null
          platform_pct?: number
        }
        Update: {
          admin_pct?: number
          amount?: number
          complaint_id?: string
          complaint_table?: string
          complaint_type_id?: string | null
          computation_meta?: Json | null
          created_at?: string
          created_by?: string
          fee_scope?: string
          id?: string
          igf_pct?: number
          is_nugs_revenue?: boolean
          kind?: string
          label?: string
          paid_at?: string | null
          platform_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "complaint_basket_items_complaint_type_id_fkey"
            columns: ["complaint_type_id"]
            isOneToOne: false
            referencedRelation: "complaint_types"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_decisions: {
        Row: {
          case_id: string
          case_kind: string
          compliance_deadline: string | null
          decision_summary: string | null
          document_id: string | null
          id: string
          internal_remarks: string | null
          next_hearing_at: string | null
          officer_user_id: string
          orders: string | null
          outcome: string
          payment_orders: Json | null
          recorded_at: string
        }
        Insert: {
          case_id: string
          case_kind?: string
          compliance_deadline?: string | null
          decision_summary?: string | null
          document_id?: string | null
          id?: string
          internal_remarks?: string | null
          next_hearing_at?: string | null
          officer_user_id: string
          orders?: string | null
          outcome: string
          payment_orders?: Json | null
          recorded_at?: string
        }
        Update: {
          case_id?: string
          case_kind?: string
          compliance_deadline?: string | null
          decision_summary?: string | null
          document_id?: string | null
          id?: string
          internal_remarks?: string | null
          next_hearing_at?: string | null
          officer_user_id?: string
          orders?: string | null
          outcome?: string
          payment_orders?: Json | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_decisions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "complaint_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_documents: {
        Row: {
          body_html: string | null
          body_json: Json | null
          case_id: string
          case_kind: string
          change_reason: string | null
          edited_by: string | null
          file_url: string | null
          finalized_at: string | null
          finalized_by: string | null
          form_data_json: Json | null
          form_type: string
          generated_at: string
          generated_by: string | null
          id: string
          metadata: Json | null
          status: string
          template_origin_id: string | null
          title: string | null
          verification_code: string | null
          version_number: number
        }
        Insert: {
          body_html?: string | null
          body_json?: Json | null
          case_id: string
          case_kind?: string
          change_reason?: string | null
          edited_by?: string | null
          file_url?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          form_data_json?: Json | null
          form_type: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          template_origin_id?: string | null
          title?: string | null
          verification_code?: string | null
          version_number?: number
        }
        Update: {
          body_html?: string | null
          body_json?: Json | null
          case_id?: string
          case_kind?: string
          change_reason?: string | null
          edited_by?: string | null
          file_url?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          form_data_json?: Json | null
          form_type?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          template_origin_id?: string | null
          title?: string | null
          verification_code?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "complaint_documents_template_origin_id_fkey"
            columns: ["template_origin_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_fee_bands: {
        Row: {
          admin_pct: number
          band_label: string
          complaint_type_id: string
          display_order: number
          fee_amount: number
          id: string
          igf_pct: number
          platform_pct: number
          rent_max: number | null
          rent_min: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_pct?: number
          band_label: string
          complaint_type_id: string
          display_order?: number
          fee_amount?: number
          id?: string
          igf_pct?: number
          platform_pct?: number
          rent_max?: number | null
          rent_min?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_pct?: number
          band_label?: string
          complaint_type_id?: string
          display_order?: number
          fee_amount?: number
          id?: string
          igf_pct?: number
          platform_pct?: number
          rent_max?: number | null
          rent_min?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_fee_bands_complaint_type_id_fkey"
            columns: ["complaint_type_id"]
            isOneToOne: false
            referencedRelation: "complaint_types"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_fee_fixed: {
        Row: {
          admin_pct: number
          complaint_type_id: string
          fee_amount: number
          id: string
          igf_pct: number
          platform_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_pct?: number
          complaint_type_id: string
          fee_amount?: number
          id?: string
          igf_pct?: number
          platform_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_pct?: number
          complaint_type_id?: string
          fee_amount?: number
          id?: string
          igf_pct?: number
          platform_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_fee_fixed_complaint_type_id_fkey"
            columns: ["complaint_type_id"]
            isOneToOne: true
            referencedRelation: "complaint_types"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_fee_percentage: {
        Row: {
          above_threshold_pct: number
          admin_pct: number
          base_source: string
          below_threshold_pct: number
          complaint_type_id: string
          id: string
          igf_pct: number
          platform_pct: number
          threshold_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          above_threshold_pct?: number
          admin_pct?: number
          base_source?: string
          below_threshold_pct?: number
          complaint_type_id: string
          id?: string
          igf_pct?: number
          platform_pct?: number
          threshold_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          above_threshold_pct?: number
          admin_pct?: number
          base_source?: string
          below_threshold_pct?: number
          complaint_type_id?: string
          id?: string
          igf_pct?: number
          platform_pct?: number
          threshold_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_fee_percentage_complaint_type_id_fkey"
            columns: ["complaint_type_id"]
            isOneToOne: true
            referencedRelation: "complaint_types"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_fee_revisions: {
        Row: {
          changed_by: string | null
          complaint_id: string
          created_at: string
          id: string
          new_amount: number | null
          old_amount: number | null
          reason: string | null
          scope: string
        }
        Insert: {
          changed_by?: string | null
          complaint_id: string
          created_at?: string
          id?: string
          new_amount?: number | null
          old_amount?: number | null
          reason?: string | null
          scope?: string
        }
        Update: {
          changed_by?: string | null
          complaint_id?: string
          created_at?: string
          id?: string
          new_amount?: number | null
          old_amount?: number | null
          reason?: string | null
          scope?: string
        }
        Relationships: []
      }
      complaint_hearings: {
        Row: {
          attendance: Json | null
          case_id: string
          case_kind: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          officer_user_id: string | null
          outcome: string | null
          priority: string | null
          reschedule_reason: string | null
          room_id: string | null
          room_label: string | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attendance?: Json | null
          case_id: string
          case_kind?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          officer_user_id?: string | null
          outcome?: string | null
          priority?: string | null
          reschedule_reason?: string | null
          room_id?: string | null
          room_label?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          attendance?: Json | null
          case_id?: string
          case_kind?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          officer_user_id?: string | null
          outcome?: string | null
          priority?: string | null
          reschedule_reason?: string | null
          room_id?: string | null
          room_label?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_hearings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hearing_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_notes: {
        Row: {
          author_role: string
          author_user_id: string
          body: string
          case_kind: string
          complaint_id: string
          created_at: string
          edit_history: Json | null
          id: string
          note_type: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_role?: string
          author_user_id: string
          body: string
          case_kind?: string
          complaint_id: string
          created_at?: string
          edit_history?: Json | null
          id?: string
          note_type?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_role?: string
          author_user_id?: string
          body?: string
          case_kind?: string
          complaint_id?: string
          created_at?: string
          edit_history?: Json | null
          id?: string
          note_type?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      complaint_properties: {
        Row: {
          address_description: string | null
          complaint_id: string | null
          created_at: string
          gps_code: string | null
          id: string
          landlord_name: string
          lat: number | null
          lng: number | null
          location_method: string
          monthly_rent: number
          place_id: string | null
          place_name: string | null
          property_name: string | null
          property_type: string
          tenant_user_id: string
          unit_description: string | null
        }
        Insert: {
          address_description?: string | null
          complaint_id?: string | null
          created_at?: string
          gps_code?: string | null
          id?: string
          landlord_name: string
          lat?: number | null
          lng?: number | null
          location_method: string
          monthly_rent?: number
          place_id?: string | null
          place_name?: string | null
          property_name?: string | null
          property_type: string
          tenant_user_id: string
          unit_description?: string | null
        }
        Update: {
          address_description?: string | null
          complaint_id?: string | null
          created_at?: string
          gps_code?: string | null
          id?: string
          landlord_name?: string
          lat?: number | null
          lng?: number | null
          location_method?: string
          monthly_rent?: number
          place_id?: string | null
          place_name?: string | null
          property_name?: string | null
          property_type?: string
          tenant_user_id?: string
          unit_description?: string | null
        }
        Relationships: []
      }
      complaint_schedules: {
        Row: {
          available_slots: Json
          complaint_id: string
          complaint_type: string
          created_at: string
          created_by: string
          id: string
          selected_at: string | null
          selected_by: string | null
          selected_slot: Json | null
          status: string
        }
        Insert: {
          available_slots?: Json
          complaint_id: string
          complaint_type?: string
          created_at?: string
          created_by: string
          id?: string
          selected_at?: string | null
          selected_by?: string | null
          selected_slot?: Json | null
          status?: string
        }
        Update: {
          available_slots?: Json
          complaint_id?: string
          complaint_type?: string
          created_at?: string
          created_by?: string
          id?: string
          selected_at?: string | null
          selected_by?: string | null
          selected_slot?: Json | null
          status?: string
        }
        Relationships: []
      }
      complaint_status_history: {
        Row: {
          case_id: string
          case_kind: string
          changed_at: string
          changed_by: string | null
          id: string
          new_status: string
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          case_id: string
          case_kind?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: string
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          case_id?: string
          case_kind?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      complaint_types: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          fee_amount: number | null
          fee_mode: string
          fee_percentage: number | null
          fee_structure: string
          id: string
          key: string
          label: string
          rent_band_config: Json | null
          requires_property_link: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          fee_amount?: number | null
          fee_mode?: string
          fee_percentage?: number | null
          fee_structure?: string
          id?: string
          key: string
          label: string
          rent_band_config?: Json | null
          requires_property_link?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          fee_amount?: number | null
          fee_mode?: string
          fee_percentage?: number | null
          fee_structure?: string
          id?: string
          key?: string
          label?: string
          rent_band_config?: Json | null
          requires_property_link?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      complaint_witnesses: {
        Row: {
          address: string | null
          case_id: string
          case_kind: string
          created_at: string
          created_by: string | null
          email: string | null
          expected_testimony: string | null
          id: string
          name: string
          phone: string | null
          side: string
        }
        Insert: {
          address?: string | null
          case_id: string
          case_kind?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expected_testimony?: string | null
          id?: string
          name: string
          phone?: string | null
          side: string
        }
        Update: {
          address?: string | null
          case_id?: string
          case_kind?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expected_testimony?: string | null
          id?: string
          name?: string
          phone?: string | null
          side?: string
        }
        Relationships: []
      }
      complaints: {
        Row: {
          admin_filer_user_id: string | null
          agreement_expiry_date: string | null
          assigned_nugs_user_id: string | null
          assigned_officer_user_id: string | null
          audio_url: string | null
          basket_total: number | null
          case_number: string | null
          claim_amount: number | null
          complainant_address: string | null
          complainant_gps_lat: number | null
          complainant_gps_lng: number | null
          complainant_role: string | null
          complainant_user_id: string | null
          complainants: Json | null
          complaint_code: string
          complaint_property_id: string | null
          complaint_title: string | null
          complaint_type: string
          complaint_type_id: string | null
          complaint_type_is_custom: boolean
          created_at: string
          created_by_user_id: string | null
          current_stage: string
          deposit_amount: number | null
          description: string
          escalated_at: string | null
          escalated_by: string | null
          escalated_to_rent_control: boolean
          escalation_reason: string | null
          evidence_urls: string[] | null
          filed_by_admin: boolean
          filing_fee_paid: boolean
          filing_fee_paid_at: string | null
          gps_confirmed: boolean
          gps_confirmed_at: string | null
          gps_location: string | null
          hearing_officer_name: string | null
          hearing_room_id: string | null
          hearing_venue: string | null
          id: string
          internal_notes: string | null
          landlord_name: string
          last_activity_at: string
          linked_property_id: string | null
          linked_unit_id: string | null
          next_hearing_at: string | null
          nugs_school: string | null
          occupied_months: number | null
          office_id: string | null
          outstanding_amount: number | null
          payment_status: string
          physical_docket_ref: string | null
          placeholder_complainant_name: string | null
          placeholder_complainant_phone: string | null
          placeholder_respondent_name: string | null
          placeholder_respondent_phone: string | null
          premises_house_no: string | null
          premises_town: string | null
          property_address: string
          receipt_id: string | null
          region: string
          relief_sought: string | null
          rent_amount: number | null
          respondent_role: string | null
          respondent_user_id: string | null
          respondents: Json | null
          status: string
          summons_issued_at: string | null
          tenant_user_id: string | null
          tenants_intent: string | null
          ticket_number: string
          updated_at: string
          version: number
        }
        Insert: {
          admin_filer_user_id?: string | null
          agreement_expiry_date?: string | null
          assigned_nugs_user_id?: string | null
          assigned_officer_user_id?: string | null
          audio_url?: string | null
          basket_total?: number | null
          case_number?: string | null
          claim_amount?: number | null
          complainant_address?: string | null
          complainant_gps_lat?: number | null
          complainant_gps_lng?: number | null
          complainant_role?: string | null
          complainant_user_id?: string | null
          complainants?: Json | null
          complaint_code: string
          complaint_property_id?: string | null
          complaint_title?: string | null
          complaint_type: string
          complaint_type_id?: string | null
          complaint_type_is_custom?: boolean
          created_at?: string
          created_by_user_id?: string | null
          current_stage?: string
          deposit_amount?: number | null
          description: string
          escalated_at?: string | null
          escalated_by?: string | null
          escalated_to_rent_control?: boolean
          escalation_reason?: string | null
          evidence_urls?: string[] | null
          filed_by_admin?: boolean
          filing_fee_paid?: boolean
          filing_fee_paid_at?: string | null
          gps_confirmed?: boolean
          gps_confirmed_at?: string | null
          gps_location?: string | null
          hearing_officer_name?: string | null
          hearing_room_id?: string | null
          hearing_venue?: string | null
          id?: string
          internal_notes?: string | null
          landlord_name: string
          last_activity_at?: string
          linked_property_id?: string | null
          linked_unit_id?: string | null
          next_hearing_at?: string | null
          nugs_school?: string | null
          occupied_months?: number | null
          office_id?: string | null
          outstanding_amount?: number | null
          payment_status?: string
          physical_docket_ref?: string | null
          placeholder_complainant_name?: string | null
          placeholder_complainant_phone?: string | null
          placeholder_respondent_name?: string | null
          placeholder_respondent_phone?: string | null
          premises_house_no?: string | null
          premises_town?: string | null
          property_address: string
          receipt_id?: string | null
          region: string
          relief_sought?: string | null
          rent_amount?: number | null
          respondent_role?: string | null
          respondent_user_id?: string | null
          respondents?: Json | null
          status?: string
          summons_issued_at?: string | null
          tenant_user_id?: string | null
          tenants_intent?: string | null
          ticket_number?: string
          updated_at?: string
          version?: number
        }
        Update: {
          admin_filer_user_id?: string | null
          agreement_expiry_date?: string | null
          assigned_nugs_user_id?: string | null
          assigned_officer_user_id?: string | null
          audio_url?: string | null
          basket_total?: number | null
          case_number?: string | null
          claim_amount?: number | null
          complainant_address?: string | null
          complainant_gps_lat?: number | null
          complainant_gps_lng?: number | null
          complainant_role?: string | null
          complainant_user_id?: string | null
          complainants?: Json | null
          complaint_code?: string
          complaint_property_id?: string | null
          complaint_title?: string | null
          complaint_type?: string
          complaint_type_id?: string | null
          complaint_type_is_custom?: boolean
          created_at?: string
          created_by_user_id?: string | null
          current_stage?: string
          deposit_amount?: number | null
          description?: string
          escalated_at?: string | null
          escalated_by?: string | null
          escalated_to_rent_control?: boolean
          escalation_reason?: string | null
          evidence_urls?: string[] | null
          filed_by_admin?: boolean
          filing_fee_paid?: boolean
          filing_fee_paid_at?: string | null
          gps_confirmed?: boolean
          gps_confirmed_at?: string | null
          gps_location?: string | null
          hearing_officer_name?: string | null
          hearing_room_id?: string | null
          hearing_venue?: string | null
          id?: string
          internal_notes?: string | null
          landlord_name?: string
          last_activity_at?: string
          linked_property_id?: string | null
          linked_unit_id?: string | null
          next_hearing_at?: string | null
          nugs_school?: string | null
          occupied_months?: number | null
          office_id?: string | null
          outstanding_amount?: number | null
          payment_status?: string
          physical_docket_ref?: string | null
          placeholder_complainant_name?: string | null
          placeholder_complainant_phone?: string | null
          placeholder_respondent_name?: string | null
          placeholder_respondent_phone?: string | null
          premises_house_no?: string | null
          premises_town?: string | null
          property_address?: string
          receipt_id?: string | null
          region?: string
          relief_sought?: string | null
          rent_amount?: number | null
          respondent_role?: string | null
          respondent_user_id?: string | null
          respondents?: Json | null
          status?: string
          summons_issued_at?: string | null
          tenant_user_id?: string | null
          tenants_intent?: string | null
          ticket_number?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "complaints_complaint_property_id_fkey"
            columns: ["complaint_property_id"]
            isOneToOne: false
            referencedRelation: "complaint_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_complaint_type_id_fkey"
            columns: ["complaint_type_id"]
            isOneToOne: false
            referencedRelation: "complaint_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "complaints_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "payment_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_message_replies: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          replied_by: string | null
          subject: string | null
          submission_id: string
          template_used: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          id?: string
          replied_by?: string | null
          subject?: string | null
          submission_id: string
          template_used?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          replied_by?: string | null
          subject?: string | null
          submission_id?: string
          template_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_message_replies_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "contact_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_reply_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          last_replied_at: string | null
          message: string
          name: string
          phone: string | null
          reply_count: number
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_replied_at?: string | null
          message: string
          name: string
          phone?: string | null
          reply_count?: number
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_replied_at?: string | null
          message?: string
          name?: string
          phone?: string | null
          reply_count?: number
          status?: string
        }
        Relationships: []
      }
      daily_stock_reports: {
        Row: {
          assigned_today: number
          closing_pairs: number
          created_at: string
          id: string
          notes: string | null
          office_id: string
          office_name: string
          opening_pairs: number
          report_date: string
          signed_name: string | null
          sold_today: number
          spoilt_today: number
          staff_name: string
          staff_user_id: string
        }
        Insert: {
          assigned_today?: number
          closing_pairs?: number
          created_at?: string
          id?: string
          notes?: string | null
          office_id: string
          office_name: string
          opening_pairs?: number
          report_date: string
          signed_name?: string | null
          sold_today?: number
          spoilt_today?: number
          staff_name: string
          staff_user_id: string
        }
        Update: {
          assigned_today?: number
          closing_pairs?: number
          created_at?: string
          id?: string
          notes?: string | null
          office_id?: string
          office_name?: string
          opening_pairs?: number
          report_date?: string
          signed_name?: string | null
          sold_today?: number
          spoilt_today?: number
          staff_name?: string
          staff_user_id?: string
        }
        Relationships: []
      }
      developer_org_members: {
        Row: {
          created_at: string
          id: string
          member_role: string
          org_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_role?: string
          org_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_role?: string
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "developer_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_organizations: {
        Row: {
          account_status: string
          agency_type: string | null
          contact_email: string
          contact_phone: string | null
          created_at: string
          dsa_signed_at: string | null
          dsa_version_accepted: string | null
          id: string
          intended_use_case: string | null
          name: string
          owner_user_id: string
          status_changed_at: string | null
          status_changed_by: string | null
          status_reason: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          account_status?: string
          agency_type?: string | null
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          dsa_signed_at?: string | null
          dsa_version_accepted?: string | null
          id?: string
          intended_use_case?: string | null
          name: string
          owner_user_id: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          account_status?: string
          agency_type?: string | null
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          dsa_signed_at?: string | null
          dsa_version_accepted?: string | null
          id?: string
          intended_use_case?: string | null
          name?: string
          owner_user_id?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      escrow_splits: {
        Row: {
          amount: number
          complaint_basket_item_id: string | null
          correction_run_id: string | null
          description: string | null
          disbursement_status: string
          escrow_transaction_id: string
          id: string
          is_service_fee: boolean
          office_id: string | null
          payout_readiness: string
          recipient: string
          release_mode: string
          released_at: string | null
          status: string
          superseded_at: string | null
        }
        Insert: {
          amount: number
          complaint_basket_item_id?: string | null
          correction_run_id?: string | null
          description?: string | null
          disbursement_status?: string
          escrow_transaction_id: string
          id?: string
          is_service_fee?: boolean
          office_id?: string | null
          payout_readiness?: string
          recipient: string
          release_mode?: string
          released_at?: string | null
          status?: string
          superseded_at?: string | null
        }
        Update: {
          amount?: number
          complaint_basket_item_id?: string | null
          correction_run_id?: string | null
          description?: string | null
          disbursement_status?: string
          escrow_transaction_id?: string
          id?: string
          is_service_fee?: boolean
          office_id?: string | null
          payout_readiness?: string
          recipient?: string
          release_mode?: string
          released_at?: string | null
          status?: string
          superseded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_splits_escrow_transaction_id_fkey"
            columns: ["escrow_transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          case_id: string | null
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          is_nugs_revenue: boolean
          is_student_revenue: boolean
          metadata: Json | null
          nugs_office_id: string | null
          office_id: string | null
          officer_id: string | null
          payment_intent_id: string | null
          payment_type: string
          paystack_transaction_id: string | null
          reference: string | null
          related_complaint_id: string | null
          related_property_id: string | null
          related_tenancy_id: string | null
          sales_channel_id: string | null
          service_record_id: string | null
          status: string
          total_amount: number
          user_id: string
        }
        Insert: {
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_nugs_revenue?: boolean
          is_student_revenue?: boolean
          metadata?: Json | null
          nugs_office_id?: string | null
          office_id?: string | null
          officer_id?: string | null
          payment_intent_id?: string | null
          payment_type: string
          paystack_transaction_id?: string | null
          reference?: string | null
          related_complaint_id?: string | null
          related_property_id?: string | null
          related_tenancy_id?: string | null
          sales_channel_id?: string | null
          service_record_id?: string | null
          status?: string
          total_amount: number
          user_id: string
        }
        Update: {
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_nugs_revenue?: boolean
          is_student_revenue?: boolean
          metadata?: Json | null
          nugs_office_id?: string | null
          office_id?: string | null
          officer_id?: string | null
          payment_intent_id?: string | null
          payment_type?: string
          paystack_transaction_id?: string | null
          reference?: string | null
          related_complaint_id?: string | null
          related_property_id?: string | null
          related_tenancy_id?: string | null
          sales_channel_id?: string | null
          service_record_id?: string | null
          status?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "escrow_transactions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "rent_card_sales_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          feature_key: string
          id: string
          is_enabled: boolean
          target_type: string
          target_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          feature_key: string
          id?: string
          is_enabled?: boolean
          target_type: string
          target_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          feature_key?: string
          id?: string
          is_enabled?: boolean
          target_type?: string
          target_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          category: string
          description: string | null
          feature_key: string
          fee_amount: number | null
          fee_enabled: boolean
          id: string
          is_enabled: boolean
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          description?: string | null
          feature_key: string
          fee_amount?: number | null
          fee_enabled?: boolean
          id?: string
          is_enabled?: boolean
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          description?: string | null
          feature_key?: string
          fee_amount?: number | null
          fee_enabled?: boolean
          id?: string
          is_enabled?: boolean
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      feature_label_overrides: {
        Row: {
          custom_label: string
          feature_key: string
          id: string
          original_label: string
          portal: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          custom_label: string
          feature_key: string
          id?: string
          original_label: string
          portal?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          custom_label?: string
          feature_key?: string
          id?: string
          original_label?: string
          portal?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          complaint_id: string | null
          created_at: string
          data: Json
          generated_by: string | null
          id: string
          pdf_url: string | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          complaint_id?: string | null
          created_at?: string
          data?: Json
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          complaint_id?: string | null
          created_at?: string
          data?: Json
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          body_html: string | null
          category: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          effective_date: string | null
          form_name: string
          form_number: string | null
          id: string
          layout: Json
          regulation_ref: string | null
          schema: Json
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          body_html?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          effective_date?: string | null
          form_name: string
          form_number?: string | null
          id?: string
          layout?: Json
          regulation_ref?: string | null
          schema?: Json
          status?: string
          updated_at?: string
          version?: string
        }
        Update: {
          body_html?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          effective_date?: string | null
          form_name?: string
          form_number?: string | null
          id?: string
          layout?: Json
          regulation_ref?: string | null
          schema?: Json
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      generation_batches: {
        Row: {
          batch_label: string
          created_at: string | null
          generated_by: string
          id: string
          paired_mode: boolean | null
          prefix: string
          region_details: Json
          regions: string[]
          total_physical_cards: number
          total_unique_serials: number
        }
        Insert: {
          batch_label: string
          created_at?: string | null
          generated_by: string
          id?: string
          paired_mode?: boolean | null
          prefix: string
          region_details?: Json
          regions?: string[]
          total_physical_cards?: number
          total_unique_serials?: number
        }
        Update: {
          batch_label?: string
          created_at?: string | null
          generated_by?: string
          id?: string
          paired_mode?: boolean | null
          prefix?: string
          region_details?: Json
          regions?: string[]
          total_physical_cards?: number
          total_unique_serials?: number
        }
        Relationships: []
      }
      ghana_post_gps_cache: {
        Row: {
          area: string | null
          code: string
          district: string | null
          formatted: string | null
          lat: number
          lng: number
          region: string | null
          resolved_at: string
        }
        Insert: {
          area?: string | null
          code: string
          district?: string | null
          formatted?: string | null
          lat: number
          lng: number
          region?: string | null
          resolved_at?: string
        }
        Update: {
          area?: string | null
          code?: string
          district?: string | null
          formatted?: string | null
          lat?: number
          lng?: number
          region?: string | null
          resolved_at?: string
        }
        Relationships: []
      }
      hearing_rooms: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          id: string
          name: string
          office_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          name: string
          office_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          name?: string
          office_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hearing_rooms_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "hearing_rooms_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_room_categories: {
        Row: {
          block_label: string | null
          capacity_per_room: number
          created_at: string
          id: string
          label: string
          monthly_rent: number
          property_id: string
          room_count: number
        }
        Insert: {
          block_label?: string | null
          capacity_per_room: number
          created_at?: string
          id?: string
          label: string
          monthly_rent?: number
          property_id: string
          room_count: number
        }
        Update: {
          block_label?: string | null
          capacity_per_room?: number
          created_at?: string
          id?: string
          label?: string
          monthly_rent?: number
          property_id?: string
          room_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "hostel_room_categories_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_rooms: {
        Row: {
          block_label: string
          capacity: number
          category_id: string
          created_at: string
          id: string
          property_id: string
          room_number: string
        }
        Insert: {
          block_label?: string
          capacity: number
          category_id: string
          created_at?: string
          id?: string
          property_id: string
          room_number: string
        }
        Update: {
          block_label?: string
          capacity?: number
          category_id?: string
          created_at?: string
          id?: string
          property_id?: string
          room_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_rooms_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "hostel_room_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_rooms_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      illegal_payment_attempts: {
        Row: {
          attempted_amount: number
          created_at: string
          description: string | null
          id: string
          max_lawful_amount: number
          tenancy_id: string
          user_id: string
        }
        Insert: {
          attempted_amount: number
          created_at?: string
          description?: string | null
          id?: string
          max_lawful_amount: number
          tenancy_id: string
          user_id: string
        }
        Update: {
          attempted_amount?: number
          created_at?: string
          description?: string | null
          id?: string
          max_lawful_amount?: number
          tenancy_id?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          adjustment_type: string
          correction_tag: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          note: string | null
          office_id: string
          office_name: string
          performed_by: string
          quantity: number
          reason: string
          reference_id: string | null
          region: string
        }
        Insert: {
          adjustment_type: string
          correction_tag?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          office_id: string
          office_name: string
          performed_by: string
          quantity: number
          reason: string
          reference_id?: string | null
          region: string
        }
        Update: {
          adjustment_type?: string
          correction_tag?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          office_id?: string
          office_name?: string
          performed_by?: string
          quantity?: number
          reason?: string
          reference_id?: string | null
          region?: string
        }
        Relationships: []
      }
      issue_correction_log: {
        Row: {
          admin_user_id: string
          after_state: Json | null
          before_state: Json | null
          correction_type: string
          created_at: string
          evidence_url: string | null
          id: string
          issue_id: string | null
          reason: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          admin_user_id: string
          after_state?: Json | null
          before_state?: Json | null
          correction_type: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          issue_id?: string | null
          reason: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          admin_user_id?: string
          after_state?: Json | null
          before_state?: Json | null
          correction_type?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          issue_id?: string | null
          reason?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_correction_log_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_messages: {
        Row: {
          attachment_url: string | null
          body: string
          created_at: string
          id: string
          issue_id: string
          sender_role: string
          sender_user_id: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          created_at?: string
          id?: string
          issue_id: string
          sender_role: string
          sender_user_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          issue_id?: string
          sender_role?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_messages_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_reports: {
        Row: {
          affected_service: Database["public"]["Enums"]["issue_service"]
          assigned_admin_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          issue_type: Database["public"]["Enums"]["issue_type"]
          reference_code: string | null
          reporter_role: string
          reporter_user_id: string
          resolution_summary: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["issue_status"]
          ticket_number: string
          updated_at: string
        }
        Insert: {
          affected_service: Database["public"]["Enums"]["issue_service"]
          assigned_admin_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          issue_type: Database["public"]["Enums"]["issue_type"]
          reference_code?: string | null
          reporter_role: string
          reporter_user_id: string
          resolution_summary?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          affected_service?: Database["public"]["Enums"]["issue_service"]
          assigned_admin_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          issue_type?: Database["public"]["Enums"]["issue_type"]
          reference_code?: string | null
          reporter_role?: string
          reporter_user_id?: string
          resolution_summary?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          ticket_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      kyc_verifications: {
        Row: {
          ai_match_result: string | null
          ai_match_score: number | null
          created_at: string
          ghana_card_back_url: string | null
          ghana_card_front_url: string | null
          ghana_card_number: string
          id: string
          nia_response: Json | null
          nia_verified: boolean | null
          reviewed_at: string | null
          reviewer_notes: string | null
          reviewer_user_id: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_match_result?: string | null
          ai_match_score?: number | null
          created_at?: string
          ghana_card_back_url?: string | null
          ghana_card_front_url?: string | null
          ghana_card_number: string
          id?: string
          nia_response?: Json | null
          nia_verified?: boolean | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_match_result?: string | null
          ai_match_score?: number | null
          created_at?: string
          ghana_card_back_url?: string | null
          ghana_card_front_url?: string | null
          ghana_card_number?: string
          id?: string
          nia_response?: Json | null
          nia_verified?: boolean | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      landlord_applications: {
        Row: {
          application_type: string
          audio_url: string | null
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          landlord_user_id: string
          reviewed_at: string | null
          reviewer_notes: string | null
          reviewer_user_id: string | null
          status: string
          subject: string
        }
        Insert: {
          application_type: string
          audio_url?: string | null
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          landlord_user_id: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          subject: string
        }
        Update: {
          application_type?: string
          audio_url?: string | null
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          landlord_user_id?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      landlord_complaints: {
        Row: {
          admin_filer_user_id: string | null
          agreement_expiry_date: string | null
          assigned_officer_user_id: string | null
          audio_url: string | null
          basket_total: number | null
          claim_amount: number | null
          complainant_address: string | null
          complainant_gps_lat: number | null
          complainant_gps_lng: number | null
          complainant_role: string | null
          complainants: Json | null
          complaint_code: string
          complaint_title: string | null
          complaint_type: string
          complaint_type_id: string | null
          created_at: string
          created_by_user_id: string | null
          current_stage: string
          deposit_amount: number | null
          description: string
          evidence_urls: string[] | null
          filed_by_admin: boolean
          filing_fee_paid: boolean
          filing_fee_paid_at: string | null
          gps_confirmed: boolean
          hearing_room_id: string | null
          id: string
          internal_notes: string | null
          landlord_user_id: string | null
          last_activity_at: string
          linked_property_id: string | null
          linked_unit_id: string | null
          next_hearing_at: string | null
          occupied_months: number | null
          office_id: string | null
          outstanding_amount: number | null
          payment_status: string
          physical_docket_ref: string | null
          placeholder_landlord_name: string | null
          placeholder_landlord_phone: string | null
          placeholder_respondent_name: string | null
          placeholder_respondent_phone: string | null
          premises_house_no: string | null
          premises_town: string | null
          property_address: string
          receipt_id: string | null
          region: string
          relief_sought: string | null
          rent_amount: number | null
          respondent_role: string | null
          respondents: Json | null
          status: string
          tenant_name: string | null
          tenants_intent: string | null
          ticket_number: string
          updated_at: string
          version: number
        }
        Insert: {
          admin_filer_user_id?: string | null
          agreement_expiry_date?: string | null
          assigned_officer_user_id?: string | null
          audio_url?: string | null
          basket_total?: number | null
          claim_amount?: number | null
          complainant_address?: string | null
          complainant_gps_lat?: number | null
          complainant_gps_lng?: number | null
          complainant_role?: string | null
          complainants?: Json | null
          complaint_code: string
          complaint_title?: string | null
          complaint_type: string
          complaint_type_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          current_stage?: string
          deposit_amount?: number | null
          description: string
          evidence_urls?: string[] | null
          filed_by_admin?: boolean
          filing_fee_paid?: boolean
          filing_fee_paid_at?: string | null
          gps_confirmed?: boolean
          hearing_room_id?: string | null
          id?: string
          internal_notes?: string | null
          landlord_user_id?: string | null
          last_activity_at?: string
          linked_property_id?: string | null
          linked_unit_id?: string | null
          next_hearing_at?: string | null
          occupied_months?: number | null
          office_id?: string | null
          outstanding_amount?: number | null
          payment_status?: string
          physical_docket_ref?: string | null
          placeholder_landlord_name?: string | null
          placeholder_landlord_phone?: string | null
          placeholder_respondent_name?: string | null
          placeholder_respondent_phone?: string | null
          premises_house_no?: string | null
          premises_town?: string | null
          property_address: string
          receipt_id?: string | null
          region: string
          relief_sought?: string | null
          rent_amount?: number | null
          respondent_role?: string | null
          respondents?: Json | null
          status?: string
          tenant_name?: string | null
          tenants_intent?: string | null
          ticket_number?: string
          updated_at?: string
          version?: number
        }
        Update: {
          admin_filer_user_id?: string | null
          agreement_expiry_date?: string | null
          assigned_officer_user_id?: string | null
          audio_url?: string | null
          basket_total?: number | null
          claim_amount?: number | null
          complainant_address?: string | null
          complainant_gps_lat?: number | null
          complainant_gps_lng?: number | null
          complainant_role?: string | null
          complainants?: Json | null
          complaint_code?: string
          complaint_title?: string | null
          complaint_type?: string
          complaint_type_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          current_stage?: string
          deposit_amount?: number | null
          description?: string
          evidence_urls?: string[] | null
          filed_by_admin?: boolean
          filing_fee_paid?: boolean
          filing_fee_paid_at?: string | null
          gps_confirmed?: boolean
          hearing_room_id?: string | null
          id?: string
          internal_notes?: string | null
          landlord_user_id?: string | null
          last_activity_at?: string
          linked_property_id?: string | null
          linked_unit_id?: string | null
          next_hearing_at?: string | null
          occupied_months?: number | null
          office_id?: string | null
          outstanding_amount?: number | null
          payment_status?: string
          physical_docket_ref?: string | null
          placeholder_landlord_name?: string | null
          placeholder_landlord_phone?: string | null
          placeholder_respondent_name?: string | null
          placeholder_respondent_phone?: string | null
          premises_house_no?: string | null
          premises_town?: string | null
          property_address?: string
          receipt_id?: string | null
          region?: string
          relief_sought?: string | null
          rent_amount?: number | null
          respondent_role?: string | null
          respondents?: Json | null
          status?: string
          tenant_name?: string | null
          tenants_intent?: string | null
          ticket_number?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "landlord_complaints_complaint_type_id_fkey"
            columns: ["complaint_type_id"]
            isOneToOne: false
            referencedRelation: "complaint_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landlord_complaints_linked_unit_id_fkey"
            columns: ["linked_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landlord_complaints_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "landlord_complaints_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landlord_complaints_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "payment_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_payment_settings: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          created_at: string
          id: string
          landlord_user_id: string
          momo_number: string | null
          momo_provider: string | null
          payment_method: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          landlord_user_id: string
          momo_number?: string | null
          momo_provider?: string | null
          payment_method?: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          landlord_user_id?: string
          momo_number?: string | null
          momo_provider?: string | null
          payment_method?: string
          updated_at?: string
        }
        Relationships: []
      }
      landlords: {
        Row: {
          account_status: string
          compliance_score: number
          created_at: string
          expiry_date: string | null
          id: string
          landlord_id: string
          registration_date: string | null
          registration_fee_paid: boolean
          rent_card_delivery_requested: boolean
          status: string
          user_id: string
        }
        Insert: {
          account_status?: string
          compliance_score?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          landlord_id: string
          registration_date?: string | null
          registration_fee_paid?: boolean
          rent_card_delivery_requested?: boolean
          status?: string
          user_id: string
        }
        Update: {
          account_status?: string
          compliance_score?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          landlord_id?: string
          registration_date?: string | null
          registration_fee_paid?: boolean
          rent_card_delivery_requested?: boolean
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      management_task_assignments: {
        Row: {
          assigned_at: string | null
          assigned_office_id: string | null
          assigned_staff_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          property_id: string
          source_id: string | null
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_office_id?: string | null
          assigned_staff_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          property_id: string
          source_id?: string | null
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_office_id?: string | null
          assigned_staff_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          property_id?: string
          source_id?: string | null
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_task_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          receiver_user_id: string
          sender_user_id: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          receiver_user_id: string
          sender_user_id: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          receiver_user_id?: string
          sender_user_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_messages_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      module_visibility_config: {
        Row: {
          allowed_admin_ids: string[] | null
          id: string
          label_override: string | null
          level: string
          module_key: string
          section_key: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          allowed_admin_ids?: string[] | null
          id?: string
          label_override?: string | null
          level?: string
          module_key: string
          section_key: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          allowed_admin_ids?: string[] | null
          id?: string
          label_override?: string | null
          level?: string
          module_key?: string
          section_key?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      nugs_staff: {
        Row: {
          allowed_features: Json | null
          assigned_school: string
          created_at: string
          created_by: string | null
          id: string
          is_frozen: boolean
          muted_features: Json | null
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_features?: Json | null
          assigned_school: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_frozen?: boolean
          muted_features?: Json | null
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_features?: Json | null
          assigned_school?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_frozen?: boolean
          muted_features?: Json | null
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      office_allocations: {
        Row: {
          allocated_by: string
          allocation_mode: string
          batch_label: string | null
          created_at: string | null
          end_serial: string | null
          id: string
          office_id: string
          office_name: string
          quantity: number
          quota_limit: number | null
          region: string
          serial_numbers: string[]
          start_serial: string | null
        }
        Insert: {
          allocated_by: string
          allocation_mode?: string
          batch_label?: string | null
          created_at?: string | null
          end_serial?: string | null
          id?: string
          office_id: string
          office_name: string
          quantity: number
          quota_limit?: number | null
          region: string
          serial_numbers?: string[]
          start_serial?: string | null
        }
        Update: {
          allocated_by?: string
          allocation_mode?: string
          batch_label?: string | null
          created_at?: string | null
          end_serial?: string | null
          id?: string
          office_id?: string
          office_name?: string
          quantity?: number
          quota_limit?: number | null
          region?: string
          serial_numbers?: string[]
          start_serial?: string | null
        }
        Relationships: []
      }
      office_fund_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          office_id: string
          payout_reference: string | null
          purpose: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          office_id: string
          payout_reference?: string | null
          purpose: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          office_id?: string
          payout_reference?: string | null
          purpose?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_fund_requests_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "office_fund_requests_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_payout_accounts: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          id: string
          momo_number: string | null
          momo_provider: string | null
          office_id: string
          payment_method: string
          paystack_recipient_code: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          id?: string
          momo_number?: string | null
          momo_provider?: string | null
          office_id: string
          payment_method?: string
          paystack_recipient_code?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          id?: string
          momo_number?: string | null
          momo_provider?: string | null
          office_id?: string
          payment_method?: string
          paystack_recipient_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_payout_accounts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "office_payout_accounts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_reconciliation_snapshots: {
        Row: {
          assigned_pairs: number
          available_pairs: number
          created_at: string | null
          discrepancy_notes: string | null
          fulfilled_purchases: number
          id: string
          is_balanced: boolean
          office_id: string
          office_name: string
          pending_purchases: number
          snapshot_date: string
          sold_pairs: number
          spoilt_pairs: number
          total_office_stock: number
        }
        Insert: {
          assigned_pairs?: number
          available_pairs?: number
          created_at?: string | null
          discrepancy_notes?: string | null
          fulfilled_purchases?: number
          id?: string
          is_balanced?: boolean
          office_id: string
          office_name: string
          pending_purchases?: number
          snapshot_date: string
          sold_pairs?: number
          spoilt_pairs?: number
          total_office_stock?: number
        }
        Update: {
          assigned_pairs?: number
          available_pairs?: number
          created_at?: string | null
          discrepancy_notes?: string | null
          fulfilled_purchases?: number
          id?: string
          is_balanced?: boolean
          office_id?: string
          office_name?: string
          pending_purchases?: number
          snapshot_date?: string
          sold_pairs?: number
          spoilt_pairs?: number
          total_office_stock?: number
        }
        Relationships: []
      }
      offices: {
        Row: {
          created_at: string | null
          id: string
          name: string
          region: string
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
          region: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          region?: string
        }
        Relationships: []
      }
      otp_verifications: {
        Row: {
          code: string | null
          code_hash: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          code?: string | null
          code_hash?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          code?: string | null
          code_hash?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      payment_fulfillments: {
        Row: {
          allocation_summary: Json
          case_id: string | null
          created_at: string
          currency: string
          escrow_transaction_id: string | null
          expected_amount: number | null
          fulfilled_at: string | null
          fulfilled_via:
            | Database["public"]["Enums"]["payment_reconciliation_actor_type"]
            | null
          fulfillment_status: Database["public"]["Enums"]["payment_fulfillment_status"]
          gross_amount: number
          id: string
          metadata: Json
          net_amount: number
          notes: string | null
          office_id: string | null
          officer_id: string | null
          paid_amount: number
          payment_intent_id: string | null
          payment_provider: string
          paystack_fee: number
          paystack_reference: string
          paystack_transaction_id: string | null
          platform_reference: string
          receipt_id: string | null
          service_record_id: string | null
          service_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          allocation_summary?: Json
          case_id?: string | null
          created_at?: string
          currency?: string
          escrow_transaction_id?: string | null
          expected_amount?: number | null
          fulfilled_at?: string | null
          fulfilled_via?:
            | Database["public"]["Enums"]["payment_reconciliation_actor_type"]
            | null
          fulfillment_status?: Database["public"]["Enums"]["payment_fulfillment_status"]
          gross_amount?: number
          id?: string
          metadata?: Json
          net_amount?: number
          notes?: string | null
          office_id?: string | null
          officer_id?: string | null
          paid_amount?: number
          payment_intent_id?: string | null
          payment_provider?: string
          paystack_fee?: number
          paystack_reference: string
          paystack_transaction_id?: string | null
          platform_reference: string
          receipt_id?: string | null
          service_record_id?: string | null
          service_type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          allocation_summary?: Json
          case_id?: string | null
          created_at?: string
          currency?: string
          escrow_transaction_id?: string | null
          expected_amount?: number | null
          fulfilled_at?: string | null
          fulfilled_via?:
            | Database["public"]["Enums"]["payment_reconciliation_actor_type"]
            | null
          fulfillment_status?: Database["public"]["Enums"]["payment_fulfillment_status"]
          gross_amount?: number
          id?: string
          metadata?: Json
          net_amount?: number
          notes?: string | null
          office_id?: string | null
          officer_id?: string | null
          paid_amount?: number
          payment_intent_id?: string | null
          payment_provider?: string
          paystack_fee?: number
          paystack_reference?: string
          paystack_transaction_id?: string | null
          platform_reference?: string
          receipt_id?: string | null
          service_record_id?: string | null
          service_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_fulfillments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_fulfillments_escrow_transaction_id_fkey"
            columns: ["escrow_transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_fulfillments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "payment_fulfillments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_fulfillments_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_fulfillments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "payment_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          abandoned_at: string | null
          case_id: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          escrow_transaction_id: string | null
          expected_amount: number
          failure_reason: string | null
          fulfilled_at: string | null
          id: string
          last_verified_at: string | null
          metadata: Json
          office_id: string | null
          officer_id: string | null
          payment_channel: string | null
          payment_provider: string
          paystack_reference: string | null
          platform_reference: string
          provider_payload: Json
          service_record_id: string | null
          service_type: string
          status: Database["public"]["Enums"]["payment_intent_status"]
          updated_at: string
          user_id: string | null
          user_type: string | null
          webhook_response: Json | null
        }
        Insert: {
          abandoned_at?: string | null
          case_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          escrow_transaction_id?: string | null
          expected_amount?: number
          failure_reason?: string | null
          fulfilled_at?: string | null
          id?: string
          last_verified_at?: string | null
          metadata?: Json
          office_id?: string | null
          officer_id?: string | null
          payment_channel?: string | null
          payment_provider?: string
          paystack_reference?: string | null
          platform_reference: string
          provider_payload?: Json
          service_record_id?: string | null
          service_type: string
          status?: Database["public"]["Enums"]["payment_intent_status"]
          updated_at?: string
          user_id?: string | null
          user_type?: string | null
          webhook_response?: Json | null
        }
        Update: {
          abandoned_at?: string | null
          case_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          escrow_transaction_id?: string | null
          expected_amount?: number
          failure_reason?: string | null
          fulfilled_at?: string | null
          id?: string
          last_verified_at?: string | null
          metadata?: Json
          office_id?: string | null
          officer_id?: string | null
          payment_channel?: string | null
          payment_provider?: string
          paystack_reference?: string | null
          platform_reference?: string
          provider_payload?: Json
          service_record_id?: string | null
          service_type?: string
          status?: Database["public"]["Enums"]["payment_intent_status"]
          updated_at?: string
          user_id?: string | null
          user_type?: string | null
          webhook_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_escrow_transaction_id_fkey"
            columns: ["escrow_transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "payment_intents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_processing_errors: {
        Row: {
          created_at: string
          error_context: Json | null
          error_message: string
          error_stage: string
          escrow_transaction_id: string | null
          function_name: string
          id: string
          reference: string | null
          resolved: boolean
          severity: string
        }
        Insert: {
          created_at?: string
          error_context?: Json | null
          error_message: string
          error_stage: string
          escrow_transaction_id?: string | null
          function_name: string
          id?: string
          reference?: string | null
          resolved?: boolean
          severity?: string
        }
        Update: {
          created_at?: string
          error_context?: Json | null
          error_message?: string
          error_stage?: string
          escrow_transaction_id?: string | null
          function_name?: string
          id?: string
          reference?: string | null
          resolved?: boolean
          severity?: string
        }
        Relationships: []
      }
      payment_proof_submissions: {
        Row: {
          ai_confidence: number | null
          ai_extracted_fields: Json | null
          ai_reasoning: string | null
          ai_verdict: Database["public"]["Enums"]["payment_proof_ai_verdict"]
          claimed_amount: number | null
          claimed_paid_at: string | null
          claimed_reference: string | null
          created_at: string
          id: string
          notes: string | null
          paystack_lookup_response: Json | null
          paystack_lookup_status: string | null
          proof_file_path: string
          related_case_id: string | null
          related_property_id: string | null
          resulting_fulfillment_id: string | null
          review_decision: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_admin_id: string | null
          service_type: string
          submission_status: Database["public"]["Enums"]["payment_proof_submission_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_extracted_fields?: Json | null
          ai_reasoning?: string | null
          ai_verdict?: Database["public"]["Enums"]["payment_proof_ai_verdict"]
          claimed_amount?: number | null
          claimed_paid_at?: string | null
          claimed_reference?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paystack_lookup_response?: Json | null
          paystack_lookup_status?: string | null
          proof_file_path: string
          related_case_id?: string | null
          related_property_id?: string | null
          resulting_fulfillment_id?: string | null
          review_decision?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          service_type: string
          submission_status?: Database["public"]["Enums"]["payment_proof_submission_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_confidence?: number | null
          ai_extracted_fields?: Json | null
          ai_reasoning?: string | null
          ai_verdict?: Database["public"]["Enums"]["payment_proof_ai_verdict"]
          claimed_amount?: number | null
          claimed_paid_at?: string | null
          claimed_reference?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paystack_lookup_response?: Json | null
          paystack_lookup_status?: string | null
          proof_file_path?: string
          related_case_id?: string | null
          related_property_id?: string | null
          resulting_fulfillment_id?: string | null
          review_decision?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          service_type?: string
          submission_status?: Database["public"]["Enums"]["payment_proof_submission_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          admin_confirmed_at: string | null
          admin_confirmed_by: string | null
          case_id: string | null
          created_at: string
          description: string | null
          escrow_transaction_id: string | null
          generated_by_admin_id: string | null
          generated_by_type:
            | Database["public"]["Enums"]["payment_reconciliation_actor_type"]
            | null
          id: string
          office_id: string | null
          officer_id: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          payment_date: string | null
          payment_method: string | null
          payment_type: string
          paystack_reference: string | null
          platform_reference: string | null
          qr_code_data: string | null
          receipt_number: string
          receipt_status: Database["public"]["Enums"]["payment_receipt_status"]
          reconciliation_date: string | null
          reconciliation_notes: string | null
          service_record_id: string | null
          service_type: string | null
          split_breakdown: Json | null
          status: string
          tenancy_id: string | null
          total_amount: number
          user_id: string
        }
        Insert: {
          admin_confirmed_at?: string | null
          admin_confirmed_by?: string | null
          case_id?: string | null
          created_at?: string
          description?: string | null
          escrow_transaction_id?: string | null
          generated_by_admin_id?: string | null
          generated_by_type?:
            | Database["public"]["Enums"]["payment_reconciliation_actor_type"]
            | null
          id?: string
          office_id?: string | null
          officer_id?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_type: string
          paystack_reference?: string | null
          platform_reference?: string | null
          qr_code_data?: string | null
          receipt_number?: string
          receipt_status?: Database["public"]["Enums"]["payment_receipt_status"]
          reconciliation_date?: string | null
          reconciliation_notes?: string | null
          service_record_id?: string | null
          service_type?: string | null
          split_breakdown?: Json | null
          status?: string
          tenancy_id?: string | null
          total_amount: number
          user_id: string
        }
        Update: {
          admin_confirmed_at?: string | null
          admin_confirmed_by?: string | null
          case_id?: string | null
          created_at?: string
          description?: string | null
          escrow_transaction_id?: string | null
          generated_by_admin_id?: string | null
          generated_by_type?:
            | Database["public"]["Enums"]["payment_reconciliation_actor_type"]
            | null
          id?: string
          office_id?: string | null
          officer_id?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string
          paystack_reference?: string | null
          platform_reference?: string | null
          qr_code_data?: string | null
          receipt_number?: string
          receipt_status?: Database["public"]["Enums"]["payment_receipt_status"]
          reconciliation_date?: string | null
          reconciliation_notes?: string | null
          service_record_id?: string | null
          service_type?: string | null
          split_breakdown?: Json | null
          status?: string
          tenancy_id?: string | null
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_escrow_transaction_id_fkey"
            columns: ["escrow_transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reconciliation_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["payment_reconciliation_actor_type"]
          allocation_summary: Json
          amount: number | null
          case_id: string | null
          created_at: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          metadata: Json
          new_status: string | null
          notes: string | null
          office_id: string | null
          officer_id: string | null
          old_status: string | null
          payment_fulfillment_id: string | null
          payment_intent_id: string | null
          paystack_reference: string | null
          platform_reference: string | null
          service_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["payment_reconciliation_actor_type"]
          allocation_summary?: Json
          amount?: number | null
          case_id?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          new_status?: string | null
          notes?: string | null
          office_id?: string | null
          officer_id?: string | null
          old_status?: string | null
          payment_fulfillment_id?: string | null
          payment_intent_id?: string | null
          paystack_reference?: string | null
          platform_reference?: string | null
          service_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["payment_reconciliation_actor_type"]
          allocation_summary?: Json
          amount?: number | null
          case_id?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          new_status?: string | null
          notes?: string | null
          office_id?: string | null
          officer_id?: string | null
          old_status?: string | null
          payment_fulfillment_id?: string | null
          payment_intent_id?: string | null
          paystack_reference?: string | null
          platform_reference?: string | null
          service_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliation_audit_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_audit_log_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "payment_reconciliation_audit_log_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_audit_log_payment_fulfillment_id_fkey"
            columns: ["payment_fulfillment_id"]
            isOneToOne: false
            referencedRelation: "payment_fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_audit_log_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_transfers: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          escrow_split_id: string | null
          escrow_transaction_id: string
          failure_reason: string | null
          id: string
          paystack_reference: string | null
          recipient_code: string | null
          recipient_type: string
          status: string
          transfer_code: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          escrow_split_id?: string | null
          escrow_transaction_id: string
          failure_reason?: string | null
          id?: string
          paystack_reference?: string | null
          recipient_code?: string | null
          recipient_type: string
          status?: string
          transfer_code?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          escrow_split_id?: string | null
          escrow_transaction_id?: string
          failure_reason?: string | null
          id?: string
          paystack_reference?: string | null
          recipient_code?: string | null
          recipient_type?: string
          status?: string
          transfer_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_transfers_escrow_split_id_fkey"
            columns: ["escrow_split_id"]
            isOneToOne: false
            referencedRelation: "escrow_splits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transfers_escrow_transaction_id_fkey"
            columns: ["escrow_transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_complaint_drafts: {
        Row: {
          amount: number
          audio_path: string | null
          created_at: string
          evidence_paths: string[] | null
          expires_at: string
          id: string
          materialized_complaint_id: string | null
          payload: Json
          reference: string | null
          status: string
          tenant_user_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          audio_path?: string | null
          created_at?: string
          evidence_paths?: string[] | null
          expires_at?: string
          id?: string
          materialized_complaint_id?: string | null
          payload: Json
          reference?: string | null
          status?: string
          tenant_user_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          audio_path?: string | null
          created_at?: string
          evidence_paths?: string[] | null
          expires_at?: string
          id?: string
          materialized_complaint_id?: string | null
          payload?: Json
          reference?: string | null
          status?: string
          tenant_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_safety_report_drafts: {
        Row: {
          amount: number
          created_at: string
          evidence_paths: string[] | null
          expires_at: string
          id: string
          materialized_report_id: string | null
          payload: Json
          reference: string | null
          status: string
          updated_at: string
          user_id: string
          user_role: string
        }
        Insert: {
          amount?: number
          created_at?: string
          evidence_paths?: string[] | null
          expires_at?: string
          id?: string
          materialized_report_id?: string | null
          payload: Json
          reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_role: string
        }
        Update: {
          amount?: number
          created_at?: string
          evidence_paths?: string[] | null
          expires_at?: string
          id?: string
          materialized_report_id?: string | null
          payload?: Json
          reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      pending_tenants: {
        Row: {
          assigned_staff_id: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_by: string
          full_name: string
          id: string
          linked_at: string | null
          linked_user_id: string | null
          managed_by_platform: boolean
          phone: string
          sms_sent: boolean
          tenancy_id: string | null
        }
        Insert: {
          assigned_staff_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by: string
          full_name: string
          id?: string
          linked_at?: string | null
          linked_user_id?: string | null
          managed_by_platform?: boolean
          phone: string
          sms_sent?: boolean
          tenancy_id?: string | null
        }
        Update: {
          assigned_staff_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string
          full_name?: string
          id?: string
          linked_at?: string | null
          linked_user_id?: string | null
          managed_by_platform?: boolean
          phone?: string
          sms_sent?: boolean
          tenancy_id?: string | null
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          config_key: string
          config_value: Json
          description: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value?: Json
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          delivery_address: string | null
          delivery_area: string | null
          delivery_landmark: string | null
          delivery_region: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          ghana_card_no: string | null
          id: string
          is_citizen: boolean
          nationality: string
          occupation: string | null
          phone: string
          residence_permit_no: string | null
          student_id_url: string | null
          umb_account_created_on: string | null
          umb_account_name: string | null
          umb_account_number: string | null
          umb_account_type: string | null
          umb_branch: string | null
          umb_confirmation_screenshot_path: string | null
          umb_submitted_at: string | null
          updated_at: string
          user_id: string
          user_type: string
          work_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_area?: string | null
          delivery_landmark?: string | null
          delivery_region?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          ghana_card_no?: string | null
          id?: string
          is_citizen?: boolean
          nationality?: string
          occupation?: string | null
          phone: string
          residence_permit_no?: string | null
          student_id_url?: string | null
          umb_account_created_on?: string | null
          umb_account_name?: string | null
          umb_account_number?: string | null
          umb_account_type?: string | null
          umb_branch?: string | null
          umb_confirmation_screenshot_path?: string | null
          umb_submitted_at?: string | null
          updated_at?: string
          user_id: string
          user_type?: string
          work_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_area?: string | null
          delivery_landmark?: string | null
          delivery_region?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          ghana_card_no?: string | null
          id?: string
          is_citizen?: boolean
          nationality?: string
          occupation?: string | null
          phone?: string
          residence_permit_no?: string | null
          student_id_url?: string | null
          umb_account_created_on?: string | null
          umb_account_name?: string | null
          umb_account_number?: string | null
          umb_account_type?: string | null
          umb_branch?: string | null
          umb_confirmation_screenshot_path?: string | null
          umb_submitted_at?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
          work_address?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          approved_rent: number | null
          archived_at: string | null
          archived_reason: string | null
          area: string
          assessed_at: string | null
          assessed_by: string | null
          assessment_status: string
          bathroom_count: number | null
          created_at: string
          duplicate_of_property_id: string | null
          duplicate_old_rent: number | null
          furnishing_status: string | null
          ghana_post_gps: string | null
          ghana_post_gps_lat: number | null
          ghana_post_gps_lng: number | null
          gps_confirmed: boolean
          gps_confirmed_at: string | null
          gps_location: string | null
          id: string
          landlord_user_id: string
          last_assessment_id: string | null
          listed_on_marketplace: boolean
          location_distance_m: number | null
          location_locked: boolean
          location_locked_at: string | null
          location_locked_by: string | null
          location_review_required: boolean
          management_assigned_office_id: string | null
          management_assigned_staff_id: string | null
          management_enabled: boolean
          management_enabled_at: string | null
          management_notes: string | null
          normalized_address: string | null
          occupancy_type: string | null
          office_id: string | null
          ownership_type: string | null
          property_category: string
          property_code: string
          property_condition: string | null
          property_fingerprint: string | null
          property_name: string | null
          property_status: string
          property_structure: string | null
          region: string
          rent_locked_amount: number | null
          rent_locked_at: string | null
          room_count: number | null
          suggested_price: number | null
          updated_at: string
        }
        Insert: {
          address: string
          approved_rent?: number | null
          archived_at?: string | null
          archived_reason?: string | null
          area: string
          assessed_at?: string | null
          assessed_by?: string | null
          assessment_status?: string
          bathroom_count?: number | null
          created_at?: string
          duplicate_of_property_id?: string | null
          duplicate_old_rent?: number | null
          furnishing_status?: string | null
          ghana_post_gps?: string | null
          ghana_post_gps_lat?: number | null
          ghana_post_gps_lng?: number | null
          gps_confirmed?: boolean
          gps_confirmed_at?: string | null
          gps_location?: string | null
          id?: string
          landlord_user_id: string
          last_assessment_id?: string | null
          listed_on_marketplace?: boolean
          location_distance_m?: number | null
          location_locked?: boolean
          location_locked_at?: string | null
          location_locked_by?: string | null
          location_review_required?: boolean
          management_assigned_office_id?: string | null
          management_assigned_staff_id?: string | null
          management_enabled?: boolean
          management_enabled_at?: string | null
          management_notes?: string | null
          normalized_address?: string | null
          occupancy_type?: string | null
          office_id?: string | null
          ownership_type?: string | null
          property_category?: string
          property_code: string
          property_condition?: string | null
          property_fingerprint?: string | null
          property_name?: string | null
          property_status?: string
          property_structure?: string | null
          region: string
          rent_locked_amount?: number | null
          rent_locked_at?: string | null
          room_count?: number | null
          suggested_price?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          approved_rent?: number | null
          archived_at?: string | null
          archived_reason?: string | null
          area?: string
          assessed_at?: string | null
          assessed_by?: string | null
          assessment_status?: string
          bathroom_count?: number | null
          created_at?: string
          duplicate_of_property_id?: string | null
          duplicate_old_rent?: number | null
          furnishing_status?: string | null
          ghana_post_gps?: string | null
          ghana_post_gps_lat?: number | null
          ghana_post_gps_lng?: number | null
          gps_confirmed?: boolean
          gps_confirmed_at?: string | null
          gps_location?: string | null
          id?: string
          landlord_user_id?: string
          last_assessment_id?: string | null
          listed_on_marketplace?: boolean
          location_distance_m?: number | null
          location_locked?: boolean
          location_locked_at?: string | null
          location_locked_by?: string | null
          location_review_required?: boolean
          management_assigned_office_id?: string | null
          management_assigned_staff_id?: string | null
          management_enabled?: boolean
          management_enabled_at?: string | null
          management_notes?: string | null
          normalized_address?: string | null
          occupancy_type?: string | null
          office_id?: string | null
          ownership_type?: string | null
          property_category?: string
          property_code?: string
          property_condition?: string | null
          property_fingerprint?: string | null
          property_name?: string | null
          property_status?: string
          property_structure?: string | null
          region?: string
          rent_locked_amount?: number | null
          rent_locked_at?: string | null
          room_count?: number | null
          suggested_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      property_assessments: {
        Row: {
          amenities: Json | null
          approved_at: string | null
          approved_by: string | null
          approved_rent: number | null
          created_at: string
          gps_location: string | null
          id: string
          inspector_user_id: string | null
          photos: string[] | null
          property_condition: string | null
          property_id: string
          recommended_rent: number | null
          status: string
        }
        Insert: {
          amenities?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          approved_rent?: number | null
          created_at?: string
          gps_location?: string | null
          id?: string
          inspector_user_id?: string | null
          photos?: string[] | null
          property_condition?: string | null
          property_id: string
          recommended_rent?: number | null
          status?: string
        }
        Update: {
          amenities?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          approved_rent?: number | null
          created_at?: string
          gps_location?: string | null
          id?: string
          inspector_user_id?: string | null
          photos?: string[] | null
          property_condition?: string | null
          property_id?: string
          recommended_rent?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_assessments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_by: string | null
          property_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          property_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          property_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_primary: boolean | null
          property_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_primary?: boolean | null
          property_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_primary?: boolean | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_location_edits: {
        Row: {
          created_at: string
          edited_by: string
          id: string
          new_gps_location: string | null
          old_gps_location: string | null
          property_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          edited_by: string
          id?: string
          new_gps_location?: string | null
          old_gps_location?: string | null
          property_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          edited_by?: string
          id?: string
          new_gps_location?: string | null
          old_gps_location?: string | null
          property_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_location_edits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_management_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          property_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          property_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_management_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_similarity_scores: {
        Row: {
          dismissed_at: string | null
          dismissed_by: string | null
          gps_points: number
          id: string
          landlord_name_points: number
          last_calculated_at: string
          location_points: number
          manually_dismissed: boolean
          matched_property_id: string
          property_name_points: number
          property_type_points: number
          score: number
          similarity_level: string
          source_id: string
          source_type: string
          tenant_boost_applied: boolean
        }
        Insert: {
          dismissed_at?: string | null
          dismissed_by?: string | null
          gps_points?: number
          id?: string
          landlord_name_points?: number
          last_calculated_at?: string
          location_points?: number
          manually_dismissed?: boolean
          matched_property_id: string
          property_name_points?: number
          property_type_points?: number
          score: number
          similarity_level: string
          source_id: string
          source_type: string
          tenant_boost_applied?: boolean
        }
        Update: {
          dismissed_at?: string | null
          dismissed_by?: string | null
          gps_points?: number
          id?: string
          landlord_name_points?: number
          last_calculated_at?: string
          location_points?: number
          manually_dismissed?: boolean
          matched_property_id?: string
          property_name_points?: number
          property_type_points?: number
          score?: number
          similarity_level?: string
          source_id?: string
          source_type?: string
          tenant_boost_applied?: boolean
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          id: string
          rated_user_id: string
          rater_user_id: string
          rating: number
          review: string | null
          tenancy_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rated_user_id: string
          rater_user_id: string
          rating: number
          review?: string | null
          tenancy_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rated_user_id?: string
          rater_user_id?: string
          rating?: number
          review?: string | null
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_generation_failures: {
        Row: {
          attempted_payload: Json | null
          case_payment_id: string | null
          created_at: string
          escrow_transaction_id: string | null
          failure_reason: string | null
          failure_stage: string
          id: string
          payment_reference: string | null
          resolution_notes: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          attempted_payload?: Json | null
          case_payment_id?: string | null
          created_at?: string
          escrow_transaction_id?: string | null
          failure_reason?: string | null
          failure_stage: string
          id?: string
          payment_reference?: string | null
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          attempted_payload?: Json | null
          case_payment_id?: string | null
          created_at?: string
          escrow_transaction_id?: string | null
          failure_reason?: string | null
          failure_stage?: string
          id?: string
          payment_reference?: string | null
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      reconciliation_period_snapshots: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          metrics: Json
          office_id: string
          office_name: string
          period_from: string
          period_to: string
          preset: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          metrics: Json
          office_id: string
          office_name: string
          period_from: string
          period_to: string
          preset?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          metrics?: Json
          office_id?: string
          office_name?: string
          period_from?: string
          period_to?: string
          preset?: string | null
        }
        Relationships: []
      }
      region_codes: {
        Row: {
          code: string
          id: string
          region: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          id?: string
          region: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          id?: string
          region?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      rent_assessments: {
        Row: {
          created_at: string
          current_rent: number
          id: string
          landlord_user_id: string
          proposed_rent: number
          reason: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          reviewer_user_id: string | null
          status: string
          tenancy_id: string
        }
        Insert: {
          created_at?: string
          current_rent: number
          id?: string
          landlord_user_id: string
          proposed_rent: number
          reason?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          tenancy_id: string
        }
        Update: {
          created_at?: string
          current_rent?: number
          id?: string
          landlord_user_id?: string
          proposed_rent?: number
          reason?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_assessments_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_band_allocations: {
        Row: {
          amount: number
          description: string | null
          id: string
          payment_type: string
          recipient: string
          rent_band_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          description?: string | null
          id?: string
          payment_type?: string
          recipient: string
          rent_band_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          description?: string | null
          id?: string
          payment_type?: string
          recipient?: string
          rent_band_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_band_allocations_rent_band_id_fkey"
            columns: ["rent_band_id"]
            isOneToOne: false
            referencedRelation: "rent_bands"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_bands: {
        Row: {
          agreement_fee: number | null
          band_type: string
          fee_amount: number
          filing_fee: number | null
          id: string
          label: string | null
          max_rent: number | null
          min_rent: number
          register_fee: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agreement_fee?: number | null
          band_type?: string
          fee_amount?: number
          filing_fee?: number | null
          id?: string
          label?: string | null
          max_rent?: number | null
          min_rent?: number
          register_fee?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agreement_fee?: number | null
          band_type?: string
          fee_amount?: number
          filing_fee?: number | null
          id?: string
          label?: string | null
          max_rent?: number | null
          min_rent?: number
          register_fee?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      rent_benchmarks: {
        Row: {
          benchmark_expected: number
          benchmark_max: number
          benchmark_min: number
          comparable_count: number
          computed_at: string
          confidence: string
          hard_cap: number
          id: string
          property_class: string
          property_id: string
          soft_cap: number
          unit_id: string | null
          zone_key: string
        }
        Insert: {
          benchmark_expected?: number
          benchmark_max?: number
          benchmark_min?: number
          comparable_count?: number
          computed_at?: string
          confidence?: string
          hard_cap?: number
          id?: string
          property_class: string
          property_id: string
          soft_cap?: number
          unit_id?: string | null
          zone_key: string
        }
        Update: {
          benchmark_expected?: number
          benchmark_max?: number
          benchmark_min?: number
          comparable_count?: number
          computed_at?: string
          confidence?: string
          hard_cap?: number
          id?: string
          property_class?: string
          property_id?: string
          soft_cap?: number
          unit_id?: string | null
          zone_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_benchmarks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_benchmarks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_card_channel_splits: {
        Row: {
          amount: number
          amount_type: string
          channel_id: string
          id: string
          recipient: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          amount_type?: string
          channel_id: string
          id?: string
          recipient: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          amount_type?: string
          channel_id?: string
          id?: string
          recipient?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_card_channel_splits_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "rent_card_sales_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_card_sales_channels: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          default_office_id: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          default_office_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          default_office_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_card_sales_channels_default_office_id_fkey"
            columns: ["default_office_id"]
            isOneToOne: false
            referencedRelation: "mv_office_dashboard_stats"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "rent_card_sales_channels_default_office_id_fkey"
            columns: ["default_office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_card_serial_stock: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_card_id: string | null
          batch_label: string | null
          created_at: string
          id: string
          office_allocation_id: string | null
          office_name: string
          pair_group: string | null
          pair_index: number | null
          region: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          sales_channel_id: string | null
          serial_number: string
          status: string
          stock_source: string
          stock_type: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_card_id?: string | null
          batch_label?: string | null
          created_at?: string
          id?: string
          office_allocation_id?: string | null
          office_name: string
          pair_group?: string | null
          pair_index?: number | null
          region?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          sales_channel_id?: string | null
          serial_number: string
          status?: string
          stock_source?: string
          stock_type?: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_card_id?: string | null
          batch_label?: string | null
          created_at?: string
          id?: string
          office_allocation_id?: string | null
          office_name?: string
          pair_group?: string | null
          pair_index?: number | null
          region?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          sales_channel_id?: string | null
          serial_number?: string
          status?: string
          stock_source?: string
          stock_type?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_card_serial_stock_assigned_to_card_id_fkey"
            columns: ["assigned_to_card_id"]
            isOneToOne: false
            referencedRelation: "rent_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_card_serial_stock_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "rent_card_sales_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_cards: {
        Row: {
          activated_at: string | null
          advance_paid: number | null
          assigned_office_id: string | null
          assigned_office_name: string | null
          card_role: string | null
          created_at: string
          current_rent: number | null
          escrow_transaction_id: string | null
          expiry_date: string | null
          id: string
          landlord_user_id: string
          last_payment_status: string | null
          max_advance: number | null
          previous_rent: number | null
          property_id: string | null
          purchase_id: string | null
          purchased_at: string
          qr_token: string | null
          sales_channel_id: string | null
          serial_number: string | null
          start_date: string | null
          status: string
          tenancy_id: string | null
          tenant_user_id: string | null
          unit_id: string | null
        }
        Insert: {
          activated_at?: string | null
          advance_paid?: number | null
          assigned_office_id?: string | null
          assigned_office_name?: string | null
          card_role?: string | null
          created_at?: string
          current_rent?: number | null
          escrow_transaction_id?: string | null
          expiry_date?: string | null
          id?: string
          landlord_user_id: string
          last_payment_status?: string | null
          max_advance?: number | null
          previous_rent?: number | null
          property_id?: string | null
          purchase_id?: string | null
          purchased_at?: string
          qr_token?: string | null
          sales_channel_id?: string | null
          serial_number?: string | null
          start_date?: string | null
          status?: string
          tenancy_id?: string | null
          tenant_user_id?: string | null
          unit_id?: string | null
        }
        Update: {
          activated_at?: string | null
          advance_paid?: number | null
          assigned_office_id?: string | null
          assigned_office_name?: string | null
          card_role?: string | null
          created_at?: string
          current_rent?: number | null
          escrow_transaction_id?: string | null
          expiry_date?: string | null
          id?: string
          landlord_user_id?: string
          last_payment_status?: string | null
          max_advance?: number | null
          previous_rent?: number | null
          property_id?: string | null
          purchase_id?: string | null
          purchased_at?: string
          qr_token?: string | null
          sales_channel_id?: string | null
          serial_number?: string | null
          start_date?: string | null
          status?: string
          tenancy_id?: string | null
          tenant_user_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_cards_escrow_transaction_id_fkey"
            columns: ["escrow_transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_cards_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "rent_card_sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_cards_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_increase_requests: {
        Row: {
          created_at: string
          current_approved_rent: number
          evidence_urls: string[] | null
          id: string
          landlord_user_id: string
          property_id: string
          proposed_rent: number
          reason: string | null
          request_type: string
          reviewed_at: string | null
          reviewer_notes: string | null
          reviewer_user_id: string | null
          status: string
          unit_id: string | null
        }
        Insert: {
          created_at?: string
          current_approved_rent?: number
          evidence_urls?: string[] | null
          id?: string
          landlord_user_id: string
          property_id: string
          proposed_rent: number
          reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          unit_id?: string | null
        }
        Update: {
          created_at?: string
          current_approved_rent?: number
          evidence_urls?: string[] | null
          id?: string
          landlord_user_id?: string
          property_id?: string
          proposed_rent?: number
          reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_increase_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_increase_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_market_data: {
        Row: {
          accepted_rent: number | null
          advance_months: number | null
          approved_rent: number | null
          asking_rent: number | null
          created_at: string
          event_date: string
          event_type: string
          id: string
          property_class: string
          property_id: string | null
          unit_id: string | null
          zone_key: string
        }
        Insert: {
          accepted_rent?: number | null
          advance_months?: number | null
          approved_rent?: number | null
          asking_rent?: number | null
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          property_class: string
          property_id?: string | null
          unit_id?: string | null
          zone_key: string
        }
        Update: {
          accepted_rent?: number | null
          advance_months?: number | null
          approved_rent?: number | null
          asking_rent?: number | null
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          property_class?: string
          property_id?: string | null
          unit_id?: string | null
          zone_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_market_data_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_market_data_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payments: {
        Row: {
          amount_paid: number | null
          amount_to_landlord: number
          created_at: string
          due_date: string
          id: string
          landlord_confirmed: boolean | null
          month_label: string
          monthly_rent: number
          paid_date: string | null
          payment_method: string | null
          receiver: string | null
          status: string
          tax_amount: number
          tenancy_id: string
          tenant_marked_paid: boolean | null
        }
        Insert: {
          amount_paid?: number | null
          amount_to_landlord: number
          created_at?: string
          due_date: string
          id?: string
          landlord_confirmed?: boolean | null
          month_label: string
          monthly_rent: number
          paid_date?: string | null
          payment_method?: string | null
          receiver?: string | null
          status?: string
          tax_amount: number
          tenancy_id: string
          tenant_marked_paid?: boolean | null
        }
        Update: {
          amount_paid?: number | null
          amount_to_landlord?: number
          created_at?: string
          due_date?: string
          id?: string
          landlord_confirmed?: boolean | null
          month_label?: string
          monthly_rent?: number
          paid_date?: string | null
          payment_method?: string | null
          receiver?: string | null
          status?: string
          tax_amount?: number
          tenancy_id?: string
          tenant_marked_paid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_applications: {
        Row: {
          created_at: string
          id: string
          landlord_user_id: string
          property_id: string
          status: string
          tenant_user_id: string
          unit_id: string
          updated_at: string
          viewing_request_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          landlord_user_id: string
          property_id: string
          status?: string
          tenant_user_id: string
          unit_id: string
          updated_at?: string
          viewing_request_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          landlord_user_id?: string
          property_id?: string
          status?: string
          tenant_user_id?: string
          unit_id?: string
          updated_at?: string
          viewing_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_viewing_request_id_fkey"
            columns: ["viewing_request_id"]
            isOneToOne: false
            referencedRelation: "viewing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rentcare_applications: {
        Row: {
          accommodation_location: string | null
          accommodation_type: string | null
          address: string | null
          admin_notes: string | null
          amount_paid: number | null
          amount_requested: number | null
          applicant_user_id: string
          campus: string | null
          consent_accepted_at: string | null
          consent_ip: string | null
          created_at: string
          deadline: string | null
          decision_reason: string | null
          disbursed_at: string | null
          email: string | null
          fee_amount_snapshot: number | null
          full_name: string | null
          gender: string | null
          ghana_card_no: string | null
          guarantor_json: Json | null
          id: string
          institution: string | null
          level: string | null
          outstanding_amount: number | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["rentcare_payment_status"]
          phone: string | null
          previous_support_history: string | null
          programme: string | null
          provider_contact: string | null
          provider_name: string | null
          reason: string | null
          receipt_id: string | null
          reference: string
          region: string | null
          status: Database["public"]["Enums"]["rentcare_status"]
          student_id_code: string | null
          submitted_at: string | null
          total_fee: number | null
          umb_account_created_on: string | null
          umb_account_name: string | null
          umb_account_number: string | null
          umb_account_type: string | null
          umb_branch: string | null
          umb_confirmation_screenshot_path: string | null
          umb_submitted_at: string | null
          updated_at: string
          urgency: string | null
          version: number
        }
        Insert: {
          accommodation_location?: string | null
          accommodation_type?: string | null
          address?: string | null
          admin_notes?: string | null
          amount_paid?: number | null
          amount_requested?: number | null
          applicant_user_id: string
          campus?: string | null
          consent_accepted_at?: string | null
          consent_ip?: string | null
          created_at?: string
          deadline?: string | null
          decision_reason?: string | null
          disbursed_at?: string | null
          email?: string | null
          fee_amount_snapshot?: number | null
          full_name?: string | null
          gender?: string | null
          ghana_card_no?: string | null
          guarantor_json?: Json | null
          id?: string
          institution?: string | null
          level?: string | null
          outstanding_amount?: number | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["rentcare_payment_status"]
          phone?: string | null
          previous_support_history?: string | null
          programme?: string | null
          provider_contact?: string | null
          provider_name?: string | null
          reason?: string | null
          receipt_id?: string | null
          reference?: string
          region?: string | null
          status?: Database["public"]["Enums"]["rentcare_status"]
          student_id_code?: string | null
          submitted_at?: string | null
          total_fee?: number | null
          umb_account_created_on?: string | null
          umb_account_name?: string | null
          umb_account_number?: string | null
          umb_account_type?: string | null
          umb_branch?: string | null
          umb_confirmation_screenshot_path?: string | null
          umb_submitted_at?: string | null
          updated_at?: string
          urgency?: string | null
          version?: number
        }
        Update: {
          accommodation_location?: string | null
          accommodation_type?: string | null
          address?: string | null
          admin_notes?: string | null
          amount_paid?: number | null
          amount_requested?: number | null
          applicant_user_id?: string
          campus?: string | null
          consent_accepted_at?: string | null
          consent_ip?: string | null
          created_at?: string
          deadline?: string | null
          decision_reason?: string | null
          disbursed_at?: string | null
          email?: string | null
          fee_amount_snapshot?: number | null
          full_name?: string | null
          gender?: string | null
          ghana_card_no?: string | null
          guarantor_json?: Json | null
          id?: string
          institution?: string | null
          level?: string | null
          outstanding_amount?: number | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["rentcare_payment_status"]
          phone?: string | null
          previous_support_history?: string | null
          programme?: string | null
          provider_contact?: string | null
          provider_name?: string | null
          reason?: string | null
          receipt_id?: string | null
          reference?: string
          region?: string | null
          status?: Database["public"]["Enums"]["rentcare_status"]
          student_id_code?: string | null
          submitted_at?: string | null
          total_fee?: number | null
          umb_account_created_on?: string | null
          umb_account_name?: string | null
          umb_account_number?: string | null
          umb_account_type?: string | null
          umb_branch?: string | null
          umb_confirmation_screenshot_path?: string | null
          umb_submitted_at?: string | null
          updated_at?: string
          urgency?: string | null
          version?: number
        }
        Relationships: []
      }
      rentcare_audit_log: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          application_id: string | null
          device: string | null
          event_type: string
          id: string
          ip: string | null
          new_value: Json | null
          occurred_at: string
          old_value: Json | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          application_id?: string | null
          device?: string | null
          event_type: string
          id?: string
          ip?: string | null
          new_value?: Json | null
          occurred_at?: string
          old_value?: Json | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          application_id?: string | null
          device?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          new_value?: Json | null
          occurred_at?: string
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rentcare_audit_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rentcare_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentcare_audit_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rentcare_applications_nugs"
            referencedColumns: ["id"]
          },
        ]
      }
      rentcare_documents: {
        Row: {
          application_id: string
          created_at: string
          doc_type: string
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          uploader_user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          doc_type: string
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploader_user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          doc_type?: string
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploader_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentcare_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rentcare_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentcare_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rentcare_applications_nugs"
            referencedColumns: ["id"]
          },
        ]
      }
      rentcare_messages: {
        Row: {
          application_id: string
          attachments: Json | null
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_role: string
          sender_user_id: string
          subject: string | null
        }
        Insert: {
          application_id: string
          attachments?: Json | null
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_role: string
          sender_user_id: string
          subject?: string | null
        }
        Update: {
          application_id?: string
          attachments?: Json | null
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_role?: string
          sender_user_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rentcare_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rentcare_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentcare_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rentcare_applications_nugs"
            referencedColumns: ["id"]
          },
        ]
      }
      rentcare_status_history: {
        Row: {
          application_id: string
          changed_by: string | null
          changed_by_role: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["rentcare_status"]
          note: string | null
          previous_status: Database["public"]["Enums"]["rentcare_status"] | null
        }
        Insert: {
          application_id: string
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["rentcare_status"]
          note?: string | null
          previous_status?:
            | Database["public"]["Enums"]["rentcare_status"]
            | null
        }
        Update: {
          application_id?: string
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["rentcare_status"]
          note?: string | null
          previous_status?:
            | Database["public"]["Enums"]["rentcare_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "rentcare_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rentcare_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentcare_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rentcare_applications_nugs"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json | null
          id: string
          report_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          report_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_audit_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "safety_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_contacts: {
        Row: {
          active: boolean
          contact_type: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          scope: string
          scope_value: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_type: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          scope?: string
          scope_value?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_type?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          scope?: string
          scope_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      safety_location_pings: {
        Row: {
          accuracy: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          report_id: string
          user_id: string | null
        }
        Insert: {
          accuracy?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          report_id: string
          user_id?: string | null
        }
        Update: {
          accuracy?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          report_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_location_pings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "safety_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_notes: {
        Row: {
          author_user_id: string
          created_at: string
          id: string
          note: string
          report_id: string
        }
        Insert: {
          author_user_id: string
          created_at?: string
          id?: string
          note: string
          report_id: string
        }
        Update: {
          author_user_id?: string
          created_at?: string
          id?: string
          note?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_notes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "safety_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_reports: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          action_taken: string | null
          assigned_office_id: string | null
          assigned_to_user_id: string | null
          category: string | null
          closed_at: string | null
          closed_by: string | null
          closure_reason: string | null
          created_at: string
          description: string | null
          emergency_type: string | null
          escalated_at: string | null
          escalated_to: string[] | null
          escalation_notes: string | null
          evidence_urls: string[] | null
          false_alert_count_at_time: number | null
          hostel_or_hall: string | null
          id: string
          is_silent: boolean
          latitude: number | null
          linked_complaint_id: string | null
          linked_property_id: string | null
          linked_student_id: string | null
          linked_tenancy_id: string | null
          live_tracking_enabled: boolean | null
          location_accuracy: number | null
          location_address: string | null
          longitude: number | null
          property_id: string | null
          report_kind: string
          response_time_seconds: number | null
          school: string | null
          severity: string
          status: string
          ticket_number: string
          tracking_stopped_at: string | null
          unit_id: string | null
          updated_at: string
          user_id: string
          user_marked_safe_at: string | null
          user_name_snapshot: string | null
          user_note: string | null
          user_phone_snapshot: string | null
          user_role: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_taken?: string | null
          assigned_office_id?: string | null
          assigned_to_user_id?: string | null
          category?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_reason?: string | null
          created_at?: string
          description?: string | null
          emergency_type?: string | null
          escalated_at?: string | null
          escalated_to?: string[] | null
          escalation_notes?: string | null
          evidence_urls?: string[] | null
          false_alert_count_at_time?: number | null
          hostel_or_hall?: string | null
          id?: string
          is_silent?: boolean
          latitude?: number | null
          linked_complaint_id?: string | null
          linked_property_id?: string | null
          linked_student_id?: string | null
          linked_tenancy_id?: string | null
          live_tracking_enabled?: boolean | null
          location_accuracy?: number | null
          location_address?: string | null
          longitude?: number | null
          property_id?: string | null
          report_kind: string
          response_time_seconds?: number | null
          school?: string | null
          severity?: string
          status?: string
          ticket_number?: string
          tracking_stopped_at?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id: string
          user_marked_safe_at?: string | null
          user_name_snapshot?: string | null
          user_note?: string | null
          user_phone_snapshot?: string | null
          user_role: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_taken?: string | null
          assigned_office_id?: string | null
          assigned_to_user_id?: string | null
          category?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_reason?: string | null
          created_at?: string
          description?: string | null
          emergency_type?: string | null
          escalated_at?: string | null
          escalated_to?: string[] | null
          escalation_notes?: string | null
          evidence_urls?: string[] | null
          false_alert_count_at_time?: number | null
          hostel_or_hall?: string | null
          id?: string
          is_silent?: boolean
          latitude?: number | null
          linked_complaint_id?: string | null
          linked_property_id?: string | null
          linked_student_id?: string | null
          linked_tenancy_id?: string | null
          live_tracking_enabled?: boolean | null
          location_accuracy?: number | null
          location_address?: string | null
          longitude?: number | null
          property_id?: string | null
          report_kind?: string
          response_time_seconds?: number | null
          school?: string | null
          severity?: string
          status?: string
          ticket_number?: string
          tracking_stopped_at?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string
          user_marked_safe_at?: string | null
          user_name_snapshot?: string | null
          user_note?: string | null
          user_phone_snapshot?: string | null
          user_role?: string
        }
        Relationships: []
      }
      secondary_split_configurations: {
        Row: {
          description: string | null
          id: string
          parent_recipient: string
          percentage: number
          sub_recipient: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          parent_recipient: string
          percentage?: number
          sub_recipient: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          parent_recipient?: string
          percentage?: number
          sub_recipient?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      serial_assignments: {
        Row: {
          assigned_by: string
          card_count: number
          created_at: string | null
          id: string
          landlord_user_id: string
          office_id: string | null
          office_name: string
          purchase_id: string
          serial_numbers: string[]
          source: string
        }
        Insert: {
          assigned_by: string
          card_count?: number
          created_at?: string | null
          id?: string
          landlord_user_id: string
          office_id?: string | null
          office_name: string
          purchase_id: string
          serial_numbers?: string[]
          source?: string
        }
        Update: {
          assigned_by?: string
          card_count?: number
          created_at?: string | null
          id?: string
          landlord_user_id?: string
          office_id?: string | null
          office_name?: string
          purchase_id?: string
          serial_numbers?: string[]
          source?: string
        }
        Relationships: []
      }
      service_fee_configurations: {
        Row: {
          enabled: boolean
          payment_type: string
          percentage: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          payment_type: string
          percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          payment_type?: string
          percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      service_fee_splits: {
        Row: {
          id: string
          payer_segment: string
          payment_type: string
          percentage: number
          recipient: string
          sort_order: number
        }
        Insert: {
          id?: string
          payer_segment: string
          payment_type: string
          percentage: number
          recipient: string
          sort_order?: number
        }
        Update: {
          id?: string
          payer_segment?: string
          payment_type?: string
          percentage?: number
          recipient?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_fee_splits_payment_type_fkey"
            columns: ["payment_type"]
            isOneToOne: false
            referencedRelation: "service_fee_configurations"
            referencedColumns: ["payment_type"]
          },
        ]
      }
      side_payment_declarations: {
        Row: {
          amount: number
          created_at: string
          declared_by: string
          description: string | null
          evidence_urls: string[] | null
          id: string
          payment_type: string
          status: string
          tenancy_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          declared_by: string
          description?: string | null
          evidence_urls?: string[] | null
          id?: string
          payment_type: string
          status?: string
          tenancy_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          declared_by?: string
          description?: string | null
          evidence_urls?: string[] | null
          id?: string
          payment_type?: string
          status?: string
          tenancy_id?: string
        }
        Relationships: []
      }
      similarity_check_errors: {
        Row: {
          created_at: string
          error_message: string
          id: string
          source_id: string | null
        }
        Insert: {
          created_at?: string
          error_message: string
          id?: string
          source_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string
          id?: string
          source_id?: string | null
        }
        Relationships: []
      }
      split_configurations: {
        Row: {
          amount: number
          amount_type: string
          description: string | null
          id: string
          is_platform_fee: boolean
          payment_type: string
          recipient: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          amount_type?: string
          description?: string | null
          id?: string
          is_platform_fee?: boolean
          payment_type: string
          recipient: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          amount_type?: string
          description?: string | null
          id?: string
          is_platform_fee?: boolean
          payment_type?: string
          recipient?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      staff_feature_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          feature_key: string
          id: string
          is_enabled: boolean
          staff_user_id: string
          sub_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          feature_key: string
          id?: string
          is_enabled?: boolean
          staff_user_id: string
          sub_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          feature_key?: string
          id?: string
          is_enabled?: boolean
          staff_user_id?: string
          sub_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      student_residence_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          ghana_post_gps: string | null
          hostel_contact_number: string | null
          hostel_landlord_name: string | null
          hostel_location_address: string | null
          hostel_location_lat: number | null
          hostel_location_lng: number | null
          hostel_or_hall: string | null
          hostel_region: string | null
          id: string
          room_or_bed_space: string | null
          school: string | null
          tenant_user_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          ghana_post_gps?: string | null
          hostel_contact_number?: string | null
          hostel_landlord_name?: string | null
          hostel_location_address?: string | null
          hostel_location_lat?: number | null
          hostel_location_lng?: number | null
          hostel_or_hall?: string | null
          hostel_region?: string | null
          id?: string
          room_or_bed_space?: string | null
          school?: string | null
          tenant_user_id: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          ghana_post_gps?: string | null
          hostel_contact_number?: string | null
          hostel_landlord_name?: string | null
          hostel_location_address?: string | null
          hostel_location_lat?: number | null
          hostel_location_lng?: number | null
          hostel_or_hall?: string | null
          hostel_region?: string | null
          id?: string
          room_or_bed_space?: string | null
          school?: string | null
          tenant_user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_staff: boolean
          message: string
          sender_user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_staff?: boolean
          message: string
          sender_user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          message?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_backup_log: {
        Row: {
          created_at: string
          current_table: string | null
          drive_folder_id: string | null
          drive_folder_name: string | null
          drive_folder_url: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          progress_percent: number
          row_counts: Json
          started_at: string
          status: string
          tables_included: Json
          total_rows: number
          triggered_by: string | null
          triggered_by_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_table?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          drive_folder_url?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          progress_percent?: number
          row_counts?: Json
          started_at?: string
          status?: string
          tables_included?: Json
          total_rows?: number
          triggered_by?: string | null
          triggered_by_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_table?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          drive_folder_url?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          progress_percent?: number
          row_counts?: Json
          started_at?: string
          status?: string
          tables_included?: Json
          total_rows?: number
          triggered_by?: string | null
          triggered_by_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_health_snapshots: {
        Row: {
          alert: boolean
          captured_at: string
          dashboard_refreshed_at: string | null
          dashboard_stale_seconds: number | null
          db_connections_max: number | null
          db_connections_pct: number | null
          db_connections_used: number | null
          details: Json
          id: string
          missing_receipt_numbers: number
          missing_receipts: number
          open_failures_24h: number
          unreconciled: number
        }
        Insert: {
          alert?: boolean
          captured_at?: string
          dashboard_refreshed_at?: string | null
          dashboard_stale_seconds?: number | null
          db_connections_max?: number | null
          db_connections_pct?: number | null
          db_connections_used?: number | null
          details?: Json
          id?: string
          missing_receipt_numbers?: number
          missing_receipts?: number
          open_failures_24h?: number
          unreconciled?: number
        }
        Update: {
          alert?: boolean
          captured_at?: string
          dashboard_refreshed_at?: string | null
          dashboard_stale_seconds?: number | null
          db_connections_max?: number | null
          db_connections_pct?: number | null
          db_connections_used?: number | null
          details?: Json
          id?: string
          missing_receipt_numbers?: number
          missing_receipts?: number
          open_failures_24h?: number
          unreconciled?: number
        }
        Relationships: []
      }
      system_settlement_accounts: {
        Row: {
          account_name: string | null
          account_number: string | null
          account_type: string
          bank_name: string | null
          id: string
          momo_number: string | null
          momo_provider: string | null
          payment_method: string
          paystack_recipient_code: string | null
          paystack_subaccount_code: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          account_type: string
          bank_name?: string | null
          id?: string
          momo_number?: string | null
          momo_provider?: string | null
          payment_method?: string
          paystack_recipient_code?: string | null
          paystack_subaccount_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          id?: string
          momo_number?: string | null
          momo_provider?: string | null
          payment_method?: string
          paystack_recipient_code?: string | null
          paystack_subaccount_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tenancies: {
        Row: {
          advance_months: number
          agreed_rent: number
          agreement_pdf_url: string | null
          agreement_version: number
          compliance_status: string
          created_at: string
          custom_field_values: Json | null
          end_date: string
          execution_timestamp: string | null
          existing_advance_paid: number | null
          existing_agreement_url: string | null
          existing_start_date: string | null
          existing_voice_url: string | null
          final_agreement_pdf_url: string | null
          id: string
          landlord_accepted: boolean | null
          landlord_signed_at: string | null
          landlord_user_id: string
          move_in_date: string
          office_id: string | null
          pending_tenant_id: string | null
          placeholder_tenant_name: string | null
          placeholder_tenant_phone: string | null
          previous_tenancy_id: string | null
          proposed_rent: number | null
          registration_code: string
          renewal_duration_months: number | null
          renewal_requested_at: string | null
          renewal_requested_by: string | null
          rent_card_id: string | null
          rent_card_id_2: string | null
          start_date: string
          status: string
          tax_compliance_status: string
          tenancy_type: string
          tenant_accepted: boolean | null
          tenant_archived_at: string | null
          tenant_id_code: string
          tenant_signed_at: string | null
          tenant_user_id: string | null
          terminated_at: string | null
          termination_reason: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          advance_months?: number
          agreed_rent: number
          agreement_pdf_url?: string | null
          agreement_version?: number
          compliance_status?: string
          created_at?: string
          custom_field_values?: Json | null
          end_date: string
          execution_timestamp?: string | null
          existing_advance_paid?: number | null
          existing_agreement_url?: string | null
          existing_start_date?: string | null
          existing_voice_url?: string | null
          final_agreement_pdf_url?: string | null
          id?: string
          landlord_accepted?: boolean | null
          landlord_signed_at?: string | null
          landlord_user_id: string
          move_in_date: string
          office_id?: string | null
          pending_tenant_id?: string | null
          placeholder_tenant_name?: string | null
          placeholder_tenant_phone?: string | null
          previous_tenancy_id?: string | null
          proposed_rent?: number | null
          registration_code: string
          renewal_duration_months?: number | null
          renewal_requested_at?: string | null
          renewal_requested_by?: string | null
          rent_card_id?: string | null
          rent_card_id_2?: string | null
          start_date: string
          status?: string
          tax_compliance_status?: string
          tenancy_type?: string
          tenant_accepted?: boolean | null
          tenant_archived_at?: string | null
          tenant_id_code: string
          tenant_signed_at?: string | null
          tenant_user_id?: string | null
          terminated_at?: string | null
          termination_reason?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          advance_months?: number
          agreed_rent?: number
          agreement_pdf_url?: string | null
          agreement_version?: number
          compliance_status?: string
          created_at?: string
          custom_field_values?: Json | null
          end_date?: string
          execution_timestamp?: string | null
          existing_advance_paid?: number | null
          existing_agreement_url?: string | null
          existing_start_date?: string | null
          existing_voice_url?: string | null
          final_agreement_pdf_url?: string | null
          id?: string
          landlord_accepted?: boolean | null
          landlord_signed_at?: string | null
          landlord_user_id?: string
          move_in_date?: string
          office_id?: string | null
          pending_tenant_id?: string | null
          placeholder_tenant_name?: string | null
          placeholder_tenant_phone?: string | null
          previous_tenancy_id?: string | null
          proposed_rent?: number | null
          registration_code?: string
          renewal_duration_months?: number | null
          renewal_requested_at?: string | null
          renewal_requested_by?: string | null
          rent_card_id?: string | null
          rent_card_id_2?: string | null
          start_date?: string
          status?: string
          tax_compliance_status?: string
          tenancy_type?: string
          tenant_accepted?: boolean | null
          tenant_archived_at?: string | null
          tenant_id_code?: string
          tenant_signed_at?: string | null
          tenant_user_id?: string | null
          terminated_at?: string | null
          termination_reason?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_rent_card_id_2_fkey"
            columns: ["rent_card_id_2"]
            isOneToOne: false
            referencedRelation: "rent_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_rent_card_id_fkey"
            columns: ["rent_card_id"]
            isOneToOne: false
            referencedRelation: "rent_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_signatures: {
        Row: {
          device_info: Json | null
          id: string
          ip_address: string | null
          signature_hash: string | null
          signature_method: string
          signed_at: string
          signer_role: string
          signer_user_id: string
          tenancy_id: string
        }
        Insert: {
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          signature_hash?: string | null
          signature_method?: string
          signed_at?: string
          signer_role: string
          signer_user_id: string
          tenancy_id: string
        }
        Update: {
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          signature_hash?: string | null
          signature_method?: string
          signed_at?: string
          signer_role?: string
          signer_user_id?: string
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_signatures_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_preferences: {
        Row: {
          created_at: string
          current_location: string | null
          id: string
          max_budget: number | null
          min_budget: number | null
          preferred_location: string | null
          preferred_move_in_date: string | null
          property_type: string | null
          tenant_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_location?: string | null
          id?: string
          max_budget?: number | null
          min_budget?: number | null
          preferred_location?: string | null
          preferred_move_in_date?: string | null
          property_type?: string | null
          tenant_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_location?: string | null
          id?: string
          max_budget?: number | null
          min_budget?: number | null
          preferred_location?: string | null
          preferred_move_in_date?: string | null
          property_type?: string | null
          tenant_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          account_status: string
          created_at: string
          expiry_date: string | null
          ghana_post_gps: string | null
          hostel_contact_number: string | null
          hostel_landlord_name: string | null
          hostel_location_address: string | null
          hostel_location_lat: number | null
          hostel_location_lng: number | null
          hostel_or_hall: string | null
          hostel_region: string | null
          id: string
          is_student: boolean
          registration_date: string | null
          registration_fee_paid: boolean
          room_or_bed_space: string | null
          school: string | null
          status: string
          student_id_verified_at: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          expiry_date?: string | null
          ghana_post_gps?: string | null
          hostel_contact_number?: string | null
          hostel_landlord_name?: string | null
          hostel_location_address?: string | null
          hostel_location_lat?: number | null
          hostel_location_lng?: number | null
          hostel_or_hall?: string | null
          hostel_region?: string | null
          id?: string
          is_student?: boolean
          registration_date?: string | null
          registration_fee_paid?: boolean
          room_or_bed_space?: string | null
          school?: string | null
          status?: string
          student_id_verified_at?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          account_status?: string
          created_at?: string
          expiry_date?: string | null
          ghana_post_gps?: string | null
          hostel_contact_number?: string | null
          hostel_landlord_name?: string | null
          hostel_location_address?: string | null
          hostel_location_lat?: number | null
          hostel_location_lng?: number | null
          hostel_or_hall?: string | null
          hostel_region?: string | null
          id?: string
          is_student?: boolean
          registration_date?: string | null
          registration_fee_paid?: boolean
          room_or_bed_space?: string | null
          school?: string | null
          status?: string
          student_id_verified_at?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      termination_applications: {
        Row: {
          applicant_role: string
          applicant_user_id: string
          audio_url: string | null
          created_at: string
          description: string | null
          evidence_urls: string[] | null
          id: string
          reason: string
          reviewed_at: string | null
          reviewer_notes: string | null
          reviewer_user_id: string | null
          status: string
          tenancy_id: string
        }
        Insert: {
          applicant_role: string
          applicant_user_id: string
          audio_url?: string | null
          created_at?: string
          description?: string | null
          evidence_urls?: string[] | null
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          tenancy_id: string
        }
        Update: {
          applicant_role?: string
          applicant_user_id?: string
          audio_url?: string | null
          created_at?: string
          description?: string | null
          evidence_urls?: string[] | null
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          tenancy_id?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          amenities: string[] | null
          bed_label: string | null
          created_at: string
          custom_amenities: string | null
          electricity_available: boolean | null
          has_borehole: boolean | null
          has_kitchen: boolean | null
          has_polytank: boolean | null
          has_toilet_bathroom: boolean | null
          hostel_room_id: string | null
          id: string
          monthly_rent: number
          property_id: string
          rent_locked_amount: number | null
          rent_locked_at: string | null
          status: string
          unit_kind: string
          unit_name: string
          unit_type: string
          water_available: boolean | null
        }
        Insert: {
          amenities?: string[] | null
          bed_label?: string | null
          created_at?: string
          custom_amenities?: string | null
          electricity_available?: boolean | null
          has_borehole?: boolean | null
          has_kitchen?: boolean | null
          has_polytank?: boolean | null
          has_toilet_bathroom?: boolean | null
          hostel_room_id?: string | null
          id?: string
          monthly_rent: number
          property_id: string
          rent_locked_amount?: number | null
          rent_locked_at?: string | null
          status?: string
          unit_kind?: string
          unit_name: string
          unit_type: string
          water_available?: boolean | null
        }
        Update: {
          amenities?: string[] | null
          bed_label?: string | null
          created_at?: string
          custom_amenities?: string | null
          electricity_available?: boolean | null
          has_borehole?: boolean | null
          has_kitchen?: boolean | null
          has_polytank?: boolean | null
          has_toilet_bathroom?: boolean | null
          hostel_room_id?: string | null
          id?: string
          monthly_rent?: number
          property_id?: string
          rent_locked_amount?: number | null
          rent_locked_at?: string | null
          status?: string
          unit_kind?: string
          unit_name?: string
          unit_type?: string
          water_available?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "units_hostel_room_id_fkey"
            columns: ["hostel_room_id"]
            isOneToOne: false
            referencedRelation: "hostel_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viewing_requests: {
        Row: {
          assigned_staff_id: string | null
          created_at: string
          id: string
          landlord_user_id: string
          managed_by_platform: boolean
          message: string | null
          preferred_date: string | null
          preferred_time: string | null
          property_id: string
          status: string
          tenant_user_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          created_at?: string
          id?: string
          landlord_user_id: string
          managed_by_platform?: boolean
          message?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          property_id: string
          status?: string
          tenant_user_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          created_at?: string
          id?: string
          landlord_user_id?: string
          managed_by_platform?: boolean
          message?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          property_id?: string
          status?: string
          tenant_user_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_entries: {
        Row: {
          amount: number
          bucket: string
          created_at: string
          description: string | null
          direction: string
          entry_type: string
          id: string
          metadata: Json
          reference: string | null
          related_id: string | null
          related_table: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          bucket?: string
          created_at?: string
          description?: string | null
          direction: string
          entry_type: string
          id?: string
          metadata?: Json
          reference?: string | null
          related_id?: string | null
          related_table?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          bucket?: string
          created_at?: string
          description?: string | null
          direction?: string
          entry_type?: string
          id?: string
          metadata?: Json
          reference?: string | null
          related_id?: string | null
          related_table?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_holds: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          hold_type: string
          id: string
          reason: string | null
          reference: string | null
          status: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          hold_type: string
          id?: string
          reason?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          hold_type?: string
          id?: string
          reason?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_holds_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_payment_links: {
        Row: {
          active: boolean
          amount: number | null
          created_at: string
          currency: string
          description: string | null
          expires_at: string | null
          fixed_amount: boolean
          id: string
          payment_count: number
          slug: string
          title: string
          total_collected: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          amount?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          fixed_amount?: boolean
          id?: string
          payment_count?: number
          slug: string
          title: string
          total_collected?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          amount?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          fixed_amount?: boolean
          id?: string
          payment_count?: number
          slug?: string
          title?: string
          total_collected?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_payout_accounts: {
        Row: {
          account_name: string
          account_number: string
          account_type: string
          active: boolean
          created_at: string
          id: string
          is_default: boolean
          is_verified: boolean
          paystack_recipient_code: string | null
          provider_code: string
          provider_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          account_type: string
          active?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          paystack_recipient_code?: string | null
          provider_code: string
          provider_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          account_type?: string
          active?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          paystack_recipient_code?: string | null
          provider_code?: string
          provider_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_settings: {
        Row: {
          auto_withdraw_enabled: boolean
          auto_withdraw_threshold: number | null
          created_at: string
          default_payout_account_id: string | null
          id: string
          monthly_fee_opted_in: boolean
          notifications_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_withdraw_enabled?: boolean
          auto_withdraw_threshold?: number | null
          created_at?: string
          default_payout_account_id?: string | null
          id?: string
          monthly_fee_opted_in?: boolean
          notifications_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_withdraw_enabled?: boolean
          auto_withdraw_threshold?: number | null
          created_at?: string
          default_payout_account_id?: string | null
          id?: string
          monthly_fee_opted_in?: boolean
          notifications_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_settings_default_payout_account_id_fkey"
            columns: ["default_payout_account_id"]
            isOneToOne: false
            referencedRelation: "wallet_payout_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          escrow_balance: number
          id: string
          pending_balance: number
          reserved_balance: number
          status: string
          total_received: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          escrow_balance?: number
          id?: string
          pending_balance?: number
          reserved_balance?: number
          status?: string
          total_received?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          escrow_balance?: number
          id?: string
          pending_balance?: number
          reserved_balance?: number
          status?: string
          total_received?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          tenant_user_id: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_user_id: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_user_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      api_keys_developer_view: {
        Row: {
          agency_name: string | null
          allowed_ip_cidrs: string[] | null
          billing_override: string | null
          created_at: string | null
          current_plan_id: string | null
          dsa_signed_at: string | null
          dsa_version_accepted: string | null
          environment: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          key_prefix: string | null
          last_used_at: string | null
          last_used_ip: unknown
          organization_id: string | null
          pinned_version: string | null
          previous_key_expires_at: string | null
          rate_limit_per_minute: number | null
          revoke_reason: string | null
          revoked_at: string | null
          scopes: string[] | null
        }
        Insert: {
          agency_name?: string | null
          allowed_ip_cidrs?: string[] | null
          billing_override?: string | null
          created_at?: string | null
          current_plan_id?: string | null
          dsa_signed_at?: string | null
          dsa_version_accepted?: string | null
          environment?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          key_prefix?: string | null
          last_used_at?: string | null
          last_used_ip?: unknown
          organization_id?: string | null
          pinned_version?: string | null
          previous_key_expires_at?: string | null
          rate_limit_per_minute?: number | null
          revoke_reason?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
        }
        Update: {
          agency_name?: string | null
          allowed_ip_cidrs?: string[] | null
          billing_override?: string | null
          created_at?: string | null
          current_plan_id?: string | null
          dsa_signed_at?: string | null
          dsa_version_accepted?: string | null
          environment?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          key_prefix?: string | null
          last_used_at?: string | null
          last_used_ip?: unknown
          organization_id?: string | null
          pinned_version?: string | null
          previous_key_expires_at?: string | null
          rate_limit_per_minute?: number | null
          revoke_reason?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "developer_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_global_dashboard_stats: {
        Row: {
          active_tenancies: number | null
          pending_complaints: number | null
          pending_terminations: number | null
          refreshed_at: string | null
          reported_side_payments: number | null
          singleton: number | null
          total_complaints: number | null
          total_landlords: number | null
          total_properties: number | null
          total_tenants: number | null
        }
        Relationships: []
      }
      mv_office_dashboard_stats: {
        Row: {
          active_tenancies: number | null
          office_id: string | null
          pending_complaints: number | null
          refreshed_at: string | null
          total_complaints: number | null
          total_properties: number | null
        }
        Relationships: []
      }
      profiles_counterparty: {
        Row: {
          avatar_url: string | null
          email: string | null
          full_name: string | null
          nationality: string | null
          occupation: string | null
          phone: string | null
          user_id: string | null
          user_type: string | null
        }
        Insert: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          nationality?: string | null
          occupation?: string | null
          phone?: string | null
          user_id?: string | null
          user_type?: string | null
        }
        Update: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          nationality?: string | null
          occupation?: string | null
          phone?: string | null
          user_id?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
      rentcare_applications_nugs: {
        Row: {
          accommodation_location: string | null
          accommodation_type: string | null
          amount_paid: number | null
          amount_requested: number | null
          applicant_user_id: string | null
          campus: string | null
          created_at: string | null
          deadline: string | null
          full_name: string | null
          id: string | null
          institution: string | null
          level: string | null
          outstanding_amount: number | null
          payment_status:
            | Database["public"]["Enums"]["rentcare_payment_status"]
            | null
          programme: string | null
          provider_name: string | null
          reference: string | null
          region: string | null
          status: Database["public"]["Enums"]["rentcare_status"] | null
          student_id_code: string | null
          submitted_at: string | null
          total_fee: number | null
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          accommodation_location?: string | null
          accommodation_type?: string | null
          amount_paid?: number | null
          amount_requested?: number | null
          applicant_user_id?: string | null
          campus?: string | null
          created_at?: string | null
          deadline?: string | null
          full_name?: string | null
          id?: string | null
          institution?: string | null
          level?: string | null
          outstanding_amount?: number | null
          payment_status?:
            | Database["public"]["Enums"]["rentcare_payment_status"]
            | null
          programme?: string | null
          provider_name?: string | null
          reference?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["rentcare_status"] | null
          student_id_code?: string | null
          submitted_at?: string | null
          total_fee?: number | null
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          accommodation_location?: string | null
          accommodation_type?: string | null
          amount_paid?: number | null
          amount_requested?: number | null
          applicant_user_id?: string | null
          campus?: string | null
          created_at?: string | null
          deadline?: string | null
          full_name?: string | null
          id?: string | null
          institution?: string | null
          level?: string | null
          outstanding_amount?: number | null
          payment_status?:
            | Database["public"]["Enums"]["rentcare_payment_status"]
            | null
          programme?: string | null
          provider_name?: string | null
          reference?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["rentcare_status"] | null
          student_id_code?: string | null
          submitted_at?: string | null
          total_fee?: number | null
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      agent_can_act_on: {
        Args: { _agent: string; _owner: string }
        Returns: boolean
      }
      api_enqueue_webhook_event: {
        Args: { p_event_type: string; p_payload: Json }
        Returns: number
      }
      api_increment_usage: {
        Args: {
          p_api_key_id: string
          p_included_calls: number
          p_overage_price_per_1k: number
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      approve_rent_increase_request: {
        Args: {
          p_request_id: string
          p_reviewer: string
          p_reviewer_notes?: string
        }
        Returns: Json
      }
      assign_property_to_staff: {
        Args: {
          p_office_id?: string
          p_property_id: string
          p_staff_user_id: string
        }
        Returns: Json
      }
      assign_serials_atomic: {
        Args: {
          p_assigned_by: string
          p_office_id: string
          p_office_name: string
          p_pairs: Json
        }
        Returns: Json
      }
      capture_system_health_snapshot: { Args: never; Returns: string }
      classify_nugs_rent_card_revenue: {
        Args: { p_card_ids: string[]; p_office_id: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_receipt_drift: { Args: never; Returns: Json }
      developer_provision_sandbox_key: {
        Args: never
        Returns: {
          api_key: string
          key_id: string
          key_prefix: string
        }[]
      }
      developer_revoke_api_key: {
        Args: { p_key_id: string; p_reason?: string }
        Returns: undefined
      }
      developer_rotate_api_key: {
        Args: { p_key_id: string }
        Returns: {
          api_key: string
          key_prefix: string
        }[]
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_overdue_tenancies: { Args: never; Returns: number }
      expire_tenancy_cascade: {
        Args: { p_tenancy_id: string }
        Returns: undefined
      }
      generate_case_number: { Args: never; Returns: string }
      generate_complaint_ticket: { Args: never; Returns: string }
      generate_issue_ticket: { Args: never; Returns: string }
      generate_landlord_id: { Args: never; Returns: string }
      generate_purchase_id: { Args: never; Returns: string }
      generate_receipt_number: { Args: never; Returns: string }
      generate_rentcare_reference: { Args: never; Returns: string }
      generate_safety_ticket: { Args: never; Returns: string }
      generate_tenant_id: { Args: never; Returns: string }
      get_regulator_dashboard_stats: {
        Args: { p_office_id?: string }
        Returns: Json
      }
      has_admin_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      has_payment_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inventory_adjustment_atomic: {
        Args: {
          p_adjustment_type: string
          p_correction_tag?: string
          p_idempotency_key?: string
          p_note?: string
          p_office_id: string
          p_office_name: string
          p_performed_by: string
          p_quantity: number
          p_reason: string
          p_reference_id?: string
          p_region: string
        }
        Returns: Json
      }
      is_agent: { Args: { _user_id: string }; Returns: boolean }
      is_main_admin: { Args: { _user_id: string }; Returns: boolean }
      is_nugs_user: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      issue_car_case_number: { Args: never; Returns: string }
      lookup_serial_details: { Args: { p_serials: string[] }; Returns: Json }
      move_serials_atomic: {
        Args: {
          p_actor: string
          p_reason: string
          p_serials: string[]
          p_target_kind: string
          p_target_office_id: string
          p_target_office_name: string
          p_target_region: string
        }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      nugs_has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      rcss_office_summary: {
        Args: never
        Returns: {
          available_pairs: number
          office_name: string
          region: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalculate_compliance_score: {
        Args: { p_landlord_user_id: string }
        Returns: undefined
      }
      reconcile_case_payment: {
        Args: {
          p_actor?: string
          p_notes?: string
          p_payment_reference: string
        }
        Returns: Json
      }
      refresh_dashboard_stats: { Args: never; Returns: undefined }
      regulator_set_developer_org_status: {
        Args: { p_org_id: string; p_reason?: string; p_status: string }
        Returns: Json
      }
      rentcare_admin_update: {
        Args: {
          p_application_id: string
          p_expected_version: number
          p_patch: Json
        }
        Returns: Json
      }
      repair_rent_cards_for_escrow: {
        Args: { p_escrow_id: string }
        Returns: Json
      }
      resolve_feature_access: {
        Args: {
          _admin_category?: string
          _dashboard?: string
          _feature_key: string
          _institution?: string
          _role?: string
          _sub_key?: string
          _user_id: string
        }
        Returns: boolean
      }
      resolve_office_id: {
        Args: { p_area?: string; p_region: string }
        Returns: string
      }
      set_property_management: {
        Args: { p_enabled: boolean; p_notes?: string; p_property_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      try_finalize_lock: { Args: { p_reference: string }; Returns: boolean }
      unassign_serial_atomic: {
        Args: { p_serial_number: string }
        Returns: Json
      }
      update_complaint_with_version: {
        Args: {
          p_expected_version: number
          p_id: string
          p_patch: Json
          p_table: string
        }
        Returns: Json
      }
      user_in_developer_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      wallet_post_entry: {
        Args: {
          _amount: number
          _bucket?: string
          _description?: string
          _direction: string
          _entry_type: string
          _metadata?: Json
          _reference?: string
          _related_id?: string
          _related_table?: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "tenant"
        | "landlord"
        | "regulator"
        | "nugs_admin"
        | "developer"
        | "agent"
      issue_service:
        | "rent_card"
        | "complaint"
        | "agreement"
        | "receipt"
        | "tenancy"
        | "dashboard"
        | "payment"
        | "other"
      issue_status:
        | "open"
        | "under_review"
        | "awaiting_user"
        | "resolved"
        | "rejected"
      issue_type:
        | "payment_not_updated"
        | "receipt_missing"
        | "rent_card_missing"
        | "complaint_payment_missing"
        | "agreement_missing"
        | "wrong_dashboard_status"
        | "other"
      payment_fulfillment_status:
        | "pending"
        | "fulfilled"
        | "failed"
        | "reconciliation_required"
        | "manually_reconciled"
        | "duplicate_blocked"
      payment_intent_status:
        | "pending"
        | "paystack_success"
        | "fulfilled"
        | "failed"
        | "abandoned"
        | "reconciliation_required"
        | "manually_reconciled"
      payment_proof_ai_verdict:
        | "pending"
        | "ai_verified_high_confidence"
        | "needs_admin_review"
        | "ai_rejected_paystack_says_unpaid"
        | "ai_rejected_appears_fake"
      payment_proof_submission_status:
        | "pending_ai_review"
        | "awaiting_admin"
        | "approved"
        | "rejected"
        | "info_requested"
      payment_receipt_status:
        | "auto_generated"
        | "manually_reconciled"
        | "duplicate_blocked"
        | "voided"
      payment_reconciliation_actor_type:
        | "system"
        | "webhook"
        | "callback"
        | "recovery_worker"
        | "admin"
      rentcare_payment_status:
        | "unpaid"
        | "pending"
        | "paid"
        | "failed"
        | "reconciled"
      rentcare_status:
        | "draft"
        | "awaiting_application_fee_payment"
        | "paid_and_submitted"
        | "awaiting_umb_account_number"
        | "umb_account_submitted"
        | "under_cfled_review"
        | "under_nugs_validation"
        | "sent_to_umb"
        | "more_information_required"
        | "approved"
        | "declined"
        | "disbursed"
        | "closed"
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
      app_role: [
        "tenant",
        "landlord",
        "regulator",
        "nugs_admin",
        "developer",
        "agent",
      ],
      issue_service: [
        "rent_card",
        "complaint",
        "agreement",
        "receipt",
        "tenancy",
        "dashboard",
        "payment",
        "other",
      ],
      issue_status: [
        "open",
        "under_review",
        "awaiting_user",
        "resolved",
        "rejected",
      ],
      issue_type: [
        "payment_not_updated",
        "receipt_missing",
        "rent_card_missing",
        "complaint_payment_missing",
        "agreement_missing",
        "wrong_dashboard_status",
        "other",
      ],
      payment_fulfillment_status: [
        "pending",
        "fulfilled",
        "failed",
        "reconciliation_required",
        "manually_reconciled",
        "duplicate_blocked",
      ],
      payment_intent_status: [
        "pending",
        "paystack_success",
        "fulfilled",
        "failed",
        "abandoned",
        "reconciliation_required",
        "manually_reconciled",
      ],
      payment_proof_ai_verdict: [
        "pending",
        "ai_verified_high_confidence",
        "needs_admin_review",
        "ai_rejected_paystack_says_unpaid",
        "ai_rejected_appears_fake",
      ],
      payment_proof_submission_status: [
        "pending_ai_review",
        "awaiting_admin",
        "approved",
        "rejected",
        "info_requested",
      ],
      payment_receipt_status: [
        "auto_generated",
        "manually_reconciled",
        "duplicate_blocked",
        "voided",
      ],
      payment_reconciliation_actor_type: [
        "system",
        "webhook",
        "callback",
        "recovery_worker",
        "admin",
      ],
      rentcare_payment_status: [
        "unpaid",
        "pending",
        "paid",
        "failed",
        "reconciled",
      ],
      rentcare_status: [
        "draft",
        "awaiting_application_fee_payment",
        "paid_and_submitted",
        "awaiting_umb_account_number",
        "umb_account_submitted",
        "under_cfled_review",
        "under_nugs_validation",
        "sent_to_umb",
        "more_information_required",
        "approved",
        "declined",
        "disbursed",
        "closed",
      ],
    },
  },
} as const
