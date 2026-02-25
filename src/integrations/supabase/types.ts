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
      agreement_template_config: {
        Row: {
          custom_fields: Json | null
          id: string
          max_advance_months: number
          max_lease_duration: number
          min_lease_duration: number
          registration_deadline_days: number
          tax_rate: number
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
          terms?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      complaints: {
        Row: {
          complaint_code: string
          complaint_type: string
          created_at: string
          description: string
          id: string
          landlord_name: string
          property_address: string
          region: string
          status: string
          tenant_user_id: string
          updated_at: string
        }
        Insert: {
          complaint_code: string
          complaint_type: string
          created_at?: string
          description: string
          id?: string
          landlord_name: string
          property_address: string
          region: string
          status?: string
          tenant_user_id: string
          updated_at?: string
        }
        Update: {
          complaint_code?: string
          complaint_type?: string
          created_at?: string
          description?: string
          id?: string
          landlord_name?: string
          property_address?: string
          region?: string
          status?: string
          tenant_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      landlords: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          landlord_id: string
          registration_date: string | null
          registration_fee_paid: boolean
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          landlord_id: string
          registration_date?: string | null
          registration_fee_paid?: boolean
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          landlord_id?: string
          registration_date?: string | null
          registration_fee_paid?: boolean
          status?: string
          user_id?: string
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
          area: string
          created_at: string
          gps_location: string | null
          id: string
          landlord_user_id: string
          property_code: string
          property_condition: string | null
          property_name: string | null
          region: string
          updated_at: string
        }
        Insert: {
          address: string
          area: string
          created_at?: string
          gps_location?: string | null
          id?: string
          landlord_user_id: string
          property_code: string
          property_condition?: string | null
          property_name?: string | null
          region: string
          updated_at?: string
        }
        Update: {
          address?: string
          area?: string
          created_at?: string
          gps_location?: string | null
          id?: string
          landlord_user_id?: string
          property_code?: string
          property_condition?: string | null
          property_name?: string | null
          region?: string
          updated_at?: string
        }
        Relationships: []
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
      tenancies: {
        Row: {
          advance_months: number
          agreed_rent: number
          agreement_pdf_url: string | null
          created_at: string
          custom_field_values: Json | null
          end_date: string
          id: string
          landlord_accepted: boolean | null
          landlord_user_id: string
          move_in_date: string
          registration_code: string
          start_date: string
          status: string
          tenant_accepted: boolean | null
          tenant_id_code: string
          tenant_user_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          advance_months?: number
          agreed_rent: number
          agreement_pdf_url?: string | null
          created_at?: string
          custom_field_values?: Json | null
          end_date: string
          id?: string
          landlord_accepted?: boolean | null
          landlord_user_id: string
          move_in_date: string
          registration_code: string
          start_date: string
          status?: string
          tenant_accepted?: boolean | null
          tenant_id_code: string
          tenant_user_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          advance_months?: number
          agreed_rent?: number
          agreement_pdf_url?: string | null
          created_at?: string
          custom_field_values?: Json | null
          end_date?: string
          id?: string
          landlord_accepted?: boolean | null
          landlord_user_id?: string
          move_in_date?: string
          registration_code?: string
          start_date?: string
          status?: string
          tenant_accepted?: boolean | null
          tenant_id_code?: string
          tenant_user_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
