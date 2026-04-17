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
          template_label: string
          template_type: string
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
          template_label?: string
          template_type?: string
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
          template_label?: string
          template_type?: string
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
          id: string
          igf_pct: number
          kind: string
          label: string
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
          id?: string
          igf_pct?: number
          kind: string
          label: string
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
          id?: string
          igf_pct?: number
          kind?: string
          label?: string
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
      complaints: {
        Row: {
          audio_url: string | null
          basket_total: number | null
          claim_amount: number | null
          complaint_code: string
          complaint_property_id: string | null
          complaint_type: string
          complaint_type_id: string | null
          created_at: string
          description: string
          evidence_urls: string[] | null
          gps_confirmed: boolean
          gps_confirmed_at: string | null
          gps_location: string | null
          id: string
          landlord_name: string
          linked_property_id: string | null
          office_id: string | null
          outstanding_amount: number | null
          payment_status: string
          property_address: string
          receipt_id: string | null
          region: string
          status: string
          tenant_user_id: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          basket_total?: number | null
          claim_amount?: number | null
          complaint_code: string
          complaint_property_id?: string | null
          complaint_type: string
          complaint_type_id?: string | null
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          gps_confirmed?: boolean
          gps_confirmed_at?: string | null
          gps_location?: string | null
          id?: string
          landlord_name: string
          linked_property_id?: string | null
          office_id?: string | null
          outstanding_amount?: number | null
          payment_status?: string
          property_address: string
          receipt_id?: string | null
          region: string
          status?: string
          tenant_user_id: string
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          basket_total?: number | null
          claim_amount?: number | null
          complaint_code?: string
          complaint_property_id?: string | null
          complaint_type?: string
          complaint_type_id?: string | null
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          gps_confirmed?: boolean
          gps_confirmed_at?: string | null
          gps_location?: string | null
          id?: string
          landlord_name?: string
          linked_property_id?: string | null
          office_id?: string | null
          outstanding_amount?: number | null
          payment_status?: string
          property_address?: string
          receipt_id?: string | null
          region?: string
          status?: string
          tenant_user_id?: string
          ticket_number?: string
          updated_at?: string
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
          complaint_basket_item_id: string | null
          correction_run_id: string | null
          description: string | null
          disbursement_status: string
          escrow_transaction_id: string
          id: string
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
          basket_total: number | null
          claim_amount: number | null
          complaint_code: string
          complaint_type: string
          complaint_type_id: string | null
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          landlord_user_id: string
          linked_property_id: string | null
          office_id: string | null
          outstanding_amount: number | null
          payment_status: string
          property_address: string
          receipt_id: string | null
          region: string
          status: string
          tenant_name: string | null
          ticket_number: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          basket_total?: number | null
          claim_amount?: number | null
          complaint_code: string
          complaint_type: string
          complaint_type_id?: string | null
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          landlord_user_id: string
          linked_property_id?: string | null
          office_id?: string | null
          outstanding_amount?: number | null
          payment_status?: string
          property_address: string
          receipt_id?: string | null
          region: string
          status?: string
          tenant_name?: string | null
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          basket_total?: number | null
          claim_amount?: number | null
          complaint_code?: string
          complaint_type?: string
          complaint_type_id?: string | null
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          landlord_user_id?: string
          linked_property_id?: string | null
          office_id?: string | null
          outstanding_amount?: number | null
          payment_status?: string
          property_address?: string
          receipt_id?: string | null
          region?: string
          status?: string
          tenant_name?: string | null
          ticket_number?: string
          updated_at?: string
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
      payment_receipts: {
        Row: {
          admin_confirmed_at: string | null
          admin_confirmed_by: string | null
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
          admin_confirmed_at?: string | null
          admin_confirmed_by?: string | null
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
          admin_confirmed_at?: string | null
          admin_confirmed_by?: string | null
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
          user_type: string
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
          user_type?: string
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
      student_residence_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          hostel_or_hall: string | null
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
          hostel_or_hall?: string | null
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
          hostel_or_hall?: string | null
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
          tax_compliance_status?: string
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
          tax_compliance_status?: string
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
          hostel_or_hall: string | null
          id: string
          is_student: boolean
          registration_date: string | null
          registration_fee_paid: boolean
          room_or_bed_space: string | null
          school: string | null
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          expiry_date?: string | null
          hostel_or_hall?: string | null
          id?: string
          is_student?: boolean
          registration_date?: string | null
          registration_fee_paid?: boolean
          room_or_bed_space?: string | null
          school?: string | null
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          account_status?: string
          created_at?: string
          expiry_date?: string | null
          hostel_or_hall?: string | null
          id?: string
          is_student?: boolean
          registration_date?: string | null
          registration_fee_paid?: boolean
          room_or_bed_space?: string | null
          school?: string | null
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
      assign_serials_atomic: {
        Args: {
          p_assigned_by: string
          p_office_id: string
          p_office_name: string
          p_pairs: Json
        }
        Returns: Json
      }
      generate_case_number: { Args: never; Returns: string }
      generate_complaint_ticket: { Args: never; Returns: string }
      generate_purchase_id: { Args: never; Returns: string }
      generate_receipt_number: { Args: never; Returns: string }
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
      is_main_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      recalculate_compliance_score: {
        Args: { p_landlord_user_id: string }
        Returns: undefined
      }
      resolve_office_id: {
        Args: { p_area?: string; p_region: string }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unassign_serial_atomic: {
        Args: { p_serial_number: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "tenant" | "landlord" | "regulator" | "nugs_admin"
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
      app_role: ["tenant", "landlord", "regulator", "nugs_admin"],
    },
  },
} as const
