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
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          entity_id: string
          entity_table: string
          id: string
          org_id: string | null
          pool_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity_id: string
          entity_table: string
          id?: string
          org_id?: string | null
          pool_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity_id?: string
          entity_table?: string
          id?: string
          org_id?: string | null
          pool_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_bowl_picks: {
        Row: {
          created_at: string | null
          entry_id: string
          id: string
          picked_team_id: string | null
          pool_game_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          id?: string
          picked_team_id?: string | null
          pool_game_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          id?: string
          picked_team_id?: string | null
          pool_game_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_bowl_picks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "bb_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_bowl_picks_picked_team_id_fkey"
            columns: ["picked_team_id"]
            isOneToOne: false
            referencedRelation: "bb_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_bowl_picks_pool_game_id_fkey"
            columns: ["pool_game_id"]
            isOneToOne: false
            referencedRelation: "bb_pool_games"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_cfp_entry_picks: {
        Row: {
          created_at: string | null
          entry_id: string
          id: string
          picked_team_id: string | null
          slot_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          id?: string
          picked_team_id?: string | null
          slot_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          id?: string
          picked_team_id?: string | null
          slot_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_cfp_entry_picks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "bb_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_cfp_entry_picks_picked_team_id_fkey"
            columns: ["picked_team_id"]
            isOneToOne: false
            referencedRelation: "bb_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_cfp_pool_byes: {
        Row: {
          created_at: string | null
          id: string
          pool_id: string
          seed: number
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pool_id: string
          seed: number
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pool_id?: string
          seed?: number
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_cfp_pool_byes_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_cfp_pool_byes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "bb_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_cfp_pool_config: {
        Row: {
          cfp_lock_at: string
          created_at: string | null
          pool_id: string
          template_id: string
        }
        Insert: {
          cfp_lock_at: string
          created_at?: string | null
          pool_id: string
          template_id: string
        }
        Update: {
          cfp_lock_at?: string
          created_at?: string | null
          pool_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_cfp_pool_config_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: true
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_cfp_pool_config_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bb_cfp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_cfp_pool_round1: {
        Row: {
          created_at: string | null
          game_id: string | null
          id: string
          pool_id: string
          slot_key: string
          team_a_id: string | null
          team_b_id: string | null
        }
        Insert: {
          created_at?: string | null
          game_id?: string | null
          id?: string
          pool_id: string
          slot_key: string
          team_a_id?: string | null
          team_b_id?: string | null
        }
        Update: {
          created_at?: string | null
          game_id?: string | null
          id?: string
          pool_id?: string
          slot_key?: string
          team_a_id?: string | null
          team_b_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_cfp_pool_round1_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "bb_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_cfp_pool_round1_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_cfp_pool_round1_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "bb_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_cfp_pool_round1_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "bb_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_cfp_pool_slot_games: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          pool_id: string
          slot_key: string
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          pool_id: string
          slot_key: string
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          pool_id?: string
          slot_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_cfp_pool_slot_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "bb_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_cfp_pool_slot_games_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_cfp_template_slots: {
        Row: {
          created_at: string | null
          depends_on_slot_a: string | null
          depends_on_slot_b: string | null
          display_order: number | null
          id: string
          round: string
          slot_key: string
          template_id: string
        }
        Insert: {
          created_at?: string | null
          depends_on_slot_a?: string | null
          depends_on_slot_b?: string | null
          display_order?: number | null
          id?: string
          round: string
          slot_key: string
          template_id: string
        }
        Update: {
          created_at?: string | null
          depends_on_slot_a?: string | null
          depends_on_slot_b?: string | null
          display_order?: number | null
          id?: string
          round?: string
          slot_key?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_cfp_template_slots_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bb_cfp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_cfp_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      bb_entries: {
        Row: {
          created_at: string | null
          id: string
          pool_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pool_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_entries_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_games: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          external_game_id: string
          external_source: string
          game_name: string | null
          home_score: number | null
          home_spread: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          external_game_id: string
          external_source: string
          game_name?: string | null
          home_score?: number | null
          home_spread?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          external_game_id?: string
          external_source?: string
          game_name?: string | null
          home_score?: number | null
          home_spread?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "bb_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_games_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "bb_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_pool_games: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          kind: string
          label: string | null
          pool_id: string
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          kind: string
          label?: string | null
          pool_id: string
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          kind?: string
          label?: string | null
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_pool_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "bb_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_pool_games_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_teams: {
        Row: {
          abbrev: string | null
          color: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          abbrev?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          abbrev?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      join_links: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          pool_id: string
          token: string
          uses: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          pool_id: string
          token: string
          uses?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          pool_id?: string
          token?: string
          uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "join_links_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          tier: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          tier?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          tier?: string
        }
        Relationships: []
      }
      pool_memberships: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          pool_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          pool_id: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          pool_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_memberships_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          created_at: string | null
          created_by: string | null
          demo_mode: boolean
          id: string
          name: string
          org_id: string
          season_label: string | null
          settings: Json | null
          status: string
          type: string
          visibility: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          demo_mode?: boolean
          id?: string
          name: string
          org_id: string
          season_label?: string | null
          settings?: Json | null
          status?: string
          type: string
          visibility?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          demo_mode?: boolean
          id?: string
          name?: string
          org_id?: string
          season_label?: string | null
          settings?: Json | null
          status?: string
          type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "pools_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          deactivated_at: string | null
          display_name: string | null
          email: string | null
          id: string
          is_super_admin: boolean | null
        }
        Insert: {
          created_at?: string | null
          deactivated_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          is_super_admin?: boolean | null
        }
        Update: {
          created_at?: string | null
          deactivated_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_super_admin?: boolean | null
        }
        Relationships: []
      }
      sq_games: {
        Row: {
          away_score: number | null
          away_team: string
          created_at: string | null
          display_order: number | null
          game_name: string
          game_time: string | null
          halftime_away_score: number | null
          halftime_home_score: number | null
          halftime_payout: number | null
          home_score: number | null
          home_team: string
          id: string
          normal_payout: number | null
          pays_halftime: boolean | null
          q1_away_score: number | null
          q1_home_score: number | null
          q3_away_score: number | null
          q3_home_score: number | null
          reverse_payout: number | null
          round: string
          sq_pool_id: string
          status: string | null
        }
        Insert: {
          away_score?: number | null
          away_team: string
          created_at?: string | null
          display_order?: number | null
          game_name: string
          game_time?: string | null
          halftime_away_score?: number | null
          halftime_home_score?: number | null
          halftime_payout?: number | null
          home_score?: number | null
          home_team: string
          id?: string
          normal_payout?: number | null
          pays_halftime?: boolean | null
          q1_away_score?: number | null
          q1_home_score?: number | null
          q3_away_score?: number | null
          q3_home_score?: number | null
          reverse_payout?: number | null
          round: string
          sq_pool_id: string
          status?: string | null
        }
        Update: {
          away_score?: number | null
          away_team?: string
          created_at?: string | null
          display_order?: number | null
          game_name?: string
          game_time?: string | null
          halftime_away_score?: number | null
          halftime_home_score?: number | null
          halftime_payout?: number | null
          home_score?: number | null
          home_team?: string
          id?: string
          normal_payout?: number | null
          pays_halftime?: boolean | null
          q1_away_score?: number | null
          q1_home_score?: number | null
          q3_away_score?: number | null
          q3_home_score?: number | null
          reverse_payout?: number | null
          round?: string
          sq_pool_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sq_games_sq_pool_id_fkey"
            columns: ["sq_pool_id"]
            isOneToOne: false
            referencedRelation: "sq_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      sq_pools: {
        Row: {
          col_numbers: number[] | null
          created_at: string | null
          final_bonus_payout: number | null
          final_payout: number | null
          halftime_payout: number | null
          id: string
          max_squares_per_player: number | null
          mode: string | null
          numbers_locked: boolean | null
          per_change_payout: number | null
          pool_id: string
          q1_payout: number | null
          q3_payout: number | null
          reverse_scoring: boolean | null
          row_numbers: number[] | null
          scoring_mode: string | null
        }
        Insert: {
          col_numbers?: number[] | null
          created_at?: string | null
          final_bonus_payout?: number | null
          final_payout?: number | null
          halftime_payout?: number | null
          id?: string
          max_squares_per_player?: number | null
          mode?: string | null
          numbers_locked?: boolean | null
          per_change_payout?: number | null
          pool_id: string
          q1_payout?: number | null
          q3_payout?: number | null
          reverse_scoring?: boolean | null
          row_numbers?: number[] | null
          scoring_mode?: string | null
        }
        Update: {
          col_numbers?: number[] | null
          created_at?: string | null
          final_bonus_payout?: number | null
          final_payout?: number | null
          halftime_payout?: number | null
          id?: string
          max_squares_per_player?: number | null
          mode?: string | null
          numbers_locked?: boolean | null
          per_change_payout?: number | null
          pool_id?: string
          q1_payout?: number | null
          q3_payout?: number | null
          reverse_scoring?: boolean | null
          row_numbers?: number[] | null
          scoring_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sq_pools_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: true
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      sq_score_changes: {
        Row: {
          away_score: number
          change_order: number
          created_at: string | null
          home_score: number
          id: string
          sq_game_id: string | null
        }
        Insert: {
          away_score: number
          change_order: number
          created_at?: string | null
          home_score: number
          id?: string
          sq_game_id?: string | null
        }
        Update: {
          away_score?: number
          change_order?: number
          created_at?: string | null
          home_score?: number
          id?: string
          sq_game_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sq_score_changes_sq_game_id_fkey"
            columns: ["sq_game_id"]
            isOneToOne: false
            referencedRelation: "sq_games"
            referencedColumns: ["id"]
          },
        ]
      }
      sq_squares: {
        Row: {
          claimed_at: string | null
          col_index: number
          id: string
          row_index: number
          sq_pool_id: string
          user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          col_index: number
          id?: string
          row_index: number
          sq_pool_id: string
          user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          col_index?: number
          id?: string
          row_index?: number
          sq_pool_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sq_squares_sq_pool_id_fkey"
            columns: ["sq_pool_id"]
            isOneToOne: false
            referencedRelation: "sq_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      sq_winners: {
        Row: {
          created_at: string | null
          id: string
          payout: number | null
          sq_game_id: string
          square_id: string | null
          win_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payout?: number | null
          sq_game_id: string
          square_id?: string | null
          win_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payout?: number | null
          sq_game_id?: string
          square_id?: string | null
          win_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sq_winners_sq_game_id_fkey"
            columns: ["sq_game_id"]
            isOneToOne: false
            referencedRelation: "sq_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sq_winners_square_id_fkey"
            columns: ["square_id"]
            isOneToOne: false
            referencedRelation: "sq_squares"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_pick_score: {
        Args: {
          p_away_score: number
          p_away_team_id: string
          p_home_score: number
          p_home_team_id: string
          p_picked_team_id: string
          p_status: string
        }
        Returns: number
      }
      get_game_winner: { Args: { p_game_id: string }; Returns: string }
      is_bowl_pick_locked: {
        Args: { p_pool_game_id: string }
        Returns: boolean
      }
      is_cfp_locked: { Args: { p_pool_id: string }; Returns: boolean }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_commissioner: { Args: { p_org_id: string }; Returns: boolean }
      is_pool_commissioner: { Args: { p_pool_id: string }; Returns: boolean }
      is_pool_member: { Args: { p_pool_id: string }; Returns: boolean }
      is_pool_member_any_status: {
        Args: { p_pool_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      pool_lock_time_for_bowl: {
        Args: { p_pool_game_id: string }
        Returns: string
      }
      request_join_pool: { Args: { p_token: string }; Returns: Json }
      user_org_ids: { Args: never; Returns: string[] }
      validate_join_link: { Args: { p_token: string }; Returns: Json }
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
    Enums: {},
  },
} as const
