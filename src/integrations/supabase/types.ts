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
      alt_payment_requests: {
        Row: {
          amount: number
          course_id: string
          course_name: string
          created_at: string
          email: string | null
          id: string
          level: string
          methods: string[]
          notes: string | null
          received_at: string | null
          received_by: string | null
          status: string
          student_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          course_id: string
          course_name: string
          created_at?: string
          email?: string | null
          id?: string
          level: string
          methods?: string[]
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: string
          student_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          course_id?: string
          course_name?: string
          created_at?: string
          email?: string | null
          id?: string
          level?: string
          methods?: string[]
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: string
          student_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          created_at: string
          event_category: string
          event_details: Json
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_category?: string
          event_details?: Json
          event_type: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_category?: string
          event_details?: Json
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      certificate_payments: {
        Row: {
          amount: number
          certificate_id: string | null
          certificate_type: string
          class_name: string | null
          course_id: string
          course_name: string | null
          created_at: string
          email: string | null
          id: string
          payment_status: string
          paypal_order_id: string | null
          school_name: string | null
          source: string
          student_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          certificate_id?: string | null
          certificate_type: string
          class_name?: string | null
          course_id: string
          course_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          payment_status?: string
          paypal_order_id?: string | null
          school_name?: string | null
          source?: string
          student_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          certificate_id?: string | null
          certificate_type?: string
          class_name?: string | null
          course_id?: string
          course_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          payment_status?: string
          paypal_order_id?: string | null
          school_name?: string | null
          source?: string
          student_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contracted_schools: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          normalized_name: string | null
          notes: string | null
          seat_limit: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          normalized_name?: string | null
          notes?: string | null
          seat_limit?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          normalized_name?: string | null
          notes?: string | null
          seat_limit?: number | null
        }
        Relationships: []
      }
      course_progress: {
        Row: {
          completed_modules: number[]
          course_id: string
          id: string
          is_completed: boolean
          level: string
          quiz_scores: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_modules?: number[]
          course_id: string
          id?: string
          is_completed?: boolean
          level: string
          quiz_scores?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_modules?: number[]
          course_id?: string
          id?: string
          is_completed?: boolean
          level?: string
          quiz_scores?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      enrollment_certificate_ids: {
        Row: {
          certificate_id: string
          course_id: string
          course_title: string | null
          created_at: string
          id: string
          level: string
          student_name: string | null
          user_id: string
        }
        Insert: {
          certificate_id: string
          course_id: string
          course_title?: string | null
          created_at?: string
          id?: string
          level: string
          student_name?: string | null
          user_id: string
        }
        Update: {
          certificate_id?: string
          course_id?: string
          course_title?: string | null
          created_at?: string
          id?: string
          level?: string
          student_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          course_title: string | null
          created_at: string
          id: string
          level: string
          user_id: string
        }
        Insert: {
          course_id: string
          course_title?: string | null
          created_at?: string
          id?: string
          level: string
          user_id: string
        }
        Update: {
          course_id?: string
          course_title?: string | null
          created_at?: string
          id?: string
          level?: string
          user_id?: string
        }
        Relationships: []
      }
      ip_reputation: {
        Row: {
          anomaly_count: number
          banned_until: string | null
          created_at: string
          failed_logins: number
          ip_address: string
          last_seen_at: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          anomaly_count?: number
          banned_until?: string | null
          created_at?: string
          failed_logins?: number
          ip_address: string
          last_seen_at?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          anomaly_count?: number
          banned_until?: string | null
          created_at?: string
          failed_logins?: number
          ip_address?: string
          last_seen_at?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          created_at: string
          event_key: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_key: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_key?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      partnership_program_requests: {
        Row: {
          audience: string
          created_at: string
          email: string
          expected_reach: string | null
          id: string
          message: string | null
          organization_name: string
          organization_type: string
          partner_name: string
          phone: string | null
          program_description: string
          program_title: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          audience: string
          created_at?: string
          email: string
          expected_reach?: string | null
          id?: string
          message?: string | null
          organization_name: string
          organization_type: string
          partner_name: string
          phone?: string | null
          program_description: string
          program_title: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          audience?: string
          created_at?: string
          email?: string
          expected_reach?: string | null
          id?: string
          message?: string | null
          organization_name?: string
          organization_type?: string
          partner_name?: string
          phone?: string | null
          program_description?: string
          program_title?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          anonymized_at: string | null
          city: string | null
          class_name: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          deletion_status: string
          email: string | null
          engagement_segment: string
          full_name: string | null
          id: string
          last_active_at: string
          last_password_change: string
          mobile_number: string | null
          normalized_school: string | null
          school_id: string | null
          school_name: string | null
          signup_type: string
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          city?: string | null
          class_name?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_status?: string
          email?: string | null
          engagement_segment?: string
          full_name?: string | null
          id: string
          last_active_at?: string
          last_password_change?: string
          mobile_number?: string | null
          normalized_school?: string | null
          school_id?: string | null
          school_name?: string | null
          signup_type?: string
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          city?: string | null
          class_name?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_status?: string
          email?: string | null
          engagement_segment?: string
          full_name?: string | null
          id?: string
          last_active_at?: string
          last_password_change?: string
          mobile_number?: string | null
          normalized_school?: string | null
          school_id?: string | null
          school_name?: string | null
          signup_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "contracted_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_hits: {
        Row: {
          bucket_key: string
          created_at: string
          id: string
          ip_address: string
          method: string
        }
        Insert: {
          bucket_key: string
          created_at?: string
          id?: string
          ip_address: string
          method?: string
        }
        Update: {
          bucket_key?: string
          created_at?: string
          id?: string
          ip_address?: string
          method?: string
        }
        Relationships: []
      }
      retention_archive: {
        Row: {
          created_at: string
          id: string
          kind: string
          original_user_id: string
          payload: Json
          retain_until: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          original_user_id: string
          payload?: Json
          retain_until: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          original_user_id?: string
          payload?: Json
          retain_until?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_admins: {
        Row: {
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          normalized_school: string | null
          school_id: string | null
          school_name: string
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          normalized_school?: string | null
          school_id?: string | null
          school_name: string
          user_id: string
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          normalized_school?: string | null
          school_id?: string | null
          school_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_admins_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "contracted_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_rosters: {
        Row: {
          class_name: string | null
          created_at: string
          full_name: string
          id: string
          normalized_name: string | null
          normalized_school: string | null
          school_admin_id: string
          school_id: string | null
          school_name: string
        }
        Insert: {
          class_name?: string | null
          created_at?: string
          full_name: string
          id?: string
          normalized_name?: string | null
          normalized_school?: string | null
          school_admin_id: string
          school_id?: string | null
          school_name: string
        }
        Update: {
          class_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          normalized_name?: string | null
          normalized_school?: string | null
          school_admin_id?: string
          school_id?: string | null
          school_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_rosters_school_admin_id_fkey"
            columns: ["school_admin_id"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "school_rosters_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "contracted_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      session_anomalies: {
        Row: {
          anomaly_type: string
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          points: number
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          anomaly_type: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          points?: number
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          anomaly_type?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          points?: number
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      special_program_diplomas: {
        Row: {
          course_id: string
          created_at: string
          id: string
          issued: boolean
          issued_at: string | null
          issued_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          issued?: boolean
          issued_at?: string | null
          issued_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          issued?: boolean
          issued_at?: string | null
          issued_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_engagement: {
        Row: {
          channel: string
          created_at: string
          id: string
          message: string | null
          nudge_type: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          nudge_type: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          nudge_type?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      ux_failures: {
        Row: {
          click_count: number
          created_at: string
          details: Json
          element_label: string | null
          failure_type: string
          id: string
          replay_url: string | null
          route: string | null
          user_id: string | null
        }
        Insert: {
          click_count?: number
          created_at?: string
          details?: Json
          element_label?: string | null
          failure_type?: string
          id?: string
          replay_url?: string | null
          route?: string | null
          user_id?: string | null
        }
        Update: {
          click_count?: number
          created_at?: string
          details?: Json
          element_label?: string | null
          failure_type?: string
          id?: string
          replay_url?: string | null
          route?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      is_admin: { Args: never; Returns: boolean }
      is_school_contracted: { Args: { _name: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _event_category?: string
          _event_details?: Json
          _event_type: string
          _ip_address?: string
          _severity?: string
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
      pretty_name_from_email: { Args: { _email: string }; Returns: string }
      purge_expired_retention_archive: { Args: never; Returns: number }
      register_rate_limit_hit: {
        Args: {
          _bucket_key: string
          _ip: string
          _limit: number
          _method: string
          _window_seconds: number
        }
        Returns: Json
      }
      run_engagement_sweep: { Args: never; Returns: Json }
      school_for_admin: { Args: { _user_id: string }; Returns: string }
      school_id_for_admin: { Args: { _user_id: string }; Returns: string }
      session_risk_score: {
        Args: { _session_id?: string; _user_id: string }
        Returns: number
      }
      touch_last_active: { Args: never; Returns: undefined }
      touch_last_password_change: {
        Args: { _user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "school_admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user", "school_admin"],
    },
  },
} as const
