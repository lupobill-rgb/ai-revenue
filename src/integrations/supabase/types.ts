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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent: string
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input: Json | null
          mode: string | null
          output: Json | null
          status: string | null
          tenant_id: string
          workspace_id: string
        }
        Insert: {
          agent: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json | null
          mode?: string | null
          output?: Json | null
          status?: string | null
          tenant_id: string
          workspace_id: string
        }
        Update: {
          agent?: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json | null
          mode?: string | null
          output?: Json | null
          status?: string | null
          tenant_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings_calendar: {
        Row: {
          booking_url: string
          calendar_provider: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          booking_url?: string
          calendar_provider?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          booking_url?: string
          calendar_provider?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_settings_crm_webhooks: {
        Row: {
          inbound_webhook_url: string | null
          outbound_webhook_url: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          inbound_webhook_url?: string | null
          outbound_webhook_url?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          inbound_webhook_url?: string | null
          outbound_webhook_url?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_settings_domain: {
        Row: {
          cname_verified: boolean | null
          domain: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cname_verified?: boolean | null
          domain?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cname_verified?: boolean | null
          domain?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_settings_email: {
        Row: {
          from_address: string
          reply_to_address: string
          sender_name: string
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_username: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          from_address?: string
          reply_to_address?: string
          sender_name?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          from_address?: string
          reply_to_address?: string
          sender_name?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_settings_linkedin: {
        Row: {
          daily_connection_limit: number
          daily_message_limit: number
          linkedin_profile_url: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          daily_connection_limit?: number
          daily_message_limit?: number
          linkedin_profile_url?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          daily_connection_limit?: number
          daily_message_limit?: number
          linkedin_profile_url?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_settings_voice: {
        Row: {
          default_elevenlabs_voice_id: string | null
          default_vapi_assistant_id: string | null
          elevenlabs_api_key: string | null
          elevenlabs_model: string | null
          tenant_id: string
          updated_at: string | null
          vapi_private_key: string | null
          vapi_public_key: string | null
        }
        Insert: {
          default_elevenlabs_voice_id?: string | null
          default_vapi_assistant_id?: string | null
          elevenlabs_api_key?: string | null
          elevenlabs_model?: string | null
          tenant_id: string
          updated_at?: string | null
          vapi_private_key?: string | null
          vapi_public_key?: string | null
        }
        Update: {
          default_elevenlabs_voice_id?: string | null
          default_vapi_assistant_id?: string | null
          elevenlabs_api_key?: string | null
          elevenlabs_model?: string | null
          tenant_id?: string
          updated_at?: string | null
          vapi_private_key?: string | null
          vapi_public_key?: string | null
        }
        Relationships: []
      }
      asset_approvals: {
        Row: {
          approved_by: string | null
          asset_id: string
          comments: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["asset_status"]
        }
        Insert: {
          approved_by?: string | null
          asset_id: string
          comments?: string | null
          created_at?: string
          id?: string
          status: Database["public"]["Enums"]["asset_status"]
        }
        Update: {
          approved_by?: string | null
          asset_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["asset_status"]
        }
        Relationships: [
          {
            foreignKeyName: "asset_approvals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          channel: string | null
          content: Json | null
          created_at: string
          created_by: string | null
          custom_domain: string | null
          deployment_status: string | null
          description: string | null
          external_id: string | null
          external_project_url: string | null
          fal_id: string | null
          goal: string | null
          id: string
          name: string
          preview_url: string | null
          segment_id: string | null
          status: Database["public"]["Enums"]["asset_status"]
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          vapi_id: string | null
          views: number
          workspace_id: string | null
        }
        Insert: {
          channel?: string | null
          content?: Json | null
          created_at?: string
          created_by?: string | null
          custom_domain?: string | null
          deployment_status?: string | null
          description?: string | null
          external_id?: string | null
          external_project_url?: string | null
          fal_id?: string | null
          goal?: string | null
          id?: string
          name: string
          preview_url?: string | null
          segment_id?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          type: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          vapi_id?: string | null
          views?: number
          workspace_id?: string | null
        }
        Update: {
          channel?: string | null
          content?: Json | null
          created_at?: string
          created_by?: string | null
          custom_domain?: string | null
          deployment_status?: string | null
          description?: string | null
          external_id?: string | null
          external_project_url?: string | null
          fal_id?: string | null
          goal?: string | null
          id?: string
          name?: string
          preview_url?: string | null
          segment_id?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          vapi_id?: string | null
          views?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          result?: Json | null
          scheduled_at: string
          started_at?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_steps: {
        Row: {
          automation_id: string
          config: Json
          created_at: string
          id: string
          step_order: number
          step_type: string
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          automation_id: string
          config?: Json
          created_at?: string
          id?: string
          step_order?: number
          step_type: string
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          automation_id?: string
          config?: Json
          created_at?: string
          id?: string
          step_order?: number
          step_type?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          brand_colors: Json | null
          brand_fonts: Json | null
          brand_tone: string | null
          brand_voice: string | null
          business_description: string | null
          business_name: string | null
          competitive_advantages: string | null
          content_length: string | null
          content_tone: string | null
          created_at: string
          cta_patterns: string[] | null
          id: string
          imagery_style: string | null
          industry: string | null
          logo_url: string | null
          messaging_pillars: string[] | null
          preferred_channels: string[] | null
          target_audiences: Json | null
          unique_selling_points: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_colors?: Json | null
          brand_fonts?: Json | null
          brand_tone?: string | null
          brand_voice?: string | null
          business_description?: string | null
          business_name?: string | null
          competitive_advantages?: string | null
          content_length?: string | null
          content_tone?: string | null
          created_at?: string
          cta_patterns?: string[] | null
          id?: string
          imagery_style?: string | null
          industry?: string | null
          logo_url?: string | null
          messaging_pillars?: string[] | null
          preferred_channels?: string[] | null
          target_audiences?: Json | null
          unique_selling_points?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_colors?: Json | null
          brand_fonts?: Json | null
          brand_tone?: string | null
          brand_voice?: string | null
          business_description?: string | null
          business_name?: string | null
          competitive_advantages?: string | null
          content_length?: string | null
          content_tone?: string | null
          created_at?: string
          cta_patterns?: string[] | null
          id?: string
          imagery_style?: string | null
          industry?: string | null
          logo_url?: string | null
          messaging_pillars?: string[] | null
          preferred_channels?: string[] | null
          target_audiences?: Json | null
          unique_selling_points?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_metrics: {
        Row: {
          bounce_count: number | null
          campaign_id: string
          clicks: number | null
          comments: number | null
          conversions: number | null
          cost: number | null
          created_at: string
          delivered_count: number | null
          engagement_rate: number | null
          id: string
          impressions: number | null
          last_synced_at: string | null
          likes: number | null
          open_count: number | null
          revenue: number | null
          sent_count: number | null
          shares: number | null
          unsubscribe_count: number | null
          updated_at: string
          video_views: number | null
          workspace_id: string
        }
        Insert: {
          bounce_count?: number | null
          campaign_id: string
          clicks?: number | null
          comments?: number | null
          conversions?: number | null
          cost?: number | null
          created_at?: string
          delivered_count?: number | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          last_synced_at?: string | null
          likes?: number | null
          open_count?: number | null
          revenue?: number | null
          sent_count?: number | null
          shares?: number | null
          unsubscribe_count?: number | null
          updated_at?: string
          video_views?: number | null
          workspace_id: string
        }
        Update: {
          bounce_count?: number | null
          campaign_id?: string
          clicks?: number | null
          comments?: number | null
          conversions?: number | null
          cost?: number | null
          created_at?: string
          delivered_count?: number | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          last_synced_at?: string | null
          likes?: number | null
          open_count?: number | null
          revenue?: number | null
          sent_count?: number | null
          shares?: number | null
          unsubscribe_count?: number | null
          updated_at?: string
          video_views?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_optimizations: {
        Row: {
          applied_at: string | null
          campaign_id: string
          changes: Json
          created_at: string
          id: string
          metrics_snapshot: Json | null
          optimization_type: string
          summary: string | null
          tenant_id: string
          workspace_id: string
        }
        Insert: {
          applied_at?: string | null
          campaign_id: string
          changes?: Json
          created_at?: string
          id?: string
          metrics_snapshot?: Json | null
          optimization_type: string
          summary?: string | null
          tenant_id: string
          workspace_id: string
        }
        Update: {
          applied_at?: string | null
          campaign_id?: string
          changes?: Json
          created_at?: string
          id?: string
          metrics_snapshot?: Json | null
          optimization_type?: string
          summary?: string | null
          tenant_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_optimizations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          asset_id: string
          budget_allocated: number | null
          channel: string
          created_at: string
          deployed_at: string | null
          external_campaign_id: string | null
          id: string
          status: string
          target_audience: Json | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id: string
          budget_allocated?: number | null
          channel: string
          created_at?: string
          deployed_at?: string | null
          external_campaign_id?: string | null
          id?: string
          status?: string
          target_audience?: Json | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string
          budget_allocated?: number | null
          channel?: string
          created_at?: string
          deployed_at?: string | null
          external_campaign_id?: string | null
          id?: string
          status?: string
          target_audience?: Json | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          landing_pages_enabled: boolean
          social_enabled: boolean
          updated_at: string
          user_id: string
          video_enabled: boolean
          voice_enabled: boolean
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          landing_pages_enabled?: boolean
          social_enabled?: boolean
          updated_at?: string
          user_id: string
          video_enabled?: boolean
          voice_enabled?: boolean
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          landing_pages_enabled?: boolean
          social_enabled?: boolean
          updated_at?: string
          user_id?: string
          video_enabled?: boolean
          voice_enabled?: boolean
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_brand_profiles: {
        Row: {
          brand_colors: Json | null
          brand_fonts: Json | null
          brand_name: string
          brand_personality: Json | null
          brand_tone: string | null
          brand_voice: string | null
          competitors: Json | null
          content_themes: Json | null
          core_values: Json | null
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          key_differentiators: Json | null
          logo_url: string | null
          messaging_pillars: Json | null
          mission_statement: string | null
          tagline: string | null
          tenant_id: string
          unique_value_proposition: string | null
          updated_at: string
          website_url: string | null
          workspace_id: string
        }
        Insert: {
          brand_colors?: Json | null
          brand_fonts?: Json | null
          brand_name: string
          brand_personality?: Json | null
          brand_tone?: string | null
          brand_voice?: string | null
          competitors?: Json | null
          content_themes?: Json | null
          core_values?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          key_differentiators?: Json | null
          logo_url?: string | null
          messaging_pillars?: Json | null
          mission_statement?: string | null
          tagline?: string | null
          tenant_id: string
          unique_value_proposition?: string | null
          updated_at?: string
          website_url?: string | null
          workspace_id: string
        }
        Update: {
          brand_colors?: Json | null
          brand_fonts?: Json | null
          brand_name?: string
          brand_personality?: Json | null
          brand_tone?: string | null
          brand_voice?: string | null
          competitors?: Json | null
          content_themes?: Json | null
          core_values?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          key_differentiators?: Json | null
          logo_url?: string | null
          messaging_pillars?: Json | null
          mission_statement?: string | null
          tagline?: string | null
          tenant_id?: string
          unique_value_proposition?: string | null
          updated_at?: string
          website_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_brand_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_calendar_events: {
        Row: {
          asset_id: string | null
          campaign_id: string | null
          channel: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          scheduled_at: string
          status: string | null
          tenant_id: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id?: string | null
          campaign_id?: string | null
          channel?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          scheduled_at: string
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string | null
          campaign_id?: string | null
          channel?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          scheduled_at?: string
          status?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_calendar_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "cmo_content_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmo_calendar_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmo_calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_campaign_channels: {
        Row: {
          budget_percentage: number | null
          campaign_id: string
          channel_name: string
          channel_type: string | null
          content_types: Json | null
          created_at: string
          expected_metrics: Json | null
          id: string
          posting_frequency: string | null
          priority: string | null
          targeting_notes: string | null
          updated_at: string
        }
        Insert: {
          budget_percentage?: number | null
          campaign_id: string
          channel_name: string
          channel_type?: string | null
          content_types?: Json | null
          created_at?: string
          expected_metrics?: Json | null
          id?: string
          posting_frequency?: string | null
          priority?: string | null
          targeting_notes?: string | null
          updated_at?: string
        }
        Update: {
          budget_percentage?: number | null
          campaign_id?: string
          channel_name?: string
          channel_type?: string | null
          content_types?: Json | null
          created_at?: string
          expected_metrics?: Json | null
          id?: string
          posting_frequency?: string | null
          priority?: string | null
          targeting_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_campaign_channels_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_campaigns: {
        Row: {
          autopilot_enabled: boolean
          budget_allocation: number | null
          campaign_name: string
          campaign_type: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          funnel_id: string | null
          funnel_stage: string | null
          goal: string | null
          id: string
          last_optimization_at: string | null
          last_optimization_note: string | null
          objective: string | null
          plan_id: string | null
          primary_kpi: Json | null
          secondary_kpis: Json | null
          start_date: string | null
          status: string | null
          success_criteria: string | null
          target_icp: string | null
          target_offer: string | null
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          autopilot_enabled?: boolean
          budget_allocation?: number | null
          campaign_name: string
          campaign_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          funnel_id?: string | null
          funnel_stage?: string | null
          goal?: string | null
          id?: string
          last_optimization_at?: string | null
          last_optimization_note?: string | null
          objective?: string | null
          plan_id?: string | null
          primary_kpi?: Json | null
          secondary_kpis?: Json | null
          start_date?: string | null
          status?: string | null
          success_criteria?: string | null
          target_icp?: string | null
          target_offer?: string | null
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          autopilot_enabled?: boolean
          budget_allocation?: number | null
          campaign_name?: string
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          funnel_id?: string | null
          funnel_stage?: string | null
          goal?: string | null
          id?: string
          last_optimization_at?: string | null
          last_optimization_note?: string | null
          objective?: string | null
          plan_id?: string | null
          primary_kpi?: Json | null
          secondary_kpis?: Json | null
          start_date?: string | null
          status?: string | null
          success_criteria?: string | null
          target_icp?: string | null
          target_offer?: string | null
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_campaigns_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "cmo_funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmo_campaigns_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "cmo_marketing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmo_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_content_assets: {
        Row: {
          campaign_id: string | null
          channel: string | null
          content_id: string | null
          content_type: string
          created_at: string
          created_by: string | null
          cta: string | null
          dependencies: Json | null
          estimated_production_time: string | null
          funnel_stage: string | null
          id: string
          key_message: string | null
          publish_date: string | null
          status: string | null
          supporting_points: Json | null
          target_icp: string | null
          tenant_id: string
          title: string
          tone: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          channel?: string | null
          content_id?: string | null
          content_type: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          dependencies?: Json | null
          estimated_production_time?: string | null
          funnel_stage?: string | null
          id?: string
          key_message?: string | null
          publish_date?: string | null
          status?: string | null
          supporting_points?: Json | null
          target_icp?: string | null
          tenant_id: string
          title: string
          tone?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          channel?: string | null
          content_id?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          dependencies?: Json | null
          estimated_production_time?: string | null
          funnel_stage?: string | null
          id?: string
          key_message?: string | null
          publish_date?: string | null
          status?: string | null
          supporting_points?: Json | null
          target_icp?: string | null
          tenant_id?: string
          title?: string
          tone?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_content_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmo_content_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_content_variants: {
        Row: {
          asset_id: string
          body_content: string | null
          created_at: string
          cta_text: string | null
          headline: string | null
          id: string
          is_winner: boolean | null
          metadata: Json | null
          performance_metrics: Json | null
          subject_line: string | null
          updated_at: string
          variant_name: string
          variant_type: string | null
          visual_description: string | null
        }
        Insert: {
          asset_id: string
          body_content?: string | null
          created_at?: string
          cta_text?: string | null
          headline?: string | null
          id?: string
          is_winner?: boolean | null
          metadata?: Json | null
          performance_metrics?: Json | null
          subject_line?: string | null
          updated_at?: string
          variant_name: string
          variant_type?: string | null
          visual_description?: string | null
        }
        Update: {
          asset_id?: string
          body_content?: string | null
          created_at?: string
          cta_text?: string | null
          headline?: string | null
          id?: string
          is_winner?: boolean | null
          metadata?: Json | null
          performance_metrics?: Json | null
          subject_line?: string | null
          updated_at?: string
          variant_name?: string
          variant_type?: string | null
          visual_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cmo_content_variants_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "cmo_content_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_funnel_stages: {
        Row: {
          budget_allocation: number | null
          campaign_types: Json | null
          channels: Json | null
          content_assets: Json | null
          conversion_rate_target: number | null
          created_at: string
          description: string | null
          entry_criteria: string | null
          exit_criteria: string | null
          expected_volume: number | null
          funnel_id: string
          id: string
          kpis: Json | null
          linked_offers: Json | null
          objective: string | null
          stage_name: string
          stage_order: number
          stage_type: string
          target_icps: Json | null
          updated_at: string
        }
        Insert: {
          budget_allocation?: number | null
          campaign_types?: Json | null
          channels?: Json | null
          content_assets?: Json | null
          conversion_rate_target?: number | null
          created_at?: string
          description?: string | null
          entry_criteria?: string | null
          exit_criteria?: string | null
          expected_volume?: number | null
          funnel_id: string
          id?: string
          kpis?: Json | null
          linked_offers?: Json | null
          objective?: string | null
          stage_name: string
          stage_order?: number
          stage_type: string
          target_icps?: Json | null
          updated_at?: string
        }
        Update: {
          budget_allocation?: number | null
          campaign_types?: Json | null
          channels?: Json | null
          content_assets?: Json | null
          conversion_rate_target?: number | null
          created_at?: string
          description?: string | null
          entry_criteria?: string | null
          exit_criteria?: string | null
          expected_volume?: number | null
          funnel_id?: string
          id?: string
          kpis?: Json | null
          linked_offers?: Json | null
          objective?: string | null
          stage_name?: string
          stage_order?: number
          stage_type?: string
          target_icps?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "cmo_funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_funnels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expected_conversion_rate: number | null
          expected_revenue: number | null
          funnel_name: string
          funnel_type: string
          id: string
          plan_id: string | null
          status: string
          target_icp_segments: Json | null
          target_offers: Json | null
          tenant_id: string
          total_budget: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_conversion_rate?: number | null
          expected_revenue?: number | null
          funnel_name: string
          funnel_type?: string
          id?: string
          plan_id?: string | null
          status?: string
          target_icp_segments?: Json | null
          target_offers?: Json | null
          tenant_id: string
          total_budget?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_conversion_rate?: number | null
          expected_revenue?: number | null
          funnel_name?: string
          funnel_type?: string
          id?: string
          plan_id?: string | null
          status?: string
          target_icp_segments?: Json | null
          target_offers?: Json | null
          tenant_id?: string
          total_budget?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_funnels_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "cmo_marketing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmo_funnels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_icp_segments: {
        Row: {
          budget_range: Json | null
          buying_triggers: Json | null
          company_size: string | null
          content_preferences: Json | null
          created_at: string
          created_by: string | null
          decision_criteria: Json | null
          demographics: Json | null
          goals: Json | null
          id: string
          industry_verticals: Json | null
          is_primary: boolean | null
          job_titles: Json | null
          objections: Json | null
          pain_points: Json | null
          preferred_channels: Json | null
          priority_score: number | null
          psychographics: Json | null
          segment_description: string | null
          segment_name: string
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          budget_range?: Json | null
          buying_triggers?: Json | null
          company_size?: string | null
          content_preferences?: Json | null
          created_at?: string
          created_by?: string | null
          decision_criteria?: Json | null
          demographics?: Json | null
          goals?: Json | null
          id?: string
          industry_verticals?: Json | null
          is_primary?: boolean | null
          job_titles?: Json | null
          objections?: Json | null
          pain_points?: Json | null
          preferred_channels?: Json | null
          priority_score?: number | null
          psychographics?: Json | null
          segment_description?: string | null
          segment_name: string
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          budget_range?: Json | null
          buying_triggers?: Json | null
          company_size?: string | null
          content_preferences?: Json | null
          created_at?: string
          created_by?: string | null
          decision_criteria?: Json | null
          demographics?: Json | null
          goals?: Json | null
          id?: string
          industry_verticals?: Json | null
          is_primary?: boolean | null
          job_titles?: Json | null
          objections?: Json | null
          pain_points?: Json | null
          preferred_channels?: Json | null
          priority_score?: number | null
          psychographics?: Json | null
          segment_description?: string | null
          segment_name?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_icp_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_marketing_plans: {
        Row: {
          budget_allocation: Json | null
          campaign_themes: Json | null
          channel_mix: Json | null
          content_calendar_outline: Json | null
          created_at: string
          created_by: string | null
          dependencies: Json | null
          end_date: string | null
          executive_summary: string | null
          generation_context: Json | null
          id: string
          key_metrics: Json | null
          month_1_plan: Json | null
          month_2_plan: Json | null
          month_3_plan: Json | null
          plan_name: string
          plan_type: string
          primary_objectives: Json | null
          resource_requirements: Json | null
          risks_mitigations: Json | null
          start_date: string | null
          status: string
          target_icp_segments: Json | null
          target_offers: Json | null
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          budget_allocation?: Json | null
          campaign_themes?: Json | null
          channel_mix?: Json | null
          content_calendar_outline?: Json | null
          created_at?: string
          created_by?: string | null
          dependencies?: Json | null
          end_date?: string | null
          executive_summary?: string | null
          generation_context?: Json | null
          id?: string
          key_metrics?: Json | null
          month_1_plan?: Json | null
          month_2_plan?: Json | null
          month_3_plan?: Json | null
          plan_name: string
          plan_type?: string
          primary_objectives?: Json | null
          resource_requirements?: Json | null
          risks_mitigations?: Json | null
          start_date?: string | null
          status?: string
          target_icp_segments?: Json | null
          target_offers?: Json | null
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          budget_allocation?: Json | null
          campaign_themes?: Json | null
          channel_mix?: Json | null
          content_calendar_outline?: Json | null
          created_at?: string
          created_by?: string | null
          dependencies?: Json | null
          end_date?: string | null
          executive_summary?: string | null
          generation_context?: Json | null
          id?: string
          key_metrics?: Json | null
          month_1_plan?: Json | null
          month_2_plan?: Json | null
          month_3_plan?: Json | null
          plan_name?: string
          plan_type?: string
          primary_objectives?: Json | null
          resource_requirements?: Json | null
          risks_mitigations?: Json | null
          start_date?: string | null
          status?: string
          target_icp_segments?: Json | null
          target_offers?: Json | null
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_marketing_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_metrics_snapshots: {
        Row: {
          campaign_id: string | null
          channel_id: string | null
          clicks: number | null
          conversion_rate: number | null
          conversions: number | null
          cost: number | null
          created_at: string
          custom_metrics: Json | null
          engagement_rate: number | null
          id: string
          impressions: number | null
          metric_type: string
          revenue: number | null
          roi: number | null
          snapshot_date: string
          tenant_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          channel_id?: string | null
          clicks?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          cost?: number | null
          created_at?: string
          custom_metrics?: Json | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          metric_type: string
          revenue?: number | null
          roi?: number | null
          snapshot_date: string
          tenant_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          channel_id?: string | null
          clicks?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          cost?: number | null
          created_at?: string
          custom_metrics?: Json | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          metric_type?: string
          revenue?: number | null
          roi?: number | null
          snapshot_date?: string
          tenant_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_metrics_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmo_metrics_snapshots_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaign_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmo_metrics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_offers: {
        Row: {
          case_studies: Json | null
          competitive_positioning: string | null
          created_at: string
          created_by: string | null
          demo_url: string | null
          description: string | null
          features: Json | null
          id: string
          is_flagship: boolean | null
          key_benefits: Json | null
          landing_page_url: string | null
          launch_date: string | null
          offer_name: string
          offer_type: string
          price_range: Json | null
          pricing_model: string | null
          status: string | null
          success_metrics: Json | null
          target_segments: Json | null
          tenant_id: string
          testimonials: Json | null
          updated_at: string
          use_cases: Json | null
          workspace_id: string
        }
        Insert: {
          case_studies?: Json | null
          competitive_positioning?: string | null
          created_at?: string
          created_by?: string | null
          demo_url?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_flagship?: boolean | null
          key_benefits?: Json | null
          landing_page_url?: string | null
          launch_date?: string | null
          offer_name: string
          offer_type: string
          price_range?: Json | null
          pricing_model?: string | null
          status?: string | null
          success_metrics?: Json | null
          target_segments?: Json | null
          tenant_id: string
          testimonials?: Json | null
          updated_at?: string
          use_cases?: Json | null
          workspace_id: string
        }
        Update: {
          case_studies?: Json | null
          competitive_positioning?: string | null
          created_at?: string
          created_by?: string | null
          demo_url?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_flagship?: boolean | null
          key_benefits?: Json | null
          landing_page_url?: string | null
          launch_date?: string | null
          offer_name?: string
          offer_type?: string
          price_range?: Json | null
          pricing_model?: string | null
          status?: string | null
          success_metrics?: Json | null
          target_segments?: Json | null
          tenant_id?: string
          testimonials?: Json | null
          updated_at?: string
          use_cases?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_recommendations: {
        Row: {
          action_items: Json | null
          campaign_id: string | null
          created_at: string
          description: string | null
          effort_level: string | null
          expected_impact: string | null
          id: string
          implemented_at: string | null
          priority: string | null
          rationale: string | null
          recommendation_type: string
          status: string | null
          tenant_id: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_items?: Json | null
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          effort_level?: string | null
          expected_impact?: string | null
          id?: string
          implemented_at?: string | null
          priority?: string | null
          rationale?: string | null
          recommendation_type: string
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_items?: Json | null
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          effort_level?: string | null
          expected_impact?: string | null
          id?: string
          implemented_at?: string | null
          priority?: string | null
          rationale?: string | null
          recommendation_type?: string
          status?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_recommendations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmo_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cmo_weekly_summaries: {
        Row: {
          challenges: Json | null
          created_at: string
          executive_summary: string | null
          id: string
          key_wins: Json | null
          metrics_summary: Json | null
          next_week_priorities: Json | null
          recommendations: Json | null
          tenant_id: string
          top_performing_content: Json | null
          updated_at: string
          week_end: string
          week_start: string
          workspace_id: string
        }
        Insert: {
          challenges?: Json | null
          created_at?: string
          executive_summary?: string | null
          id?: string
          key_wins?: Json | null
          metrics_summary?: Json | null
          next_week_priorities?: Json | null
          recommendations?: Json | null
          tenant_id: string
          top_performing_content?: Json | null
          updated_at?: string
          week_end: string
          week_start: string
          workspace_id: string
        }
        Update: {
          challenges?: Json | null
          created_at?: string
          executive_summary?: string | null
          id?: string
          key_wins?: Json | null
          metrics_summary?: Json | null
          next_week_priorities?: Json | null
          recommendations?: Json | null
          tenant_id?: string
          top_performing_content?: Json | null
          updated_at?: string
          week_end?: string
          week_start?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmo_weekly_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_calendar: {
        Row: {
          asset_id: string | null
          campaign_id: string | null
          channel: string | null
          content: Json | null
          content_type: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id?: string | null
          campaign_id?: string | null
          channel?: string | null
          content?: Json | null
          content_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string | null
          campaign_id?: string | null
          channel?: string | null
          content?: Json | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_calendar_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_calendar_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_calendar_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_templates: {
        Row: {
          content: string
          conversion_rate: number | null
          created_at: string
          id: string
          impressions: number | null
          last_optimized_at: string | null
          optimization_notes: string | null
          optimization_version: number | null
          subject_line: string | null
          target_audience: string | null
          template_name: string
          template_type: string
          tone: string | null
          updated_at: string
          vertical: string
          workspace_id: string
        }
        Insert: {
          content: string
          conversion_rate?: number | null
          created_at?: string
          id?: string
          impressions?: number | null
          last_optimized_at?: string | null
          optimization_notes?: string | null
          optimization_version?: number | null
          subject_line?: string | null
          target_audience?: string | null
          template_name: string
          template_type: string
          tone?: string | null
          updated_at?: string
          vertical: string
          workspace_id: string
        }
        Update: {
          content?: string
          conversion_rate?: number | null
          created_at?: string
          id?: string
          impressions?: number | null
          last_optimized_at?: string | null
          optimization_notes?: string | null
          optimization_version?: number | null
          subject_line?: string | null
          target_audience?: string | null
          template_name?: string
          template_type?: string
          tone?: string | null
          updated_at?: string
          vertical?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_deal_reviews: {
        Row: {
          created_at: string | null
          deal_id: string | null
          id: string
          next_steps: string | null
          risks: string | null
          score: number | null
          summary_md: string | null
          tenant_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          deal_id?: string | null
          id?: string
          next_steps?: string | null
          risks?: string | null
          score?: number | null
          summary_md?: string | null
          tenant_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          deal_id?: string | null
          id?: string
          next_steps?: string | null
          risks?: string | null
          score?: number | null
          summary_md?: string | null
          tenant_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_deal_reviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_deal_reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_forecasts: {
        Row: {
          confidence: number | null
          created_at: string | null
          forecast_new_arr: number | null
          id: string
          notes: string | null
          period: string
          scenario: string
          tenant_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          forecast_new_arr?: number | null
          id?: string
          notes?: string | null
          period: string
          scenario: string
          tenant_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          forecast_new_arr?: number | null
          id?: string
          notes?: string | null
          period?: string
          scenario?: string
          tenant_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_forecasts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_recommendations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          severity: string | null
          source_id: string | null
          source_type: string | null
          status: string | null
          suggested_actions: string | null
          tenant_id: string
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          severity?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          suggested_actions?: string | null
          tenant_id: string
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          severity?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          suggested_actions?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_targets: {
        Row: {
          created_at: string | null
          id: string
          owner_id: string
          owner_type: string
          period: string
          target_new_arr: number | null
          target_pipeline: number | null
          tenant_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          owner_id: string
          owner_type: string
          period: string
          target_new_arr?: number | null
          target_pipeline?: number | null
          tenant_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          owner_id?: string
          owner_type?: string
          period?: string
          target_new_arr?: number | null
          target_pipeline?: number | null
          tenant_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_targets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_integrations: {
        Row: {
          calendar_booking_url: string | null
          calendar_provider: string | null
          created_at: string
          crm_inbound_webhook_url: string | null
          crm_outbound_webhook_url: string | null
          crm_webhook_secret: string | null
          custom_domain: string | null
          custom_domain_verified: boolean | null
          email_domain_verified: boolean | null
          email_from_address: string | null
          email_from_name: string | null
          email_reply_to: string | null
          id: string
          linkedin_daily_connect_limit: number | null
          linkedin_daily_message_limit: number | null
          linkedin_profile_url: string | null
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          calendar_booking_url?: string | null
          calendar_provider?: string | null
          created_at?: string
          crm_inbound_webhook_url?: string | null
          crm_outbound_webhook_url?: string | null
          crm_webhook_secret?: string | null
          custom_domain?: string | null
          custom_domain_verified?: boolean | null
          email_domain_verified?: boolean | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_reply_to?: string | null
          id?: string
          linkedin_daily_connect_limit?: number | null
          linkedin_daily_message_limit?: number | null
          linkedin_profile_url?: string | null
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          calendar_booking_url?: string | null
          calendar_provider?: string | null
          created_at?: string
          crm_inbound_webhook_url?: string | null
          crm_outbound_webhook_url?: string | null
          crm_webhook_secret?: string | null
          custom_domain?: string | null
          custom_domain_verified?: boolean | null
          email_domain_verified?: boolean | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_reply_to?: string | null
          id?: string
          linkedin_daily_connect_limit?: number | null
          linkedin_daily_message_limit?: number | null
          linkedin_profile_url?: string | null
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          actual_close_date: string | null
          created_at: string
          created_by: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          owner_id: string | null
          probability: number | null
          stage: string
          updated_at: string
          value: number | null
          workspace_id: string
        }
        Insert: {
          actual_close_date?: string | null
          created_at?: string
          created_by?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          probability?: number | null
          stage?: string
          updated_at?: string
          value?: number | null
          workspace_id: string
        }
        Update: {
          actual_close_date?: string | null
          created_at?: string
          created_by?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          probability?: number | null
          stage?: string
          updated_at?: string
          value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_steps: {
        Row: {
          body: string
          created_at: string
          delay_days: number | null
          id: string
          sequence_id: string
          step_order: number
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          delay_days?: number | null
          id?: string
          sequence_id: string
          step_order: number
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          delay_days?: number | null
          id?: string
          sequence_id?: string
          step_order?: number
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          completed_count: number | null
          created_at: string
          created_by: string | null
          description: string | null
          enrolled_count: number | null
          id: string
          name: string
          status: string | null
          total_steps: number | null
          trigger_type: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enrolled_count?: number | null
          id?: string
          name: string
          status?: string | null
          total_steps?: number | null
          trigger_type?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enrolled_count?: number | null
          id?: string
          name?: string
          status?: string | null
          total_steps?: number | null
          trigger_type?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_audit_log: {
        Row: {
          action: string
          changes: Json
          created_at: string
          id: string
          settings_type: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          action?: string
          changes?: Json
          created_at?: string
          id?: string
          settings_type: string
          tenant_id: string
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json
          created_at?: string
          id?: string
          settings_type?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          lead_id: string
          metadata: Json | null
          workspace_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          lead_id: string
          metadata?: Json | null
          workspace_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          company: string | null
          company_size: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          email: string
          first_name: string
          id: string
          industry: string | null
          job_title: string | null
          landing_page_url: string | null
          last_contacted_at: string | null
          last_name: string
          next_follow_up_at: string | null
          notes: string | null
          phone: string | null
          score: number | null
          source: string
          status: string
          tags: string[] | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          vertical: string | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          company?: string | null
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          email: string
          first_name: string
          id?: string
          industry?: string | null
          job_title?: string | null
          landing_page_url?: string | null
          last_contacted_at?: string | null
          last_name: string
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          score?: number | null
          source: string
          status?: string
          tags?: string[] | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          vertical?: string | null
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          company?: string | null
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          email?: string
          first_name?: string
          id?: string
          industry?: string | null
          job_title?: string | null
          landing_page_url?: string | null
          last_contacted_at?: string | null
          last_name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          score?: number | null
          source?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          vertical?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_tasks: {
        Row: {
          created_at: string | null
          id: string
          linkedin_url: string | null
          message_text: string
          notes: string | null
          prospect_id: string
          sent_at: string | null
          sequence_run_id: string | null
          status: string | null
          step_id: string | null
          tenant_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          linkedin_url?: string | null
          message_text: string
          notes?: string | null
          prospect_id: string
          sent_at?: string | null
          sequence_run_id?: string | null
          status?: string | null
          step_id?: string | null
          tenant_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          linkedin_url?: string | null
          message_text?: string
          notes?: string | null
          prospect_id?: string
          sent_at?: string | null
          sequence_run_id?: string | null
          status?: string | null
          step_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_tasks_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_tasks_run_id_fkey"
            columns: ["sequence_run_id"]
            isOneToOne: false
            referencedRelation: "outbound_sequence_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_tasks_sequence_run_id_fkey"
            columns: ["sequence_run_id"]
            isOneToOne: false
            referencedRelation: "outbound_sequence_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_tasks_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "outbound_sequence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      os_tenant_registry: {
        Row: {
          config: Json | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      outbound_campaigns: {
        Row: {
          channel: string
          config: Json | null
          created_at: string | null
          id: string
          name: string
          objective: string | null
          status: string | null
          target_persona: string | null
          tenant_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          channel: string
          config?: Json | null
          created_at?: string | null
          id?: string
          name: string
          objective?: string | null
          status?: string | null
          target_persona?: string | null
          tenant_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          channel?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          objective?: string | null
          status?: string | null
          target_persona?: string | null
          tenant_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      outbound_message_events: {
        Row: {
          channel: string
          clicked_at: string | null
          event_type: string
          id: string
          message_text: string | null
          metadata: Json | null
          occurred_at: string | null
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          sequence_run_id: string
          step_id: string
          subject_line: string | null
          tenant_id: string
        }
        Insert: {
          channel: string
          clicked_at?: string | null
          event_type: string
          id?: string
          message_text?: string | null
          metadata?: Json | null
          occurred_at?: string | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sequence_run_id: string
          step_id: string
          subject_line?: string | null
          tenant_id: string
        }
        Update: {
          channel?: string
          clicked_at?: string | null
          event_type?: string
          id?: string
          message_text?: string | null
          metadata?: Json | null
          occurred_at?: string | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sequence_run_id?: string
          step_id?: string
          subject_line?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_message_events_sequence_run_id_fkey"
            columns: ["sequence_run_id"]
            isOneToOne: false
            referencedRelation: "outbound_sequence_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_message_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "outbound_sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_sequence_runs: {
        Row: {
          id: string
          last_step_sent: number | null
          next_step_due_at: string | null
          prospect_id: string
          sequence_id: string
          started_at: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          last_step_sent?: number | null
          next_step_due_at?: string | null
          prospect_id: string
          sequence_id: string
          started_at?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          last_step_sent?: number | null
          next_step_due_at?: string | null
          prospect_id?: string
          sequence_id?: string
          started_at?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_sequence_runs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_sequence_runs_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outbound_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_sequence_steps: {
        Row: {
          channel: string | null
          created_at: string | null
          delay_days: number
          id: string
          message_template: string | null
          metadata: Json | null
          sequence_id: string
          step_order: number
          step_type: string
          tenant_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          delay_days?: number
          id?: string
          message_template?: string | null
          metadata?: Json | null
          sequence_id: string
          step_order: number
          step_type: string
          tenant_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          delay_days?: number
          id?: string
          message_template?: string | null
          metadata?: Json | null
          sequence_id?: string
          step_order?: number
          step_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outbound_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_sequences: {
        Row: {
          campaign_id: string
          channel: string
          created_at: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          channel: string
          created_at?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          channel?: string
          created_at?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outbound_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_scores: {
        Row: {
          band: string | null
          hypothesized_pain_points: string[] | null
          id: string
          key_signals: string[] | null
          last_scored_at: string | null
          prospect_id: string
          rationale: string | null
          recommended_angle: string | null
          score: number
          tenant_id: string
          tone_recommendation: string | null
        }
        Insert: {
          band?: string | null
          hypothesized_pain_points?: string[] | null
          id?: string
          key_signals?: string[] | null
          last_scored_at?: string | null
          prospect_id: string
          rationale?: string | null
          recommended_angle?: string | null
          score?: number
          tenant_id: string
          tone_recommendation?: string | null
        }
        Update: {
          band?: string | null
          hypothesized_pain_points?: string[] | null
          id?: string
          key_signals?: string[] | null
          last_scored_at?: string | null
          prospect_id?: string
          rationale?: string | null
          recommended_angle?: string | null
          score?: number
          tenant_id?: string
          tone_recommendation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_scores_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_signals: {
        Row: {
          detected_at: string | null
          id: string
          prospect_id: string
          signal_data: Json
          signal_strength: number | null
          signal_type: string
          source: string
          tenant_id: string
        }
        Insert: {
          detected_at?: string | null
          id?: string
          prospect_id: string
          signal_data?: Json
          signal_strength?: number | null
          signal_type: string
          source: string
          tenant_id: string
        }
        Update: {
          detected_at?: string | null
          id?: string
          prospect_id?: string
          signal_data?: Json
          signal_strength?: number | null
          signal_type?: string
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_signals_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          company: string | null
          created_at: string | null
          email: string | null
          external_id: string | null
          first_name: string | null
          id: string
          industry: string | null
          last_name: string | null
          linkedin_url: string | null
          location: string | null
          persona_tag: string | null
          tenant_id: string
          title: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          location?: string | null
          persona_tag?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          location?: string | null
          persona_tag?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          count: number
          created_at: string | null
          id: number
          key: string
          updated_at: string | null
          window_start: string
          window_type: string | null
        }
        Insert: {
          count?: number
          created_at?: string | null
          id?: number
          key: string
          updated_at?: string | null
          window_start: string
          window_type?: string | null
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: number
          key?: string
          updated_at?: string | null
          window_start?: string
          window_type?: string | null
        }
        Relationships: []
      }
      segments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          targeting_rules: Json | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          targeting_rules?: Json | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          targeting_rules?: Json | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number | null
          id: string
          lead_id: string
          next_email_at: string | null
          sequence_id: string
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number | null
          id?: string
          lead_id: string
          next_email_at?: string | null
          sequence_id: string
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number | null
          id?: string
          lead_id?: string
          next_email_at?: string | null
          sequence_id?: string
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_integrations: {
        Row: {
          access_token: string
          account_id: string | null
          account_name: string | null
          created_at: string
          id: string
          is_active: boolean | null
          platform: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          platform: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          platform?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: string | null
          status: string | null
          task_type: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          status?: string | null
          task_type?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          status?: string | null
          task_type?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_at: string
          invited_by: string
          role: string
          status: string
          tenant_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          invited_by: string
          role?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string
          role?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_module_access: {
        Row: {
          beta_only: boolean
          created_at: string
          enabled: boolean
          id: string
          module_id: string
          rollout_percentage: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          beta_only?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          module_id: string
          rollout_percentage?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          beta_only?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          module_id?: string
          rollout_percentage?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_password_resets: {
        Row: {
          created_at: string
          force_change: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          force_change?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          force_change?: boolean
          id?: string
          updated_at?: string
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
      user_tenants: {
        Row: {
          created_at: string
          id: string
          role: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_agents: {
        Row: {
          campaign_id: string | null
          config: Json
          created_at: string
          id: string
          is_default: boolean
          name: string
          provider: string
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          provider: string
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          provider?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_agents_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          public_form_password_hash: string | null
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          public_form_password_hash?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          public_form_password_hash?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invitation: {
        Args: { _email: string; _user_id: string }
        Returns: Json
      }
      asset_approval_workspace_access: {
        Args: { approval_asset_id: string }
        Returns: boolean
      }
      campaign_channel_workspace_access: {
        Args: { channel_campaign_id: string }
        Returns: boolean
      }
      check_and_increment_rate_limit:
        | {
            Args: {
              max_requests: number
              rate_key: string
              window_seconds: number
            }
            Returns: boolean
          }
        | {
            Args: {
              max_requests: number
              p_window_type?: string
              rate_key: string
              window_seconds: number
            }
            Returns: boolean
          }
      check_workspace_form_password: {
        Args: { _password: string; _workspace_id: string }
        Returns: boolean
      }
      content_variant_workspace_access: {
        Args: { variant_asset_id: string }
        Returns: boolean
      }
      dispatch_outbound_cron: { Args: never; Returns: undefined }
      funnel_stage_workspace_access: {
        Args: { stage_funnel_id: string }
        Returns: boolean
      }
      gc_rate_limit_counters: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_owner_or_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      must_change_password: { Args: { _user_id: string }; Returns: boolean }
      sequence_step_workspace_access: {
        Args: { step_sequence_id: string }
        Returns: boolean
      }
      user_has_workspace_access: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
      validate_campaign_integrations: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "sales" | "manager"
      asset_status: "draft" | "review" | "approved" | "live"
      asset_type: "video" | "email" | "voice" | "landing_page" | "website"
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
      app_role: ["admin", "sales", "manager"],
      asset_status: ["draft", "review", "approved", "live"],
      asset_type: ["video", "email", "voice", "landing_page", "website"],
    },
  },
} as const
