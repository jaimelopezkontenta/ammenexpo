export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      bible_book_aliases: {
        Row: {
          alias: string
          book_id: number
        }
        Insert: {
          alias: string
          book_id: number
        }
        Update: {
          alias?: string
          book_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bible_book_aliases_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["id"]
          },
        ]
      }
      bible_books: {
        Row: {
          chapter_count: number
          id: number
          modern_name: string
          name: string
          name_en: string
          new_testament: boolean
        }
        Insert: {
          chapter_count: number
          id: number
          modern_name: string
          name: string
          name_en: string
          new_testament: boolean
        }
        Update: {
          chapter_count?: number
          id?: number
          modern_name?: string
          name?: string
          name_en?: string
          new_testament?: boolean
        }
        Relationships: []
      }
      bible_highlights: {
        Row: {
          book_id: number
          chapter: number
          created_at: string
          user_id: string
          verse: number
        }
        Insert: {
          book_id: number
          chapter: number
          created_at?: string
          user_id: string
          verse: number
        }
        Update: {
          book_id?: number
          chapter?: number
          created_at?: string
          user_id?: string
          verse?: number
        }
        Relationships: [
          {
            foreignKeyName: "bible_highlights_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_highlights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bible_notes: {
        Row: {
          body: string
          book_id: number
          chapter: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
          verse: number
        }
        Insert: {
          body: string
          book_id: number
          chapter: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          verse: number
        }
        Update: {
          body?: string
          book_id?: number
          chapter?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          verse?: number
        }
        Relationships: [
          {
            foreignKeyName: "bible_notes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bible_verses: {
        Row: {
          book_id: number
          chapter: number
          search_vector: unknown
          text: string
          verse: number
          version: string
        }
        Insert: {
          book_id: number
          chapter: number
          search_vector?: unknown
          text: string
          verse: number
          version?: string
        }
        Update: {
          book_id?: number
          chapter?: number
          search_vector?: unknown
          text?: string
          verse?: number
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "bible_verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_verses_version_fkey"
            columns: ["version"]
            isOneToOne: false
            referencedRelation: "bible_versions"
            referencedColumns: ["code"]
          },
        ]
      }
      bible_versions: {
        Row: {
          code: string
          is_default: boolean
          language: string
          license: string
          name: string
          source: string
        }
        Insert: {
          code: string
          is_default?: boolean
          language: string
          license: string
          name: string
          source: string
        }
        Update: {
          code?: string
          is_default?: boolean
          language?: string
          license?: string
          name?: string
          source?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          crisis_flagged_at: string | null
          held_at: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          crisis_flagged_at?: string | null
          held_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          crisis_flagged_at?: string | null
          held_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_holds: {
        Row: {
          author_id: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          id: string
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          author_id: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          author_id?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_holds_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_holds_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_holds_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          group_id: string | null
          id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          group_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          group_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_escalations: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          author_id: string
          created_at: string
          id: string
          note: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          author_id: string
          created_at?: string
          id?: string
          note?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          author_id?: string
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crisis_escalations_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crisis_escalations_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_verses: {
        Row: {
          book_id: number
          chapter: number
          ord: number
          verse: number
        }
        Insert: {
          book_id: number
          chapter: number
          ord: number
          verse: number
        }
        Update: {
          book_id?: number
          chapter?: number
          ord?: number
          verse?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          outbox_id: string | null
          payload: Json
          resend_id: string | null
          svix_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          outbox_id?: string | null
          payload?: Json
          resend_id?: string | null
          svix_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          outbox_id?: string | null
          payload?: Json
          resend_id?: string | null
          svix_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "email_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          idempotency_key: string
          invited_by: string | null
          last_error: string | null
          leased_until: string | null
          locale: string
          next_attempt_at: string
          payload: Json
          resend_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          template: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          idempotency_key: string
          invited_by?: string | null
          last_error?: string | null
          leased_until?: string | null
          locale?: string
          next_attempt_at?: string
          payload?: Json
          resend_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          invited_by?: string | null
          last_error?: string | null
          leased_until?: string | null
          locale?: string
          next_attempt_at?: string
          payload?: Json
          resend_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          cadence: Database["public"]["Enums"]["email_cadence"]
          nudge: boolean
          previous_cadence: Database["public"]["Enums"]["email_cadence"] | null
          social: boolean
          sunset_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cadence?: Database["public"]["Enums"]["email_cadence"]
          nudge?: boolean
          previous_cadence?: Database["public"]["Enums"]["email_cadence"] | null
          social?: boolean
          sunset_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cadence?: Database["public"]["Enums"]["email_cadence"]
          nudge?: boolean
          previous_cadence?: Database["public"]["Enums"]["email_cadence"] | null
          social?: boolean
          sunset_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_runtime: {
        Row: {
          hmac_secret: string | null
          id: boolean
          pause_growth: boolean
          updated_at: string
        }
        Insert: {
          hmac_secret?: string | null
          id?: boolean
          pause_growth?: boolean
          updated_at?: string
        }
        Update: {
          hmac_secret?: string | null
          id?: boolean
          pause_growth?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          reason?: string
        }
        Relationships: []
      }
      feature_flag_events: {
        Row: {
          action: string
          actor: string
          created_at: string
          flag_key: string
          id: string
          reason: string
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          flag_key: string
          id?: string
          reason: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          flag_key?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          key: string
          owner: string
          reason: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          key: string
          owner: string
          reason: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          key?: string
          owner?: string
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_ledger: {
        Row: {
          created_at: string
          duration_days: number | null
          error: string | null
          from_day: number | null
          group_id: string | null
          id: string
          plan_id: string | null
          request_id: string
          scope: string
          status: string
          to_day: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_days?: number | null
          error?: string | null
          from_day?: number | null
          group_id?: string | null
          id?: string
          plan_id?: string | null
          request_id: string
          scope: string
          status: string
          to_day?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_days?: number | null
          error?: string | null
          from_day?: number | null
          group_id?: string | null
          id?: string
          plan_id?: string | null
          request_id?: string
          scope?: string
          status?: string
          to_day?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_ledger_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_ledger_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "prayer_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_prayer_days: {
        Row: {
          completed_at: string
          group_id: string
          plan_day_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          group_id: string
          plan_day_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          group_id?: string
          plan_day_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_prayer_days_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_prayer_days_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "prayer_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_prayer_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          invite_token: string
          member_count: number
          name: string
          owner_id: string
          search_vector: unknown
          streak_count: number
          streak_last_day: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["group_visibility"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invite_token?: string
          member_count?: number
          name: string
          owner_id: string
          search_vector?: unknown
          streak_count?: number
          streak_last_day?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["group_visibility"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invite_token?: string
          member_count?: number
          name?: string
          owner_id?: string
          search_vector?: unknown
          streak_count?: number
          streak_last_day?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["group_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intercessions: {
        Row: {
          created_at: string
          id: string
          intercessor_id: string
          message: string | null
          message_hidden_at: string | null
          plan_day_id: string
          plan_owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intercessor_id: string
          message?: string | null
          message_hidden_at?: string | null
          plan_day_id: string
          plan_owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intercessor_id?: string
          message?: string | null
          message_hidden_at?: string | null
          plan_day_id?: string
          plan_owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intercessions_intercessor_id_fkey"
            columns: ["intercessor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercessions_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "prayer_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercessions_plan_owner_id_fkey"
            columns: ["plan_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          channel: string | null
          code: string
          created_at: string
          id: string
          inviter_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          channel?: string | null
          code?: string
          created_at?: string
          id?: string
          inviter_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          channel?: string | null
          code?: string
          created_at?: string
          id?: string
          inviter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          hidden_at: string | null
          hidden_by: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          dedupe_key: string | null
          id: string
          payload: Json
          push_sent_at: string | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          payload?: Json
          push_sent_at?: string | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          payload?: Json
          push_sent_at?: string | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_generation_leases: {
        Row: {
          claimed_by: string
          created_at: string
          from_day: number
          lease_id: string
          leased_until: string
          plan_id: string
          request_id: string
          to_day: number
        }
        Insert: {
          claimed_by: string
          created_at?: string
          from_day: number
          lease_id: string
          leased_until: string
          plan_id: string
          request_id: string
          to_day: number
        }
        Update: {
          claimed_by?: string
          created_at?: string
          from_day?: number
          lease_id?: string
          leased_until?: string
          plan_id?: string
          request_id?: string
          to_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_generation_leases_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_generation_leases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "prayer_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_shares: {
        Row: {
          created_at: string
          created_by: string
          group_id: string | null
          id: string
          plan_id: string
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          group_id?: string | null
          id?: string
          plan_id: string
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          group_id?: string | null
          id?: string
          plan_id?: string
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_shares_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_shares_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "prayer_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_waitlist: {
        Row: {
          created_at: string
          email: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      post_prayers: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_prayers_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_prayers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          answered_at: string | null
          author_id: string
          body: string
          comment_count: number
          created_at: string
          crisis_flagged_at: string | null
          group_id: string | null
          held_at: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          is_anonymous: boolean
          prayer_count: number
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          author_id: string
          body: string
          comment_count?: number
          created_at?: string
          crisis_flagged_at?: string | null
          group_id?: string | null
          held_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_anonymous?: boolean
          prayer_count?: number
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          author_id?: string
          body?: string
          comment_count?: number
          created_at?: string
          crisis_flagged_at?: string | null
          group_id?: string | null
          held_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_anonymous?: boolean
          prayer_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_list_items: {
        Row: {
          answered_at: string | null
          body: string
          created_at: string
          id: string
          tag: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answered_at?: string | null
          body: string
          created_at?: string
          id?: string
          tag?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answered_at?: string | null
          body?: string
          created_at?: string
          id?: string
          tag?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_list_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_logs: {
        Row: {
          completed_at: string
          id: string
          note: string | null
          plan_day_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          note?: string | null
          plan_day_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          note?: string | null
          plan_day_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_logs_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "prayer_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_plan_days: {
        Row: {
          created_at: string
          daily_action: string | null
          day_number: number
          id: string
          intercession_count: number
          intercessor_prayer: string | null
          interpretation: string | null
          plan_id: string
          prayer_body: string
          scripture_ref: string | null
          scripture_text: string | null
          title: string
          unlock_date: string
        }
        Insert: {
          created_at?: string
          daily_action?: string | null
          day_number: number
          id?: string
          intercession_count?: number
          intercessor_prayer?: string | null
          interpretation?: string | null
          plan_id: string
          prayer_body: string
          scripture_ref?: string | null
          scripture_text?: string | null
          title: string
          unlock_date: string
        }
        Update: {
          created_at?: string
          daily_action?: string | null
          day_number?: number
          id?: string
          intercession_count?: number
          intercessor_prayer?: string | null
          interpretation?: string | null
          plan_id?: string
          prayer_body?: string
          scripture_ref?: string | null
          scripture_text?: string | null
          title?: string
          unlock_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "prayer_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_plans: {
        Row: {
          created_at: string
          duration_days: number
          generated_by: Database["public"]["Enums"]["plan_source"]
          generation_error: string | null
          generation_heartbeat_at: string | null
          group_id: string | null
          id: string
          owner_id: string
          source_prompt: Json | null
          start_date: string
          status: Database["public"]["Enums"]["plan_status"]
          theme: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["plan_visibility"]
        }
        Insert: {
          created_at?: string
          duration_days: number
          generated_by?: Database["public"]["Enums"]["plan_source"]
          generation_error?: string | null
          generation_heartbeat_at?: string | null
          group_id?: string | null
          id?: string
          owner_id: string
          source_prompt?: Json | null
          start_date?: string
          status?: Database["public"]["Enums"]["plan_status"]
          theme?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["plan_visibility"]
        }
        Update: {
          created_at?: string
          duration_days?: number
          generated_by?: Database["public"]["Enums"]["plan_source"]
          generation_error?: string | null
          generation_heartbeat_at?: string | null
          group_id?: string | null
          id?: string
          owner_id?: string
          source_prompt?: Json | null
          start_date?: string
          status?: Database["public"]["Enums"]["plan_status"]
          theme?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["plan_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "prayer_plans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_plans_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_settings: {
        Row: {
          active_plan_id: string | null
          created_at: string
          expo_push_token: string | null
          id: string
          last_read_at: string | null
          last_read_book_id: number | null
          last_read_chapter: number | null
          last_read_verse: number | null
          locale: string
          onboarding_answers: Json | null
          pending_invite_code: string | null
          pending_share_token: string | null
          reminder_hours: number[]
          signup_source: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          active_plan_id?: string | null
          created_at?: string
          expo_push_token?: string | null
          id: string
          last_read_at?: string | null
          last_read_book_id?: number | null
          last_read_chapter?: number | null
          last_read_verse?: number | null
          locale?: string
          onboarding_answers?: Json | null
          pending_invite_code?: string | null
          pending_share_token?: string | null
          reminder_hours?: number[]
          signup_source?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          active_plan_id?: string | null
          created_at?: string
          expo_push_token?: string | null
          id?: string
          last_read_at?: string | null
          last_read_book_id?: number | null
          last_read_chapter?: number | null
          last_read_verse?: number | null
          locale?: string
          onboarding_answers?: Json | null
          pending_invite_code?: string | null
          pending_share_token?: string | null
          reminder_hours?: number[]
          signup_source?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_settings_active_plan_id_fkey"
            columns: ["active_plan_id"]
            isOneToOne: false
            referencedRelation: "prayer_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_settings_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_settings_last_read_book_id_fkey"
            columns: ["last_read_book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          follower_count: number
          following_count: number
          id: string
          is_staff: boolean
          last_seen_at: string | null
          search_vector: unknown
          streak_count: number
          streak_last_day: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          follower_count?: number
          following_count?: number
          id: string
          is_staff?: boolean
          last_seen_at?: string | null
          search_vector?: unknown
          streak_count?: number
          streak_last_day?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          follower_count?: number
          following_count?: number
          id?: string
          is_staff?: boolean
          last_seen_at?: string | null
          search_vector?: unknown
          streak_count?: number
          streak_last_day?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_settings: {
        Row: {
          api_urls: string[]
          id: boolean
          updated_at: string
        }
        Insert: {
          api_urls?: string[]
          id?: boolean
          updated_at?: string
        }
        Update: {
          api_urls?: string[]
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      push_devices: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          last_used_at: string
          platform: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          last_used_at?: string
          platform: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          last_used_at?: string
          platform?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_outbox: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          device_id: string
          id: string
          intercession_id: string
          last_error: string | null
          leased_until: string | null
          next_attempt_at: string
          receipt_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          device_id: string
          id?: string
          intercession_id: string
          last_error?: string | null
          leased_until?: string | null
          next_attempt_at?: string
          receipt_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          device_id?: string
          id?: string
          intercession_id?: string
          last_error?: string | null
          leased_until?: string | null
          next_attempt_at?: string
          receipt_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_outbox_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "push_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_intercession_id_fkey"
            columns: ["intercession_id"]
            isOneToOne: false
            referencedRelation: "intercessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduler_settings: {
        Row: {
          enabled: boolean
          functions_url: string | null
          id: boolean
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          functions_url?: string | null
          id?: boolean
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          functions_url?: string | null
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      share_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          group_id: string | null
          id: string
          plan_id: string | null
          revoked_at: string | null
          scope: Database["public"]["Enums"]["share_scope"]
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          group_id?: string | null
          id?: string
          plan_id?: string | null
          revoked_at?: string | null
          scope: Database["public"]["Enums"]["share_scope"]
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          group_id?: string | null
          id?: string
          plan_id?: string | null
          revoked_at?: string | null
          scope?: Database["public"]["Enums"]["share_scope"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "prayer_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_admin_events: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          reason: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          id?: string
          reason: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          reason?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          entitlement: string | null
          expires_at: string | null
          revenuecat_customer_id: string | null
          status: string
          store: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          entitlement?: string | null
          expires_at?: string | null
          revenuecat_customer_id?: string | null
          status?: string
          store?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          entitlement?: string | null
          expires_at?: string | null
          revenuecat_customer_id?: string | null
          status?: string
          store?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonies: {
        Row: {
          body: string
          created_at: string
          id: string
          image_url: string | null
          list_item_id: string | null
          plan_id: string | null
          post_id: string | null
          user_id: string
          visibility: Database["public"]["Enums"]["testimony_visibility"]
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          image_url?: string | null
          list_item_id?: string | null
          plan_id?: string | null
          post_id?: string | null
          user_id: string
          visibility?: Database["public"]["Enums"]["testimony_visibility"]
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          list_item_id?: string | null
          plan_id?: string | null
          post_id?: string | null
          user_id?: string
          visibility?: Database["public"]["Enums"]["testimony_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "testimonies_list_item_id_fkey"
            columns: ["list_item_id"]
            isOneToOne: false
            referencedRelation: "prayer_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "prayer_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonies_user_id_fkey"
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
      accept_terms: { Args: { p_version: string }; Returns: undefined }
      acknowledge_crisis: {
        Args: { p_id: string; p_note: string }
        Returns: boolean
      }
      admin_set_flag: {
        Args: {
          p_actor: string
          p_enabled: boolean
          p_key: string
          p_reason: string
        }
        Returns: boolean
      }
      admin_set_staff: {
        Args: {
          p_actor: string
          p_make_staff: boolean
          p_reason: string
          p_user_id: string
        }
        Returns: boolean
      }
      archive_my_plan: { Args: { p_plan_id: string }; Returns: undefined }
      avatar_url_is_valid: {
        Args: { p_url: string; p_user: string }
        Returns: boolean
      }
      bible_book_label: {
        Args: { p_book_id: number; p_version?: string }
        Returns: string
      }
      bible_search_config: { Args: { p_version: string }; Returns: unknown }
      blocked_either_way: { Args: { p_user_id: string }; Returns: boolean }
      can_create_circle_plan: { Args: { p_group_id: string }; Returns: boolean }
      can_pray_plan: { Args: { pid: string }; Returns: boolean }
      can_pray_plan_day: { Args: { did: string }; Returns: boolean }
      can_read_plan: { Args: { pid: string }; Returns: boolean }
      can_read_plan_day: { Args: { did: string }; Returns: boolean }
      can_read_post: { Args: { pid: string }; Returns: boolean }
      circle_conversation: { Args: { p_group_id: string }; Returns: string }
      circle_invite_token: { Args: { p_group_id: string }; Returns: string }
      circle_messages: {
        Args: { p_before?: string; p_group_id: string; p_limit?: number }
        Returns: {
          body: string
          created_at: string
          id: string
          is_mine: boolean
          sender_avatar_url: string
          sender_id: string
          sender_name: string
        }[]
      }
      circle_plan: {
        Args: { p_group_id: string }
        Returns: {
          day_id: string
          day_number: number
          day_title: string
          duration_days: number
          finished: boolean
          plan_id: string
          prayed_count: number
          prayed_today: boolean
          status: string
          theme: string
          title: string
        }[]
      }
      circle_shared_plans: {
        Args: { p_group_id: string }
        Returns: {
          is_mine: boolean
          owner_id: string
          owner_name: string
          plan_id: string
          plan_title: string
        }[]
      }
      claim_email_outbox_batch: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempts: number
          channel: string
          idempotency_key: string
          locale: string
          outbox_id: string
          payload: Json
          template: string
          to_email: string
          user_id: string
        }[]
      }
      claim_generation_chunk: {
        Args: {
          p_lease_seconds?: number
          p_plan_id: string
          p_request_id: string
        }
        Returns: {
          duration_days: number
          from_day: number
          lease_id: string
          reason: string
          to_day: number
          written: number
        }[]
      }
      claim_hold: { Args: { p_hold_id: string }; Returns: boolean }
      claim_push_outbox_batch: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempts: number
          expo_push_token: string
          intercession_id: string
          intercessor_name: string
          outbox_id: string
          owner_id: string
          owner_name: string
        }[]
      }
      clear_foreign_avatar_urls: { Args: never; Returns: number }
      complete_generation_chunk: {
        Args: {
          p_days: Json
          p_lease_id: string
          p_source_prompt?: Json
          p_theme?: string
          p_title?: string
        }
        Returns: {
          is_complete: boolean
          ok: boolean
          reason: string
        }[]
      }
      complete_onboarding: {
        Args: {
          p_answers: Json
          p_display_name: string
          p_email_cadence?: Database["public"]["Enums"]["email_cadence"]
          p_locale?: string
          p_reminder_hours?: number[]
          p_timezone?: string
        }
        Returns: Json
      }
      crisis_queue: {
        Args: { p_before?: string; p_limit?: number }
        Returns: {
          acknowledged_at: string
          acknowledged_by: string
          acknowledged_by_name: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          target_id: string
          target_type: string
        }[]
      }
      delete_my_account: { Args: never; Returns: undefined }
      email_address_for: { Args: { p_user: string }; Returns: string }
      email_apply_sunset: { Args: never; Returns: number }
      email_cadence_hits_today: {
        Args: {
          p_cadence: Database["public"]["Enums"]["email_cadence"]
          p_user: string
        }
        Returns: boolean
      }
      email_channel_allowed: {
        Args: { p_channel: string; p_template: string; p_user_id: string }
        Returns: boolean
      }
      email_habit_payload: { Args: { p_user: string }; Returns: Json }
      email_hmac_secret: { Args: never; Returns: string }
      email_hmac_secret_to_vault: { Args: never; Returns: string }
      email_local_hour: { Args: { p_user: string }; Returns: number }
      email_non_t_taken_today: { Args: { p_user_id: string }; Returns: boolean }
      email_opened_app_today: { Args: { p_user: string }; Returns: boolean }
      email_outbox_claimable: {
        Args: { p_row: Database["public"]["Tables"]["email_outbox"]["Row"] }
        Returns: boolean
      }
      email_prayed_today: { Args: { p_user: string }; Returns: boolean }
      email_prefs_by_token: {
        Args: { p_token: string }
        Returns: {
          cadence: Database["public"]["Enums"]["email_cadence"]
          nudge: boolean
          social: boolean
        }[]
      }
      email_refresh_pause_growth: { Args: never; Returns: boolean }
      enqueue_all_email_jobs: { Args: never; Returns: Json }
      enqueue_digest_emails: { Args: never; Returns: number }
      enqueue_drip_emails: { Args: never; Returns: number }
      enqueue_email: {
        Args: {
          p_channel: string
          p_idempotency_key: string
          p_locale: string
          p_payload: Json
          p_scheduled_for?: string
          p_template: string
          p_to_email: string
          p_user_id: string
        }
        Returns: string
      }
      enqueue_habit_emails: { Args: never; Returns: number }
      enqueue_invite_email: {
        Args: { p_kind: string; p_to_email: string; p_token: string }
        Returns: Json
      }
      enqueue_invite_used: {
        Args: { p_context: string; p_inviter: string; p_redeemer: string }
        Returns: undefined
      }
      enqueue_winback_emails: { Args: never; Returns: number }
      ensure_follow: {
        Args: { p_followee: string; p_follower: string }
        Returns: undefined
      }
      export_my_data: { Args: never; Returns: Json }
      fail_generation_chunk: {
        Args: { p_error: string; p_lease_id: string }
        Returns: {
          ok: boolean
          plan_failed: boolean
          reason: string
          retry: boolean
        }[]
      }
      flag_enabled: { Args: { p_key: string }; Returns: boolean }
      generate_token: { Args: never; Returns: string }
      get_circle_invite_preview: {
        Args: { p_token: string }
        Returns: {
          circle_id: string
          description: string
          member_count: number
          name: string
        }[]
      }
      get_invite_preview: {
        Args: { p_code: string }
        Returns: {
          inviter_name: string
        }[]
      }
      get_my_day: {
        Args: { p_day_number?: number; p_plan_id: string }
        Returns: {
          daily_action: string
          day_number: number
          id: string
          intercession_count: number
          interpretation: string
          prayer_body: string
          scripture_ref: string
          scripture_text: string
          title: string
          unlock_date: string
        }[]
      }
      get_public_plan_day: {
        Args: { p_plan_id: string }
        Returns: {
          day_number: number
          day_title: string
          intercession_count: number
          owner_avatar_url: string
          owner_id: string
          owner_name: string
          plan_id: string
          plan_theme: string
          plan_title: string
          scripture_ref: string
          scripture_text: string
        }[]
      }
      get_shared_plan_day: {
        Args: { p_plan_id: string }
        Returns: {
          already_prayed: boolean
          day_id: string
          day_number: number
          day_title: string
          intercessor_prayer: string
          owner_avatar_url: string
          owner_id: string
          owner_name: string
          plan_id: string
          plan_title: string
          scripture_ref: string
          scripture_text: string
        }[]
      }
      get_shared_plan_preview: {
        Args: { p_token: string }
        Returns: {
          day_id: string
          day_number: number
          day_title: string
          intercession_count: number
          intercessor_prayer: string
          owner_avatar_url: string
          owner_name: string
          plan_id: string
          plan_theme: string
          plan_title: string
          scripture_ref: string
          scripture_text: string
        }[]
      }
      has_blocked: { Args: { p_user_id: string }; Returns: boolean }
      has_plan_share: { Args: { pid: string }; Returns: boolean }
      heartbeat_last_seen: { Args: never; Returns: boolean }
      held_content_queue: {
        Args: { p_before?: string; p_limit?: number; p_statuses?: string[] }
        Returns: {
          author_id: string
          author_name: string
          body: string
          claimed_by: string
          claimed_by_name: string
          created_at: string
          id: string
          reason: string
          status: string
          target_id: string
          target_type: string
        }[]
      }
      held_content_queue_page: {
        Args: {
          p_after?: string
          p_after_id?: string
          p_limit?: number
          p_statuses?: string[]
        }
        Returns: {
          author_id: string
          author_name: string
          body: string
          claimed_by: string
          claimed_by_name: string
          created_at: string
          id: string
          reason: string
          status: string
          target_id: string
          target_type: string
        }[]
      }
      hide_comment: { Args: { p_comment_id: string }; Returns: boolean }
      hide_message: { Args: { p_message_id: string }; Returns: boolean }
      hide_post: { Args: { p_post_id: string }; Returns: boolean }
      hide_reported_content: { Args: { p_report_id: string }; Returns: boolean }
      home_feed: {
        Args: { p_before?: string; p_limit?: number }
        Returns: {
          answered_at: string
          author_avatar_url: string
          author_id: string
          author_name: string
          body: string
          comment_count: number
          created_at: string
          crisis_flagged_at: string
          held_at: string
          i_prayed: boolean
          id: string
          is_anonymous: boolean
          is_mine: boolean
          kind: string
          prayer_count: number
          title: string
        }[]
      }
      home_feed_page: {
        Args: {
          p_before?: string
          p_before_id?: string
          p_before_kind?: string
          p_limit?: number
        }
        Returns: {
          answered_at: string
          author_avatar_url: string
          author_id: string
          author_name: string
          body: string
          comment_count: number
          created_at: string
          crisis_flagged_at: string
          held_at: string
          i_prayed: boolean
          id: string
          is_anonymous: boolean
          is_mine: boolean
          kind: string
          prayer_count: number
          title: string
        }[]
      }
      immutable_unaccent: { Args: { p_text: string }; Returns: string }
      is_conversation_member: { Args: { cid: string }; Returns: boolean }
      is_crisis_text: { Args: { p_text: string }; Returns: boolean }
      is_group_admin: { Args: { gid: string }; Returns: boolean }
      is_group_member: { Args: { gid: string }; Returns: boolean }
      is_objectionable: { Args: { p_text: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      issue_email_prefs_token: { Args: { p_user: string }; Returns: string }
      issue_my_email_prefs_token: { Args: never; Returns: string }
      join_group_with_token: { Args: { token: string }; Returns: string }
      local_today: { Args: { p_user: string }; Returns: string }
      locate_reference: {
        Args: { p_ref: string; p_version?: string }
        Returns: {
          book_id: number
          chapter: number
          verse: number
        }[]
      }
      mark_circle_day: { Args: { p_plan_day_id: string }; Returns: boolean }
      mark_conversation_read: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      mark_email_delivery: {
        Args: {
          p_error?: string
          p_outbox_id: string
          p_resend_id?: string
          p_status: string
        }
        Returns: boolean
      }
      mark_notifications_read: { Args: never; Returns: number }
      mark_push_delivery: {
        Args: {
          p_error?: string
          p_outbox_id: string
          p_receipt_id?: string
          p_status: string
        }
        Returns: boolean
      }
      my_notifications: {
        Args: { p_before?: string; p_limit?: number }
        Returns: {
          created_at: string
          id: string
          payload: Json
          read_at: string
          type: string
        }[]
      }
      my_notifications_page: {
        Args: { p_before?: string; p_before_id?: string; p_limit?: number }
        Returns: {
          created_at: string
          id: string
          payload: Json
          read_at: string
          type: string
        }[]
      }
      my_plan_days: {
        Args: { p_plan_id: string }
        Returns: {
          day_number: number
          id: string
          prayed: boolean
          scripture_ref: string
          title: string
          unlock_date: string
          unlocked: boolean
        }[]
      }
      my_plan_quota: {
        Args: never
        Returns: {
          quota_limit: number
          used: number
        }[]
      }
      my_profile_data: {
        Args: never
        Returns: {
          is_staff: boolean
          streak_count: number
          streak_last_day: string
        }[]
      }
      my_unread_counts: {
        Args: never
        Returns: {
          group_id: string
          unread: number
        }[]
      }
      my_unread_notifications: { Args: never; Returns: number }
      normalize_book_name: { Args: { p_name: string }; Returns: string }
      open_crisis_count: { Args: never; Returns: number }
      open_crisis_queue: {
        Args: { p_after?: string; p_after_id?: string; p_limit?: number }
        Returns: {
          acknowledged_at: string
          acknowledged_by: string
          acknowledged_by_name: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          target_id: string
          target_type: string
        }[]
      }
      open_hold_count: { Args: never; Returns: number }
      open_report_count: { Args: never; Returns: number }
      pending_push_outbox: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          expo_push_token: string
          intercession_id: string
          intercessor_name: string
          outbox_id: string
          owner_id: string
          owner_name: string
        }[]
      }
      person_plans: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          created_at: string
          duration_days: number
          id: string
          is_mine: boolean
          title: string
        }[]
      }
      person_posts: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          answered_at: string
          body: string
          comment_count: number
          created_at: string
          i_prayed: boolean
          id: string
          is_mine: boolean
          prayer_count: number
        }[]
      }
      plan_progress: {
        Args: { p_plan_id: string }
        Returns: {
          days_prayed: number
          days_total: number
          days_unlocked: number
          days_written: number
          finished: boolean
          intercessions_received: number
        }[]
      }
      plan_today: { Args: { p_plan: string }; Returns: string }
      plan_written_days: {
        Args: { p_plan_id: string }
        Returns: {
          day_number: number
          scripture_ref: string
          title: string
        }[]
      }
      plans_shared_with_me: {
        Args: never
        Returns: {
          already_prayed: boolean
          day_id: string
          day_number: number
          day_title: string
          intercessor_prayer: string
          owner_avatar_url: string
          owner_id: string
          owner_name: string
          plan_id: string
          plan_title: string
          scripture_ref: string
          scripture_text: string
        }[]
      }
      post_comments: {
        Args: { p_post_id: string }
        Returns: {
          author_avatar_url: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          crisis_flagged_at: string
          held_at: string
          id: string
          is_mine: boolean
        }[]
      }
      prayer_feed: {
        Args: { p_before?: string; p_group_id?: string; p_limit?: number }
        Returns: {
          answered_at: string
          author_avatar_url: string
          author_id: string
          author_name: string
          body: string
          comment_count: number
          created_at: string
          crisis_flagged_at: string
          held_at: string
          i_prayed: boolean
          id: string
          is_anonymous: boolean
          is_mine: boolean
          prayer_count: number
        }[]
      }
      prayer_feed_page: {
        Args: {
          p_before?: string
          p_before_id?: string
          p_group_id?: string
          p_limit?: number
        }
        Returns: {
          answered_at: string
          author_avatar_url: string
          author_id: string
          author_name: string
          body: string
          comment_count: number
          created_at: string
          crisis_flagged_at: string
          held_at: string
          i_prayed: boolean
          id: string
          is_anonymous: boolean
          is_mine: boolean
          prayer_count: number
        }[]
      }
      public_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          follower_count: number
          following_count: number
          i_follow: boolean
          id: string
          is_me: boolean
          member_since: string
          shares_circle: boolean
          streak: number
        }[]
      }
      purge_expired_rows: { Args: never; Returns: Json }
      push_outbox_claimable: {
        Args: { p_row: Database["public"]["Tables"]["push_outbox"]["Row"] }
        Returns: boolean
      }
      reactivate_email_cadence_by_token: {
        Args: { p_token: string }
        Returns: boolean
      }
      record_email_event: {
        Args: {
          p_event_type: string
          p_payload: Json
          p_resend_id: string
          p_svix_id: string
        }
        Returns: boolean
      }
      redeem_invite_code: { Args: { p_code: string }; Returns: Json }
      redeem_share_token: { Args: { p_token: string }; Returns: Json }
      register_push_device: {
        Args: { p_platform: string; p_token: string }
        Returns: boolean
      }
      release_hold: {
        Args: { p_hold_id: string; p_reason: string }
        Returns: boolean
      }
      remove_hold: {
        Args: { p_hold_id: string; p_reason: string }
        Returns: boolean
      }
      report_queue: {
        Args: {
          p_before?: string
          p_limit?: number
          p_status?: Database["public"]["Enums"]["report_status"]
        }
        Returns: {
          already_hidden: boolean
          author_id: string
          author_name: string
          content: string
          created_at: string
          id: string
          reason: string
          reporter_name: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
        }[]
      }
      report_queue_page: {
        Args: {
          p_before?: string
          p_before_id?: string
          p_limit?: number
          p_status?: Database["public"]["Enums"]["report_status"]
        }
        Returns: {
          already_hidden: boolean
          author_id: string
          author_name: string
          content: string
          created_at: string
          id: string
          reason: string
          reporter_name: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
        }[]
      }
      reserve_generation: {
        Args: {
          p_circle_ids?: string[]
          p_duration_days: number
          p_group_id?: string
          p_request_id: string
          p_scope: string
          p_source_prompt?: Json
          p_visibility?: string
        }
        Returns: {
          created: boolean
          ok: boolean
          plan_id: string
          quota_limit: number
          quota_used: number
          reason: string
          reservation_id: string
        }[]
      }
      resolve_push_notification: {
        Args: { p_outbox_id: string }
        Returns: {
          authorized: boolean
          intercessor_name: string
        }[]
      }
      resolve_report: {
        Args: {
          p_report_id: string
          p_status: Database["public"]["Enums"]["report_status"]
        }
        Returns: boolean
      }
      resolve_scripture: {
        Args: { p_ref: string; p_version?: string }
        Returns: {
          book_id: number
          canonical_ref: string
          chapter: number
          text: string
          verse_end: number
          verse_start: number
        }[]
      }
      revoke_all_my_push_devices: { Args: never; Returns: number }
      revoke_push_device: { Args: { p_token: string }; Returns: boolean }
      rotate_circle_invite_token: {
        Args: { p_group_id: string }
        Returns: string
      }
      rotate_my_invite_code: { Args: never; Returns: string }
      run_email_jobs: { Args: never; Returns: Json }
      run_queue_drains: { Args: never; Returns: Json }
      search_bible: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query: string
          p_version?: string
        }
        Returns: {
          book_id: number
          book_name: string
          chapter: number
          text: string
          total_count: number
          verse: number
        }[]
      }
      search_people: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          avatar_url: string
          display_name: string
          follower_count: number
          i_follow: boolean
          id: string
          total_count: number
        }[]
      }
      search_public_circles: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          description: string
          id: string
          is_member: boolean
          member_count: number
          name: string
          total_count: number
        }[]
      }
      settle_generation_chunk: {
        Args: { p_error?: string; p_lease_id: string; p_outcome: string }
        Returns: boolean
      }
      shares_a_circle_with: { Args: { p_user: string }; Returns: boolean }
      skip_stale_queue_rows: { Args: { p_older_than: string }; Returns: Json }
      unsubscribe_email_one_click: {
        Args: { p_token: string }
        Returns: boolean
      }
      update_email_prefs_by_token: {
        Args: {
          p_cadence?: Database["public"]["Enums"]["email_cadence"]
          p_nudge?: boolean
          p_social?: boolean
          p_token: string
        }
        Returns: boolean
      }
      valid_timezone: { Args: { tz: string }; Returns: string }
      validate_onboarding_answers: {
        Args: { p_answers: Json }
        Returns: undefined
      }
      verify_email_prefs_token: { Args: { p_token: string }; Returns: string }
      verse_of_the_day: {
        Args: { p_version?: string }
        Returns: {
          book_id: number
          book_name: string
          chapter: number
          reference: string
          text: string
          verse: number
        }[]
      }
      verse_of_the_day_for: {
        Args: { p_user: string; p_version?: string }
        Returns: {
          book_id: number
          book_name: string
          chapter: number
          reference: string
          text: string
          verse: number
        }[]
      }
      visible_testimonies: {
        Args: { p_before?: string; p_limit?: number }
        Returns: {
          author_avatar_url: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          is_mine: boolean
          plan_title: string
          visibility: string
        }[]
      }
      visible_testimonies_page: {
        Args: { p_before?: string; p_before_id?: string; p_limit?: number }
        Returns: {
          author_avatar_url: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          is_mine: boolean
          plan_title: string
          visibility: string
        }[]
      }
      who_prayed_for_me: {
        Args: { p_since?: string }
        Returns: {
          created_at: string
          day_number: number
          intercession_id: string
          intercessor_avatar_url: string
          intercessor_id: string
          intercessor_name: string
          message: string
        }[]
      }
    }
    Enums: {
      email_cadence: "daily" | "weekdays" | "weekly" | "off"
      group_role: "owner" | "admin" | "member"
      group_visibility: "private" | "public"
      plan_source: "ai" | "manual"
      plan_status: "generating" | "failed" | "active" | "completed" | "archived"
      plan_visibility: "private" | "group" | "link" | "public"
      report_status: "open" | "reviewed" | "dismissed"
      share_scope: "plan" | "group"
      testimony_visibility: "private" | "circles" | "public"
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
      email_cadence: ["daily", "weekdays", "weekly", "off"],
      group_role: ["owner", "admin", "member"],
      group_visibility: ["private", "public"],
      plan_source: ["ai", "manual"],
      plan_status: ["generating", "failed", "active", "completed", "archived"],
      plan_visibility: ["private", "group", "link", "public"],
      report_status: ["open", "reviewed", "dismissed"],
      share_scope: ["plan", "group"],
      testimony_visibility: ["private", "circles", "public"],
    },
  },
} as const

