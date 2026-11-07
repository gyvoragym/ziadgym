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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_gym_links: {
        Row: {
          favorite: boolean
          gym_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          favorite?: boolean
          gym_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          favorite?: boolean
          gym_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_gym_links_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_gym_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_membership_history: {
        Row: {
          definition: Json
          gym_id: string
          gym_name: string
          id: string
          member_record_id: string
          recorded_at: string
          user_id: string
        }
        Insert: {
          definition: Json
          gym_id: string
          gym_name: string
          id?: string
          member_record_id: string
          recorded_at?: string
          user_id: string
        }
        Update: {
          definition?: Json
          gym_id?: string
          gym_name?: string
          id?: string
          member_record_id?: string
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_membership_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_programs: {
        Row: {
          completion: number[]
          created_at: string
          definition: Json
          id: string
          source_gym_id: string | null
          source_workout_id: string | null
          user_id: string
        }
        Insert: {
          completion?: number[]
          created_at?: string
          definition: Json
          id?: string
          source_gym_id?: string | null
          source_workout_id?: string | null
          user_id: string
        }
        Update: {
          completion?: number[]
          created_at?: string
          definition?: Json
          id?: string
          source_gym_id?: string | null
          source_workout_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_gyvora_identity_keys: {
        Row: {
          account_id: string
          installation_id: string
          kind: string
          local_key: string
        }
        Insert: {
          account_id?: string
          installation_id: string
          kind: string
          local_key: string
        }
        Update: {
          account_id?: string
          installation_id?: string
          kind?: string
          local_key?: string
        }
        Relationships: []
      }
      gym_owner_event_status: {
        Row: {
          dismissed_at: string | null
          event_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          dismissed_at?: string | null
          event_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          dismissed_at?: string | null
          event_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_owner_event_status_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "gym_owner_events"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_owner_events: {
        Row: {
          created_at: string
          description: string
          event_key: string | null
          gym_id: string
          id: string
          page: string
          type: string
        }
        Insert: {
          created_at?: string
          description: string
          event_key?: string | null
          gym_id: string
          id?: string
          page: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string
          event_key?: string | null
          gym_id?: string
          id?: string
          page?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_owner_events_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_records: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          data: Json
          gym_id: string
          id: string
          kind: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          data: Json
          gym_id: string
          id: string
          kind: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          gym_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_records_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_subscription_events: {
        Row: {
          event_type: string
          gym_id: string
          id: string
          member_record_id: string
          occurred_at: string
          occurred_on: string
          plan_name: string
          price: number
        }
        Insert: {
          event_type: string
          gym_id: string
          id: string
          member_record_id: string
          occurred_at?: string
          occurred_on: string
          plan_name: string
          price: number
        }
        Update: {
          event_type?: string
          gym_id?: string
          id?: string
          member_record_id?: string
          occurred_at?: string
          occurred_on?: string
          plan_name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "gym_subscription_events_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          admin_note: string
          created_at: string
          deleted_at: string | null
          deletion_history: Json
          deletion_note: string
          freeze_note: string
          frozen_at: string | null
          gyvora_id: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          admin_note?: string
          created_at?: string
          deleted_at?: string | null
          deletion_history?: Json
          deletion_note?: string
          freeze_note?: string
          frozen_at?: string | null
          gyvora_id: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          admin_note?: string
          created_at?: string
          deleted_at?: string | null
          deletion_history?: Json
          deletion_note?: string
          freeze_note?: string
          frozen_at?: string | null
          gyvora_id?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gyms_gyvora_id_fkey"
            columns: ["gyvora_id"]
            isOneToOne: true
            referencedRelation: "gyvora_id_registry"
            referencedColumns: ["gyvora_id"]
          },
          {
            foreignKeyName: "gyms_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gyvora_allocator_state: {
        Row: {
          lower_bound: string
          singleton: boolean
        }
        Insert: {
          lower_bound?: string
          singleton?: boolean
        }
        Update: {
          lower_bound?: string
          singleton?: boolean
        }
        Relationships: []
      }
      gyvora_id_registry: {
        Row: {
          account_id: string
          assigned_at: string
          gyvora_id: string | null
          identity_version: number
          kind: string
          number: string
        }
        Insert: {
          account_id: string
          assigned_at?: string
          gyvora_id?: string | null
          identity_version?: number
          kind: string
          number: string
        }
        Update: {
          account_id?: string
          assigned_at?: string
          gyvora_id?: string | null
          identity_version?: number
          kind?: string
          number?: string
        }
        Relationships: []
      }
      login_challenges: {
        Row: {
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decision_by: string | null
          decision_note: string
          gym_id: string | null
          gym_name: string
          id: string
          phone: string
          plan: string
          request_billing_type: string | null
          request_duration_days: number | null
          request_plan_id: string | null
          request_price: number | null
          status: string
          trial_started_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision_by?: string | null
          decision_note?: string
          gym_id?: string | null
          gym_name: string
          id?: string
          phone?: string
          plan: string
          request_billing_type?: string | null
          request_duration_days?: number | null
          request_plan_id?: string | null
          request_price?: number | null
          status?: string
          trial_started_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision_by?: string | null
          decision_note?: string
          gym_id?: string | null
          gym_name?: string
          id?: string
          phone?: string
          plan?: string
          request_billing_type?: string | null
          request_duration_days?: number | null
          request_plan_id?: string | null
          request_price?: number | null
          status?: string
          trial_started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_requests_decision_by_fkey"
            columns: ["decision_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_requests_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_request_notifications: {
        Row: {
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_request_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_request_notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "owner_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: boolean
          logo: string
          name: string
          whatsapp: string
        }
        Insert: {
          id?: boolean
          logo?: string
          name?: string
          whatsapp?: string
        }
        Update: {
          id?: boolean
          logo?: string
          name?: string
          whatsapp?: string
        }
        Relationships: []
      }
      platform_subscription_plans: {
        Row: {
          active: boolean
          billing_type: string
          created_at: string
          duration_days: number
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_type: string
          created_at?: string
          duration_days: number
          id: string
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_type?: string
          created_at?: string
          duration_days?: number
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string
          disabled_at: string | null
          email: string
          freeze_note: string
          frozen_at: string | null
          full_name: string
          gyvora_id: string | null
          id: string
          member_id: string
          phone: string
          photo: string
        }
        Insert: {
          account_type?: string
          disabled_at?: string | null
          email?: string
          freeze_note?: string
          frozen_at?: string | null
          full_name?: string
          gyvora_id?: string | null
          id: string
          member_id?: string
          phone?: string
          photo?: string
        }
        Update: {
          account_type?: string
          disabled_at?: string | null
          email?: string
          freeze_note?: string
          frozen_at?: string | null
          full_name?: string
          gyvora_id?: string | null
          id?: string
          member_id?: string
          phone?: string
          photo?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gyvora_id_fkey"
            columns: ["gyvora_id"]
            isOneToOne: true
            referencedRelation: "gyvora_id_registry"
            referencedColumns: ["gyvora_id"]
          },
        ]
      }
      signup_verification_challenges: {
        Row: {
          channel: string
          consumed_at: string | null
          contact: string
          created_at: string
          expires_at: string
          token_hash: string
        }
        Insert: {
          channel: string
          consumed_at?: string | null
          contact: string
          created_at?: string
          expires_at?: string
          token_hash: string
        }
        Update: {
          channel?: string
          consumed_at?: string | null
          contact?: string
          created_at?: string
          expires_at?: string
          token_hash?: string
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          gym_id: string
          id: string
          invited_user_id: string | null
          permissions: string[]
          role: string
          status: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          gym_id: string
          id?: string
          invited_user_id?: string | null
          permissions?: string[]
          role: string
          status?: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          gym_id?: string
          id?: string
          invited_user_id?: string | null
          permissions?: string[]
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          display_name: string
          gym_id: string | null
          id: string
          permissions: string[]
          phone: string
          role: string
          user_id: string
        }
        Insert: {
          display_name?: string
          gym_id?: string | null
          id?: string
          permissions?: string[]
          phone?: string
          role: string
          user_id: string
        }
        Update: {
          display_name?: string
          gym_id?: string | null
          id?: string
          permissions?: string[]
          phone?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_sessions: {
        Row: {
          expires_at: string
          session_id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          expires_at: string
          session_id: string
          user_id: string
          verified_at?: string
        }
        Update: {
          expires_at?: string
          session_id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verified_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_request_list: {
        Args: never
        Returns: {
          created_at: string
          decided_at: string
          gym_name: string
          id: string
          owner_email: string
          owner_name: string
          plan: string
          status: string
        }[]
      }
      allocate_gyvora_id: { Args: { a: string; k: string }; Returns: string }
      can_read_image: { Args: { path: string }; Returns: boolean }
      client_frozen: { Args: never; Returns: boolean }
      client_gym_content: { Args: { g: string }; Returns: Json }
      client_gym_directory: { Args: never; Returns: Json }
      client_has_gym_approval: { Args: { g: string }; Returns: boolean }
      consume_gyvora_phone_login_attempt: {
        Args: { p_ip: string; p_phone: string }
        Returns: boolean
      }
      decide_owner_request: {
        Args: { approve: boolean; request_id: string }
        Returns: string
      }
      disable_gym_account: { Args: { g: string }; Returns: Json }
      finish_login: {
        Args: {
          challenge_hash: string
          expires: string
          sid: string
          uid: string
        }
        Returns: boolean
      }
      find_gyvora_profile_by_phone: {
        Args: { p_phone: string }
        Returns: string
      }
      gym_access: { Args: { area?: string; g: string }; Returns: boolean }
      gym_can_change: {
        Args: { action: string; area: string; g: string }
        Returns: boolean
      }
      gym_operational: { Args: { g: string }; Returns: boolean }
      gym_reporting_events: { Args: { g: string }; Returns: Json }
      gym_subscription_summary: { Args: { g: string }; Returns: Json }
      gyvora_next_number: { Args: { value: string }; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
      manage_client_lifecycle: {
        Args: { g?: string; target: string }
        Returns: boolean
      }
      mark_account_messages_read: {
        Args: { ids: string[] }
        Returns: undefined
      }
      my_staff_invitations: { Args: never; Returns: Json }
      otp_verified: { Args: never; Returns: boolean }
      owner_gate_state: { Args: never; Returns: Json }
      refresh_gym_expiration_events: {
        Args: { day: string; g: string }
        Returns: undefined
      }
      reserve_demo_gyvora_ids: {
        Args: { identities: Json; installation: string }
        Returns: Json
      }
      respond_invitation: {
        Args: { accept: boolean; invitation_id: string }
        Returns: undefined
      }
      review_owner_request: {
        Args: { approve: boolean; note?: string; request_id: string }
        Returns: string
      }
      save_gym_records: {
        Args: { changes: Json; g: string }
        Returns: undefined
      }
      send_account_message: {
        Args: { body: string; target: string }
        Returns: string
      }
      set_client_frozen: {
        Args: { frozen: boolean; note: string; target: string }
        Returns: undefined
      }
      set_gym_admin_note: {
        Args: { g: string; note: string }
        Returns: undefined
      }
      set_gym_deleted: {
        Args: { deleted: boolean; g: string; note?: string }
        Returns: undefined
      }
      set_gym_deletion_note: {
        Args: { g: string; note: string }
        Returns: undefined
      }
      set_gym_frozen: {
        Args: { frozen: boolean; g: string; note?: string }
        Returns: undefined
      }
      start_owner_trial: { Args: never; Returns: Json }
      submit_owner_request: {
        Args: {
          request_name: string
          request_phone: string
          request_plan: string
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decision_by: string | null
          decision_note: string
          gym_id: string | null
          gym_name: string
          id: string
          phone: string
          plan: string
          request_billing_type: string | null
          request_duration_days: number | null
          request_plan_id: string | null
          request_price: number | null
          status: string
          trial_started_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "owner_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
