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
      asset_approval_workspace_access: {
        Args: { approval_asset_id: string }
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
      gc_rate_limit_counters: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      sequence_step_workspace_access: {
        Args: { step_sequence_id: string }
        Returns: boolean
      }
      user_has_workspace_access: {
        Args: { _workspace_id: string }
        Returns: boolean
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
