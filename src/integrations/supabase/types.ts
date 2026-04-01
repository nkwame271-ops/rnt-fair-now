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
          created_at: string | null
          created_by: string | null
          id: string
          muted_features: string[] | null
          office_id: string | null
          office_name: string | null
          stock_alert_threshold: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_type?: string
          allowed_features?: string[] | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          muted_features?: string[] | null
          office_id?: string | null
          office_name?: string | null
          stock_alert_threshold?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_type?: string
          allowed_features?: string[] | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          muted_features?: string[] | null
          office_id?: string | null
          office_name?: string | null
          stock_alert_threshold?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agreement_template_config: {
        Row: {
          custom_fields: Json | null
          id: string
          max_advance_months: number
          max_lease_duration: number
          min_lease_duration: number
          registration_deadline_days: number
          tax_rate: number
          tax_rates: Json
          terms: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          custom_fields?: Json | null
          id?: string
          max_advance_months?: number
          max_lease_duration?: number
          min_lease_duration?: number
          registration_deadline_days?: number
          tax_rate?: number
          tax_rates?: Json
          terms?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          custom_fields?: Json | null
          id?: string
          max_advance_months?: number
          max_lease_duration?: number
          min_lease_duration?: number
          registration_deadline_days?: number
          tax_rate?: number
          tax_rates?: Json
          terms?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          agency_name: string
          api_key_hash: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          scopes: string[]
        }
        Insert: {
          agency_name: string
          api_key_hash: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          scopes?: string[]
        }
        Update: {
          agency_name?: string
          api_key_hash?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          scopes?: string[]
        }
        Relationships: []
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
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
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
      complaints: {
        Row: {
          audio_url: string | null
          complaint_code: string
          complaint_type: string
          created_at: string
          description: string
          evidence_urls: string[] | null
          gps_confirmed: boolean
          gps_confirmed_at: string | null
          gps_location: string | null
          id: string
          landlord_name: string
          office_id: string | null
          property_address: string
          region: string
          status: string
          tenant_user_id: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          complaint_code: string
          complaint_type: string
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          gps_confirmed?: boolean
          gps_confirmed_at?: string | null
          gps_location?: string | null
          id?: string
          landlord_name: string
          office_id?: string | null
          property_address: string
          region: string
          status?: string
          tenant_user_id: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          complaint_code?: string
          complaint_type?: string
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          gps_confirmed?: boolean
          gps_confirmed_at?: string | null
          gps_location?: string | null
          id?: string
          landlord_name?: string
          office_id?: string | null
          property_address?: string
          region?: string
          status?: string
          tenant_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
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
      escrow_splits: {
        Row: {
          amount: number
          description: string | null
          disbursement_status: string
          escrow_transaction_id: string
          id: string
          office_id: string | null
          recipient: string
          release_mode: string
          released_at: string | null
        }
        Insert: {
          amount: number
          description?: string | null
          disbursement_status?: string
          escrow_transaction_id: string
          id?: string
          office_id?: string | null
          recipient: string
          release_mode?: string
          released_at?: string | null
        }
        Update: {
          amount?: number
          description?: string | null
          disbursement_status?: string
          escrow_transaction_id?: string
          id?: string
          office_id?: string | null
          recipient?: string
          release_mode?: string
          released_at?: string | null
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
          metadata: Json | null
          office_id: string | null
          payment_type: string
          paystack_transaction_id: string | null
          reference: string | null
          related_complaint_id: string | null
          related_property_id: string | null
          related_tenancy_id: string | null
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
          metadata?: Json | null
          office_id?: string | null
          payment_type: string
          paystack_transaction_id?: string | null
          reference?: string | null
          related_complaint_id?: string | null
          related_property_id?: string | null
          related_tenancy_id?: string | null
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
          metadata?: Json | null
          office_id?: string | null
          payment_type?: string
          paystack_transaction_id?: string | null
          reference?: string | null
          related_complaint_id?: string | null
          related_property_id?: string | null
          related_tenancy_id?: string | null
          status?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
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
          audio_url: string | null
          complaint_code: string
          complaint_type: string
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          landlord_user_id: string
          office_id: string | null
          property_address: string
          region: string
          status: string
          tenant_name: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          complaint_code: string
          complaint_type: string
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          landlord_user_id: string
          office_id?: string | null
          property_address: string
          region: string
          status?: string
          tenant_name?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          complaint_code?: string
          complaint_type?: string
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          landlord_user_id?: string
          office_id?: string | null
          property_address?: string
          region?: string
          status?: string
          tenant_name?: string | null
          updated_at?: string
        }
        Relationships: []
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_payout_accounts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
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
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          created_at: string
          description: string | null
          escrow_transaction_id: string | null
          id: string
          office_id: string | null
          payer_email: string | null
          payer_name: string | null
          payment_type: string
          qr_code_data: string | null
          receipt_number: string
          split_breakdown: Json | null
          status: string
          tenancy_id: string | null
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          escrow_transaction_id?: string | null
          id?: string
          office_id?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_type: string
          qr_code_data?: string | null
          receipt_number?: string
          split_breakdown?: Json | null
          status?: string
          tenancy_id?: string | null
          total_amount: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          escrow_transaction_id?: string | null
          id?: string
          office_id?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_type?: string
          qr_code_data?: string | null
          receipt_number?: string
          split_breakdown?: Json | null
          status?: string
          tenancy_id?: string | null
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_escrow_transaction_id_fkey"
            columns: ["escrow_transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_tenants: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_by: string
          full_name: string
          id: string
          phone: string
          sms_sent: boolean
          tenancy_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by: string
          full_name: string
          id?: string
          phone: string
          sms_sent?: boolean
          tenancy_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string
          full_name?: string
          id?: string
          phone?: string
          sms_sent?: boolean
          tenancy_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
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
          updated_at: string
          user_id: string
          work_address: string | null
        }
        Insert: {
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
          updated_at?: string
          user_id: string
          work_address?: string | null
        }
        Update: {
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
          updated_at?: string
          user_id?: string
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
          gps_confirmed: boolean
          gps_confirmed_at: string | null
          gps_location: string | null
          id: string
          landlord_user_id: string
          last_assessment_id: string | null
          listed_on_marketplace: boolean
          location_locked: boolean
          location_locked_at: string | null
          location_locked_by: string | null
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
          gps_confirmed?: boolean
          gps_confirmed_at?: string | null
          gps_location?: string | null
          id?: string
          landlord_user_id: string
          last_assessment_id?: string | null
          listed_on_marketplace?: boolean
          location_locked?: boolean
          location_locked_at?: string | null
          location_locked_by?: string | null
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
          gps_confirmed?: boolean
          gps_confirmed_at?: string | null
          gps_location?: string | null
          id?: string
          landlord_user_id?: string
          last_assessment_id?: string | null
          listed_on_marketplace?: boolean
          location_locked?: boolean
          location_locked_at?: string | null
          location_locked_by?: string | null
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
      rent_bands: {
        Row: {
          fee_amount: number
          id: string
          label: string | null
          max_rent: number | null
          min_rent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          fee_amount?: number
          id?: string
          label?: string | null
          max_rent?: number | null
          min_rent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          fee_amount?: number
          id?: string
          label?: string | null
          max_rent?: number | null
          min_rent?: number
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
      rent_card_serial_stock: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_card_id: string | null
          batch_label: string | null
          created_at: string
          id: string
          office_name: string
          pair_group: string | null
          pair_index: number | null
          region: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          serial_number: string
          status: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_card_id?: string | null
          batch_label?: string | null
          created_at?: string
          id?: string
          office_name: string
          pair_group?: string | null
          pair_index?: number | null
          region?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          serial_number: string
          status?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_card_id?: string | null
          batch_label?: string | null
          created_at?: string
          id?: string
          office_name?: string
          pair_group?: string | null
          pair_index?: number | null
          region?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          serial_number?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_card_serial_stock_assigned_to_card_id_fkey"
            columns: ["assigned_to_card_id"]
            isOneToOne: false
            referencedRelation: "rent_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_cards: {
        Row: {
          activated_at: string | null
          advance_paid: number | null
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
        }
        Relationships: []
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
          tenancy_type: string
          tenant_accepted: boolean | null
          tenant_id_code: string
          tenant_signed_at: string | null
          tenant_user_id: string
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
          tenancy_type?: string
          tenant_accepted?: boolean | null
          tenant_id_code: string
          tenant_signed_at?: string | null
          tenant_user_id: string
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
          tenancy_type?: string
          tenant_accepted?: boolean | null
          tenant_id_code?: string
          tenant_signed_at?: string | null
          tenant_user_id?: string
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
          id: string
          registration_date: string | null
          registration_fee_paid: boolean
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          registration_date?: string | null
          registration_fee_paid?: boolean
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          account_status?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          registration_date?: string | null
          registration_fee_paid?: boolean
          status?: string
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
          created_at: string
          custom_amenities: string | null
          electricity_available: boolean | null
          has_borehole: boolean | null
          has_kitchen: boolean | null
          has_polytank: boolean | null
          has_toilet_bathroom: boolean | null
          id: string
          monthly_rent: number
          property_id: string
          status: string
          unit_name: string
          unit_type: string
          water_available: boolean | null
        }
        Insert: {
          amenities?: string[] | null
          created_at?: string
          custom_amenities?: string | null
          electricity_available?: boolean | null
          has_borehole?: boolean | null
          has_kitchen?: boolean | null
          has_polytank?: boolean | null
          has_toilet_bathroom?: boolean | null
          id?: string
          monthly_rent: number
          property_id: string
          status?: string
          unit_name: string
          unit_type: string
          water_available?: boolean | null
        }
        Update: {
          amenities?: string[] | null
          created_at?: string
          custom_amenities?: string | null
          electricity_available?: boolean | null
          has_borehole?: boolean | null
          has_kitchen?: boolean | null
          has_polytank?: boolean | null
          has_toilet_bathroom?: boolean | null
          id?: string
          monthly_rent?: number
          property_id?: string
          status?: string
          unit_name?: string
          unit_type?: string
          water_available?: boolean | null
        }
        Relationships: [
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
          created_at: string
          id: string
          landlord_user_id: string
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
          created_at?: string
          id?: string
          landlord_user_id: string
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
          created_at?: string
          id?: string
          landlord_user_id?: string
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
      [_ in never]: never
    }
    Functions: {
      generate_case_number: { Args: never; Returns: string }
      generate_purchase_id: { Args: never; Returns: string }
      generate_receipt_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_main_admin: { Args: { _user_id: string }; Returns: boolean }
      recalculate_compliance_score: {
        Args: { p_landlord_user_id: string }
        Returns: undefined
      }
      resolve_office_id: {
        Args: { p_area?: string; p_region: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "tenant" | "landlord" | "regulator"
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
      app_role: ["tenant", "landlord", "regulator"],
    },
  },
} as const
