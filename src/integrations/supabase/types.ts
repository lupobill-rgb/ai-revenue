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
      accounts: {
        Row: {
          arr: number | null
          created_at: string
          external_crm_id: string | null
          id: string
          industry: string | null
          lifecycle_stage: string | null
          metadata: Json | null
          mrr: number | null
          name: string
          segment: string | null
          size_bucket: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          arr?: number | null
          created_at?: string
          external_crm_id?: string | null
          id?: string
          industry?: string | null
          lifecycle_stage?: string | null
          metadata?: Json | null
          mrr?: number | null
          name: string
          segment?: string | null
          size_bucket?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          arr?: number | null
          created_at?: string
          external_crm_id?: string | null
          id?: string
          industry?: string | null
          lifecycle_stage?: string | null
          metadata?: Json | null
          mrr?: number | null
          name?: string
          segment?: string | null
          size_bucket?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "ai_settings_calendar_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_calendar_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_calendar_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_calendar_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_calendar_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_calendar_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_calendar_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "ai_settings_crm_webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_crm_webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_crm_webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_crm_webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_crm_webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_crm_webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_crm_webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "ai_settings_domain_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_domain_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_domain_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_domain_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_domain_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_domain_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_domain_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings_email: {
        Row: {
          email_provider: string | null
          from_address: string
          is_connected: boolean | null
          last_test_result: Json | null
          last_tested_at: string | null
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
          email_provider?: string | null
          from_address?: string
          is_connected?: boolean | null
          last_test_result?: Json | null
          last_tested_at?: string | null
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
          email_provider?: string | null
          from_address?: string
          is_connected?: boolean | null
          last_test_result?: Json | null
          last_tested_at?: string | null
          reply_to_address?: string
          sender_name?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_email_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_email_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_email_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_email_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_email_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_email_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_email_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "ai_settings_linkedin_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_linkedin_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_linkedin_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_linkedin_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_linkedin_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_linkedin_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_linkedin_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings_social: {
        Row: {
          account_name: string | null
          account_url: string | null
          is_connected: boolean | null
          last_test_result: Json | null
          last_tested_at: string | null
          social_provider: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          account_name?: string | null
          account_url?: string | null
          is_connected?: boolean | null
          last_test_result?: Json | null
          last_tested_at?: string | null
          social_provider?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          account_name?: string | null
          account_url?: string | null
          is_connected?: boolean | null
          last_test_result?: Json | null
          last_tested_at?: string | null
          social_provider?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_social_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_social_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_social_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_social_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_social_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_social_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_social_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings_stripe: {
        Row: {
          account_name: string | null
          is_connected: boolean | null
          stripe_publishable_key: string | null
          stripe_secret_key_hint: string | null
          tenant_id: string
          updated_at: string | null
          webhook_secret_hint: string | null
        }
        Insert: {
          account_name?: string | null
          is_connected?: boolean | null
          stripe_publishable_key?: string | null
          stripe_secret_key_hint?: string | null
          tenant_id: string
          updated_at?: string | null
          webhook_secret_hint?: string | null
        }
        Update: {
          account_name?: string | null
          is_connected?: boolean | null
          stripe_publishable_key?: string | null
          stripe_secret_key_hint?: string | null
          tenant_id?: string
          updated_at?: string | null
          webhook_secret_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_stripe_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_stripe_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_stripe_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_stripe_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_stripe_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_stripe_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_stripe_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings_voice: {
        Row: {
          default_elevenlabs_voice_id: string | null
          default_phone_number_id: string | null
          default_vapi_assistant_id: string | null
          elevenlabs_api_key: string | null
          elevenlabs_model: string | null
          is_connected: boolean | null
          last_test_result: Json | null
          last_tested_at: string | null
          tenant_id: string
          updated_at: string | null
          vapi_private_key: string | null
          vapi_public_key: string | null
          voice_provider: string | null
        }
        Insert: {
          default_elevenlabs_voice_id?: string | null
          default_phone_number_id?: string | null
          default_vapi_assistant_id?: string | null
          elevenlabs_api_key?: string | null
          elevenlabs_model?: string | null
          is_connected?: boolean | null
          last_test_result?: Json | null
          last_tested_at?: string | null
          tenant_id: string
          updated_at?: string | null
          vapi_private_key?: string | null
          vapi_public_key?: string | null
          voice_provider?: string | null
        }
        Update: {
          default_elevenlabs_voice_id?: string | null
          default_phone_number_id?: string | null
          default_vapi_assistant_id?: string | null
          elevenlabs_api_key?: string | null
          elevenlabs_model?: string | null
          is_connected?: boolean | null
          last_test_result?: Json | null
          last_tested_at?: string | null
          tenant_id?: string
          updated_at?: string | null
          vapi_private_key?: string | null
          vapi_public_key?: string | null
          voice_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_voice_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_voice_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_voice_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_voice_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_voice_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_voice_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_settings_voice_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          segment_ids: string[] | null
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
          segment_ids?: string[] | null
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
          segment_ids?: string[] | null
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "automation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "automation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "automation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "automation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "automation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "automation_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "automation_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "automation_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "automation_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "automation_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "business_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "business_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "business_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "business_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "business_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "business_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_audit_log: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          campaign_id: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          job_id: string | null
          run_id: string | null
          tenant_id: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          campaign_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          job_id?: string | null
          run_id?: string | null
          tenant_id: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          campaign_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          job_id?: string | null
          run_id?: string | null
          tenant_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      campaign_channel_stats_daily: {
        Row: {
          bounces: number
          campaign_id: string
          channel: string
          clicks: number
          created_at: string
          data_mode: Database["public"]["Enums"]["data_mode"]
          day: string
          deliveries: number
          id: string
          meetings_booked: number
          opens: number
          replies: number
          sends: number
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bounces?: number
          campaign_id: string
          channel: string
          clicks?: number
          created_at?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          day: string
          deliveries?: number
          id?: string
          meetings_booked?: number
          opens?: number
          replies?: number
          sends?: number
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bounces?: number
          campaign_id?: string
          channel?: string
          clicks?: number
          created_at?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          day?: string
          deliveries?: number
          id?: string
          meetings_booked?: number
          opens?: number
          replies?: number
          sends?: number
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_channel_stats_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_channel_stats_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_channel_stats_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_channel_stats_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_channel_stats_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_channel_stats_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_channel_stats_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          data_mode: Database["public"]["Enums"]["data_mode"]
          delivered_count: number | null
          engagement_rate: number | null
          id: string
          impressions: number | null
          last_synced_at: string | null
          likes: number | null
          open_count: number | null
          reply_count: number | null
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
          data_mode?: Database["public"]["Enums"]["data_mode"]
          delivered_count?: number | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          last_synced_at?: string | null
          likes?: number | null
          open_count?: number | null
          reply_count?: number | null
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
          data_mode?: Database["public"]["Enums"]["data_mode"]
          delivered_count?: number | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          last_synced_at?: string | null
          likes?: number | null
          open_count?: number | null
          reply_count?: number | null
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
      campaign_runs: {
        Row: {
          attempts: number | null
          campaign_id: string
          channel: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          data_mode: Database["public"]["Enums"]["data_mode"]
          error_code: string | null
          error_message: string | null
          id: string
          last_run_at: string | null
          metrics_snapshot: Json | null
          next_run_at: string | null
          run_config: Json | null
          scheduled_for: string | null
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempts?: number | null
          campaign_id: string
          channel?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          data_mode?: Database["public"]["Enums"]["data_mode"]
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_run_at?: string | null
          metrics_snapshot?: Json | null
          next_run_at?: string | null
          run_config?: Json | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempts?: number | null
          campaign_id?: string
          channel?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          data_mode?: Database["public"]["Enums"]["data_mode"]
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_run_at?: string | null
          metrics_snapshot?: Json | null
          next_run_at?: string | null
          run_config?: Json | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
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
          is_locked: boolean | null
          locked_at: string | null
          locked_reason: string | null
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
          is_locked?: boolean | null
          locked_at?: string | null
          locked_reason?: string | null
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
          is_locked?: boolean | null
          locked_at?: string | null
          locked_reason?: string | null
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
      channel_outbox: {
        Row: {
          channel: string
          created_at: string
          data_mode: Database["public"]["Enums"]["data_mode"]
          error: string | null
          id: string
          idempotency_key: string
          job_id: string | null
          payload: Json
          provider: string
          provider_message_id: string | null
          provider_response: Json | null
          recipient_email: string | null
          recipient_id: string | null
          recipient_phone: string | null
          run_id: string | null
          skip_reason: string | null
          skipped: boolean | null
          status: string
          tenant_id: string
          workspace_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          error?: string | null
          id?: string
          idempotency_key: string
          job_id?: string | null
          payload?: Json
          provider: string
          provider_message_id?: string | null
          provider_response?: Json | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          run_id?: string | null
          skip_reason?: string | null
          skipped?: boolean | null
          status?: string
          tenant_id: string
          workspace_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          error?: string | null
          id?: string
          idempotency_key?: string
          job_id?: string | null
          payload?: Json
          provider?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          run_id?: string | null
          skip_reason?: string | null
          skipped?: boolean | null
          status?: string
          tenant_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_outbox_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_outbox_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "campaign_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_outbox_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_campaign_dashboard_metrics"
            referencedColumns: ["run_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_spend_daily: {
        Row: {
          attribution_model: string
          attribution_window_days: number
          channel_id: string
          clicks: number
          created_at: string
          currency: string
          data_mode: Database["public"]["Enums"]["data_mode"]
          date: string
          id: string
          impressions: number
          leads: number
          opportunities: number
          revenue_booked: number
          spend: number
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attribution_model?: string
          attribution_window_days?: number
          channel_id: string
          clicks?: number
          created_at?: string
          currency?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          date: string
          id?: string
          impressions?: number
          leads?: number
          opportunities?: number
          revenue_booked?: number
          spend?: number
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attribution_model?: string
          attribution_window_days?: number
          channel_id?: string
          clicks?: number
          created_at?: string
          currency?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          date?: string
          id?: string
          impressions?: number
          leads?: number
          opportunities?: number
          revenue_booked?: number
          spend?: number
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_spend_daily_channel_fk"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaign_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_spend_daily_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_spend_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_spend_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_spend_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_spend_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_spend_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_spend_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_spend_daily_workspace_id_fkey"
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_brand_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_brand_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_brand_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_brand_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_brand_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
          external_account_id: string | null
          external_ad_id: string | null
          external_adset_id: string | null
          external_campaign_id: string | null
          external_source: string | null
          id: string
          is_paid: boolean | null
          posting_frequency: string | null
          priority: string | null
          targeting_notes: string | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          budget_percentage?: number | null
          campaign_id: string
          channel_name: string
          channel_type?: string | null
          content_types?: Json | null
          created_at?: string
          expected_metrics?: Json | null
          external_account_id?: string | null
          external_ad_id?: string | null
          external_adset_id?: string | null
          external_campaign_id?: string | null
          external_source?: string | null
          id?: string
          is_paid?: boolean | null
          posting_frequency?: string | null
          priority?: string | null
          targeting_notes?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          budget_percentage?: number | null
          campaign_id?: string
          channel_name?: string
          channel_type?: string | null
          content_types?: Json | null
          created_at?: string
          expected_metrics?: Json | null
          external_account_id?: string | null
          external_ad_id?: string | null
          external_adset_id?: string | null
          external_campaign_id?: string | null
          external_source?: string | null
          id?: string
          is_paid?: boolean | null
          posting_frequency?: string | null
          priority?: string | null
          targeting_notes?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
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
          target_segment_codes: string[] | null
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
          target_segment_codes?: string[] | null
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
          target_segment_codes?: string[] | null
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_content_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_content_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_content_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_content_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_content_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_funnels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_funnels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_funnels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_funnels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_funnels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_icp_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_icp_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_icp_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_icp_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_icp_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_marketing_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_marketing_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_marketing_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_marketing_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_marketing_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
          data_mode: Database["public"]["Enums"]["data_mode"]
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
          data_mode?: Database["public"]["Enums"]["data_mode"]
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
          data_mode?: Database["public"]["Enums"]["data_mode"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_metrics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_metrics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_metrics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_metrics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_metrics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_weekly_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_weekly_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_weekly_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_weekly_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cmo_weekly_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_calendar_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_calendar_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_calendar_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_calendar_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_calendar_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_type: string
          contact_id: string
          created_at: string
          data_mode: Database["public"]["Enums"]["data_mode"]
          id: string
          lead_id: string | null
          meta: Json
          tenant_id: string
        }
        Insert: {
          activity_type: string
          contact_id: string
          created_at?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          id?: string
          lead_id?: string | null
          meta?: Json
          tenant_id: string
        }
        Update: {
          activity_type?: string
          contact_id?: string
          created_at?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          id?: string
          lead_id?: string | null
          meta?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lifecycle_stage: string | null
          phone: string | null
          role_title: string | null
          segment_code: string | null
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lifecycle_stage?: string | null
          phone?: string | null
          role_title?: string | null
          segment_code?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lifecycle_stage?: string | null
          phone?: string | null
          role_title?: string | null
          segment_code?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          campaign_id: string | null
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          score: number | null
          source: string | null
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_deal_reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_deal_reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_deal_reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_deal_reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_deal_reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_forecasts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_forecasts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_forecasts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_forecasts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_forecasts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_targets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_targets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_targets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_targets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "cro_targets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "customer_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "customer_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "customer_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "customer_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "customer_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
          closed_won_at: string | null
          created_at: string
          created_by: string | null
          data_mode: Database["public"]["Enums"]["data_mode"]
          expected_close_date: string | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          owner_id: string | null
          probability: number | null
          revenue_verified: boolean
          stage: string
          stripe_payment_id: string | null
          tenant_id: string | null
          updated_at: string
          value: number | null
          workspace_id: string
        }
        Insert: {
          actual_close_date?: string | null
          closed_won_at?: string | null
          created_at?: string
          created_by?: string | null
          data_mode?: Database["public"]["Enums"]["data_mode"]
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          probability?: number | null
          revenue_verified?: boolean
          stage?: string
          stripe_payment_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          value?: number | null
          workspace_id: string
        }
        Update: {
          actual_close_date?: string | null
          closed_won_at?: string | null
          created_at?: string
          created_by?: string | null
          data_mode?: Database["public"]["Enums"]["data_mode"]
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          probability?: number | null
          revenue_verified?: boolean
          stage?: string
          stripe_payment_id?: string | null
          tenant_id?: string | null
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
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_lead_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
      email_events: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          email_address: string
          event_type: string
          event_type_internal: string | null
          id: string
          lead_id: string | null
          meta: Json
          occurred_at: string
          provider: string
          provider_event_type: string | null
          provider_message_id: string | null
          provider_thread_id: string | null
          received_at: string
          sequence_run_id: string | null
          tenant_id: string
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          email_address: string
          event_type: string
          event_type_internal?: string | null
          id?: string
          lead_id?: string | null
          meta?: Json
          occurred_at: string
          provider: string
          provider_event_type?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          received_at?: string
          sequence_run_id?: string | null
          tenant_id: string
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          email_address?: string
          event_type?: string
          event_type_internal?: string | null
          id?: string
          lead_id?: string | null
          meta?: Json
          occurred_at?: string
          provider?: string
          provider_event_type?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          received_at?: string
          sequence_run_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_sequence_run_id_fkey"
            columns: ["sequence_run_id"]
            isOneToOne: false
            referencedRelation: "outbound_sequence_runs"
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      errors_email_webhook: {
        Row: {
          created_at: string
          error_message: string
          error_type: string
          id: string
          provider_event_id: string | null
          provider_message_id: string | null
          provider_type: string | null
          raw_payload: Json | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error_message: string
          error_type: string
          id?: string
          provider_event_id?: string | null
          provider_message_id?: string | null
          provider_type?: string | null
          raw_payload?: Json | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string
          error_type?: string
          id?: string
          provider_event_id?: string | null
          provider_message_id?: string | null
          provider_type?: string | null
          raw_payload?: Json | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      events_raw: {
        Row: {
          account_id: string | null
          campaign_channel_id: string | null
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          event_type: string
          id: string
          idempotency_key: string | null
          occurred_at: string
          opportunity_id: string | null
          properties: Json | null
          source_system: string
          tenant_id: string
        }
        Insert: {
          account_id?: string | null
          campaign_channel_id?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          properties?: Json | null
          source_system: string
          tenant_id: string
        }
        Update: {
          account_id?: string | null
          campaign_channel_id?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          properties?: Json | null
          source_system?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_raw_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_raw_campaign_channel_id_fkey"
            columns: ["campaign_channel_id"]
            isOneToOne: false
            referencedRelation: "spine_campaign_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_raw_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "spine_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_raw_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "spine_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_raw_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_raw_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_verticals: {
        Row: {
          aliases: string[] | null
          created_at: string
          id: number
          name: string
        }
        Insert: {
          aliases?: string[] | null
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          aliases?: string[] | null
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
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
      job_queue: {
        Row: {
          attempts: number
          created_at: string
          data_mode: Database["public"]["Enums"]["data_mode"]
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          payload: Json
          run_id: string | null
          scheduled_for: string
          status: string
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          id?: string
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          payload?: Json
          run_id?: string | null
          scheduled_for?: string
          status?: string
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          id?: string
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          payload?: Json
          run_id?: string | null
          scheduled_for?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "campaign_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_queue_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_campaign_dashboard_metrics"
            referencedColumns: ["run_id"]
          },
        ]
      }
      kernel_cycle_slo: {
        Row: {
          created_at: string
          cycle_date: string
          cycles_attempted: number
          cycles_failed: number
          cycles_succeeded: number
          economics_actions_count: number
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_date: string
          cycles_attempted?: number
          cycles_failed?: number
          cycles_succeeded?: number
          economics_actions_count?: number
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_date?: string
          cycles_attempted?: number
          cycles_failed?: number
          cycles_succeeded?: number
          economics_actions_count?: number
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kernel_cycle_slo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          campaign_id: string
          created_at: string
          form_fields: Json
          hero_headline: string
          hero_subheadline: string | null
          hero_supporting_points: string[] | null
          id: string
          internal_name: string
          primary_cta_label: string
          primary_cta_type: string
          published: boolean
          sections: Json
          template_type: string
          tenant_id: string
          updated_at: string
          url: string | null
          url_slug: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          form_fields?: Json
          hero_headline: string
          hero_subheadline?: string | null
          hero_supporting_points?: string[] | null
          id?: string
          internal_name: string
          primary_cta_label: string
          primary_cta_type: string
          published?: boolean
          sections?: Json
          template_type: string
          tenant_id: string
          updated_at?: string
          url?: string | null
          url_slug: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          form_fields?: Json
          hero_headline?: string
          hero_subheadline?: string | null
          hero_supporting_points?: string[] | null
          id?: string
          internal_name?: string
          primary_cta_label?: string
          primary_cta_type?: string
          published?: boolean
          sections?: Json
          template_type?: string
          tenant_id?: string
          updated_at?: string
          url?: string | null
          url_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
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
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_lead_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "lead_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "lead_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "lead_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "lead_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "lead_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
          contacted_at: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          data_mode: Database["public"]["Enums"]["data_mode"]
          email: string
          first_name: string
          id: string
          industry: string | null
          job_title: string | null
          landing_page_url: string | null
          last_contacted_at: string | null
          last_name: string
          lost_at: string | null
          next_follow_up_at: string | null
          notes: string | null
          phone: string | null
          qualified_at: string | null
          score: number | null
          segment_code: string | null
          source: string
          status: string
          tags: string[] | null
          tenant_id: string | null
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
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          data_mode?: Database["public"]["Enums"]["data_mode"]
          email: string
          first_name: string
          id?: string
          industry?: string | null
          job_title?: string | null
          landing_page_url?: string | null
          last_contacted_at?: string | null
          last_name: string
          lost_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          qualified_at?: string | null
          score?: number | null
          segment_code?: string | null
          source: string
          status?: string
          tags?: string[] | null
          tenant_id?: string | null
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
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          data_mode?: Database["public"]["Enums"]["data_mode"]
          email?: string
          first_name?: string
          id?: string
          industry?: string | null
          job_title?: string | null
          landing_page_url?: string | null
          last_contacted_at?: string | null
          last_name?: string
          lost_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          qualified_at?: string | null
          score?: number | null
          segment_code?: string | null
          source?: string
          status?: string
          tags?: string[] | null
          tenant_id?: string | null
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "linkedin_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "linkedin_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "linkedin_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "linkedin_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "linkedin_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
      metric_snapshots_daily: {
        Row: {
          created_at: string
          date: string
          dimension: Json | null
          id: string
          metric_id: string
          tenant_id: string
          value: number
        }
        Insert: {
          created_at?: string
          date: string
          dimension?: Json | null
          id?: string
          metric_id: string
          tenant_id: string
          value: number
        }
        Update: {
          created_at?: string
          date?: string
          dimension?: Json | null
          id?: string
          metric_id?: string
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metric_snapshots_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          account_id: string | null
          amount: number | null
          campaign_id: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string
          expected_close_date: string | null
          external_crm_id: string | null
          id: string
          lost_reason: string | null
          metadata: Json | null
          name: string
          owner_user_id: string | null
          source: string | null
          stage: string
          tenant_id: string
          updated_at: string
          win_probability: number | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          campaign_id?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          external_crm_id?: string | null
          id?: string
          lost_reason?: string | null
          metadata?: Json | null
          name: string
          owner_user_id?: string | null
          source?: string | null
          stage?: string
          tenant_id: string
          updated_at?: string
          win_probability?: number | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          campaign_id?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          external_crm_id?: string | null
          id?: string
          lost_reason?: string | null
          metadata?: Json | null
          name?: string
          owner_user_id?: string | null
          source?: string | null
          stage?: string
          tenant_id?: string
          updated_at?: string
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "spine_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_channel_attribution: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          opportunity_id: string
          role: string
          tenant_id: string
          weight: number
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          opportunity_id: string
          role?: string
          tenant_id: string
          weight?: number
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          opportunity_id?: string
          role?: string
          tenant_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "opp_channel_attr_channel_fk"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "cmo_campaign_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opp_channel_attr_opp_fk"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opp_channel_attr_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_action_results: {
        Row: {
          baseline_value: number | null
          confidence: number | null
          context_snapshot: Json | null
          created_at: string
          delta: number | null
          delta_direction: string | null
          economic_deltas: Json | null
          id: string
          metadata: Json | null
          metric_id: string
          observation_end_date: string | null
          observation_start_date: string | null
          observed_value: number | null
          optimization_action_id: string
          tenant_id: string
        }
        Insert: {
          baseline_value?: number | null
          confidence?: number | null
          context_snapshot?: Json | null
          created_at?: string
          delta?: number | null
          delta_direction?: string | null
          economic_deltas?: Json | null
          id?: string
          metadata?: Json | null
          metric_id: string
          observation_end_date?: string | null
          observation_start_date?: string | null
          observed_value?: number | null
          optimization_action_id: string
          tenant_id: string
        }
        Update: {
          baseline_value?: number | null
          confidence?: number | null
          context_snapshot?: Json | null
          created_at?: string
          delta?: number | null
          delta_direction?: string | null
          economic_deltas?: Json | null
          id?: string
          metadata?: Json | null
          metric_id?: string
          observation_end_date?: string | null
          observation_start_date?: string | null
          observed_value?: number | null
          optimization_action_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_action_results_optimization_action_id_fkey"
            columns: ["optimization_action_id"]
            isOneToOne: false
            referencedRelation: "optimization_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_action_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_actions: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          action_id: string
          config: Json | null
          created_at: string
          expected_observation_window_days: number | null
          guardrails: Json | null
          hypothesis: string | null
          id: string
          lens_emphasis: string | null
          notes_for_humans: string | null
          optimization_cycle_id: string
          owner_subsystem: string | null
          priority_rank: number | null
          requires_acknowledgment: boolean | null
          status: string | null
          target_direction: string | null
          target_metric: string | null
          tenant_id: string
          type: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_id: string
          config?: Json | null
          created_at?: string
          expected_observation_window_days?: number | null
          guardrails?: Json | null
          hypothesis?: string | null
          id?: string
          lens_emphasis?: string | null
          notes_for_humans?: string | null
          optimization_cycle_id: string
          owner_subsystem?: string | null
          priority_rank?: number | null
          requires_acknowledgment?: boolean | null
          status?: string | null
          target_direction?: string | null
          target_metric?: string | null
          tenant_id: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_id?: string
          config?: Json | null
          created_at?: string
          expected_observation_window_days?: number | null
          guardrails?: Json | null
          hypothesis?: string | null
          id?: string
          lens_emphasis?: string | null
          notes_for_humans?: string | null
          optimization_cycle_id?: string
          owner_subsystem?: string | null
          priority_rank?: number | null
          requires_acknowledgment?: boolean | null
          status?: string | null
          target_direction?: string | null
          target_metric?: string | null
          tenant_id?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_actions_optimization_cycle_id_fkey"
            columns: ["optimization_cycle_id"]
            isOneToOne: false
            referencedRelation: "optimization_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_cycles: {
        Row: {
          binding_constraint: string | null
          cfo_gates_active: string[] | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input_snapshot_ref: Json | null
          invoked_at: string
          priority_metric_id: string | null
          raw_kernel_output: Json | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          binding_constraint?: string | null
          cfo_gates_active?: string[] | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_snapshot_ref?: Json | null
          invoked_at?: string
          priority_metric_id?: string | null
          raw_kernel_output?: Json | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          binding_constraint?: string | null
          cfo_gates_active?: string[] | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_snapshot_ref?: Json | null
          invoked_at?: string
          priority_metric_id?: string | null
          raw_kernel_output?: Json | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      optimizer_configs: {
        Row: {
          channel: string
          click_weight: number
          created_at: string
          id: string
          open_weight: number
          prompt_version: string
          reply_weight: number
          tenant_id: string
        }
        Insert: {
          channel: string
          click_weight?: number
          created_at?: string
          id?: string
          open_weight?: number
          prompt_version?: string
          reply_weight?: number
          tenant_id: string
        }
        Update: {
          channel?: string
          click_weight?: number
          created_at?: string
          id?: string
          open_weight?: number
          prompt_version?: string
          reply_weight?: number
          tenant_id?: string
        }
        Relationships: []
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
      platform_admins: {
        Row: {
          created_at: string | null
          email: string
          granted_at: string | null
          granted_by: string | null
          id: string
          is_active: boolean | null
          name: string | null
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      rate_limit_events: {
        Row: {
          channel: string
          created_at: string
          current_usage: number
          event_type: string
          id: string
          job_id: string | null
          limit_type: string
          limit_value: number
          run_id: string | null
          tenant_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          current_usage: number
          event_type: string
          id?: string
          job_id?: string | null
          limit_type: string
          limit_value: number
          run_id?: string | null
          tenant_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          current_usage?: number
          event_type?: string
          id?: string
          job_id?: string | null
          limit_type?: string
          limit_value?: number
          run_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      release_notes: {
        Row: {
          body_md: string
          created_at: string
          created_by: string | null
          id: string
          released_at: string
          tenant_id: string | null
          title: string
        }
        Insert: {
          body_md: string
          created_at?: string
          created_by?: string | null
          id?: string
          released_at?: string
          tenant_id?: string | null
          title: string
        }
        Update: {
          body_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          released_at?: string
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_events: {
        Row: {
          account_id: string | null
          amount: number
          attributed_campaign_id: string | null
          attributed_channel: string | null
          attribution_model: string | null
          created_at: string
          currency: string | null
          effective_date: string
          id: string
          metadata: Json | null
          opportunity_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attributed_campaign_id?: string | null
          attributed_channel?: string | null
          attribution_model?: string | null
          created_at?: string
          currency?: string | null
          effective_date: string
          id?: string
          metadata?: Json | null
          opportunity_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attributed_campaign_id?: string | null
          attributed_channel?: string | null
          attribution_model?: string | null
          created_at?: string
          currency?: string | null
          effective_date?: string
          id?: string
          metadata?: Json | null
          opportunity_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_events_attributed_campaign_id_fkey"
            columns: ["attributed_campaign_id"]
            isOneToOne: false
            referencedRelation: "spine_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rollout_gate_checks: {
        Row: {
          check_query: string | null
          check_result: Json | null
          created_at: string
          description: string | null
          gate_name: string
          gate_type: string
          id: string
          is_passed: boolean | null
          last_checked_at: string | null
          phase_id: string
          required: boolean | null
        }
        Insert: {
          check_query?: string | null
          check_result?: Json | null
          created_at?: string
          description?: string | null
          gate_name: string
          gate_type: string
          id?: string
          is_passed?: boolean | null
          last_checked_at?: string | null
          phase_id: string
          required?: boolean | null
        }
        Update: {
          check_query?: string | null
          check_result?: Json | null
          created_at?: string
          description?: string | null
          gate_name?: string
          gate_type?: string
          id?: string
          is_passed?: boolean | null
          last_checked_at?: string | null
          phase_id?: string
          required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rollout_gate_checks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "rollout_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      rollout_phases: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          phase_name: string
          phase_number: number
          required_duration_hours: number | null
          started_at: string | null
          status: string
          tenant_filter: Json | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          phase_name: string
          phase_number: number
          required_duration_hours?: number | null
          started_at?: string | null
          status?: string
          tenant_filter?: Json | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          phase_name?: string
          phase_number?: number
          required_duration_hours?: number | null
          started_at?: string | null
          status?: string
          tenant_filter?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      rollout_tenant_assignments: {
        Row: {
          assigned_at: string
          id: string
          phase_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          phase_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          phase_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rollout_tenant_assignments_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "rollout_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rollout_tenant_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
            foreignKeyName: "sequence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_lead_pipeline"
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "sequence_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "sequence_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "sequence_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "sequence_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "sequence_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
      slo_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          details: Json | null
          id: string
          message: string
          metric_name: string | null
          metric_value: number | null
          resolved_at: string | null
          severity: string
          tenant_id: string | null
          threshold: number | null
          workspace_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          metric_name?: string | null
          metric_value?: number | null
          resolved_at?: string | null
          severity?: string
          tenant_id?: string | null
          threshold?: number | null
          workspace_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          metric_name?: string | null
          metric_value?: number | null
          resolved_at?: string | null
          severity?: string
          tenant_id?: string | null
          threshold?: number | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      slo_config: {
        Row: {
          alert_severity: string | null
          comparison: string
          created_at: string
          description: string | null
          display_name: string
          enabled: boolean | null
          id: string
          is_hard_slo: boolean | null
          metric_name: string
          threshold: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          alert_severity?: string | null
          comparison?: string
          created_at?: string
          description?: string | null
          display_name: string
          enabled?: boolean | null
          id?: string
          is_hard_slo?: boolean | null
          metric_name: string
          threshold: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          alert_severity?: string | null
          comparison?: string
          created_at?: string
          description?: string | null
          display_name?: string
          enabled?: boolean | null
          id?: string
          is_hard_slo?: boolean | null
          metric_name?: string
          threshold?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      slo_metrics: {
        Row: {
          details: Json | null
          id: string
          is_breached: boolean
          measured_at: string
          metric_name: string
          metric_value: number
          tenant_id: string | null
          threshold: number
          window_end: string
          window_start: string
          workspace_id: string | null
        }
        Insert: {
          details?: Json | null
          id?: string
          is_breached?: boolean
          measured_at?: string
          metric_name: string
          metric_value: number
          tenant_id?: string | null
          threshold: number
          window_end: string
          window_start: string
          workspace_id?: string | null
        }
        Update: {
          details?: Json | null
          id?: string
          is_breached?: boolean
          measured_at?: string
          metric_name?: string
          metric_value?: number
          tenant_id?: string | null
          threshold?: number
          window_end?: string
          window_start?: string
          workspace_id?: string | null
        }
        Relationships: []
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "social_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spine_campaign_channels: {
        Row: {
          bidding_strategy: Json | null
          campaign_id: string
          channel: string
          config: Json | null
          created_at: string
          daily_budget: number | null
          id: string
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bidding_strategy?: Json | null
          campaign_id: string
          channel: string
          config?: Json | null
          created_at?: string
          daily_budget?: number | null
          id?: string
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bidding_strategy?: Json | null
          campaign_id?: string
          channel?: string
          config?: Json | null
          created_at?: string
          daily_budget?: number | null
          id?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spine_campaign_channels_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "spine_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spine_campaign_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      spine_campaigns: {
        Row: {
          budget_currency: string | null
          budget_total: number | null
          created_at: string
          end_date: string | null
          id: string
          metadata: Json | null
          name: string
          objective: string | null
          start_date: string | null
          status: string | null
          target_segment: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          budget_currency?: string | null
          budget_total?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          metadata?: Json | null
          name: string
          objective?: string | null
          start_date?: string | null
          status?: string | null
          target_segment?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          budget_currency?: string | null
          budget_total?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          objective?: string | null
          start_date?: string | null
          status?: string | null
          target_segment?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spine_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      spine_contacts: {
        Row: {
          account_id: string | null
          created_at: string
          email: string | null
          external_crm_id: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lifecycle_stage: string | null
          metadata: Json | null
          persona_tag: string | null
          phone: string | null
          role_title: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          email?: string | null
          external_crm_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lifecycle_stage?: string | null
          metadata?: Json | null
          persona_tag?: string | null
          phone?: string | null
          role_title?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          email?: string | null
          external_crm_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lifecycle_stage?: string | null
          metadata?: Json | null
          persona_tag?: string | null
          phone?: string | null
          role_title?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spine_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spine_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      spine_crm_activities: {
        Row: {
          account_id: string | null
          activity_type: string
          contact_id: string | null
          created_at: string
          direction: string | null
          id: string
          metadata: Json | null
          occurred_at: string
          opportunity_id: string | null
          outcome: string | null
          performed_by_agent_id: string | null
          performed_by_user_id: string | null
          tenant_id: string
        }
        Insert: {
          account_id?: string | null
          activity_type: string
          contact_id?: string | null
          created_at?: string
          direction?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          opportunity_id?: string | null
          outcome?: string | null
          performed_by_agent_id?: string | null
          performed_by_user_id?: string | null
          tenant_id: string
        }
        Update: {
          account_id?: string | null
          activity_type?: string
          contact_id?: string | null
          created_at?: string
          direction?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          opportunity_id?: string | null
          outcome?: string | null
          performed_by_agent_id?: string | null
          performed_by_user_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spine_crm_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spine_crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "spine_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spine_crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spine_crm_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          created_at: string
          data_mode: Database["public"]["Enums"]["data_mode"]
          event_type: string
          id: string
          payload: Json
          tenant_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          event_type: string
          id?: string
          payload?: Json
          tenant_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data_mode?: Database["public"]["Enums"]["data_mode"]
          event_type?: string
          id?: string
          payload?: Json
          tenant_id?: string
          workspace_id?: string
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
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_lead_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "team_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "team_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "team_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "team_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "team_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
      tenant_rate_limits: {
        Row: {
          created_at: string
          daily_reset_at: string
          email_daily_limit: number
          email_daily_used: number
          email_hourly_limit: number
          email_hourly_used: number
          hourly_reset_at: string
          id: string
          notify_at_percentage: number
          soft_cap_enabled: boolean
          tenant_id: string
          updated_at: string
          voice_daily_minutes: number
          voice_daily_minutes_used: number
          voice_hourly_minutes: number
          voice_hourly_minutes_used: number
        }
        Insert: {
          created_at?: string
          daily_reset_at?: string
          email_daily_limit?: number
          email_daily_used?: number
          email_hourly_limit?: number
          email_hourly_used?: number
          hourly_reset_at?: string
          id?: string
          notify_at_percentage?: number
          soft_cap_enabled?: boolean
          tenant_id: string
          updated_at?: string
          voice_daily_minutes?: number
          voice_daily_minutes_used?: number
          voice_hourly_minutes?: number
          voice_hourly_minutes_used?: number
        }
        Update: {
          created_at?: string
          daily_reset_at?: string
          email_daily_limit?: number
          email_daily_used?: number
          email_hourly_limit?: number
          email_hourly_used?: number
          hourly_reset_at?: string
          id?: string
          notify_at_percentage?: number
          soft_cap_enabled?: boolean
          tenant_id?: string
          updated_at?: string
          voice_daily_minutes?: number
          voice_daily_minutes_used?: number
          voice_hourly_minutes?: number
          voice_hourly_minutes_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_rate_limits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_segments: {
        Row: {
          code: string
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_global: boolean | null
          name: string
          sort_order: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          name: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          name?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_targets: {
        Row: {
          cash_risk_tolerance: string | null
          created_at: string
          email_enabled: boolean | null
          experiment_exposure_pct: number | null
          landing_pages_enabled: boolean | null
          linkedin_enabled: boolean | null
          margin_floor_pct: number | null
          max_cac: number | null
          max_cac_by_segment: Json | null
          monthly_budget_cap: number | null
          sms_enabled: boolean | null
          target_bookings: number | null
          target_payback_months: number | null
          target_pipeline: number | null
          tenant_id: string
          updated_at: string
          voice_enabled: boolean | null
        }
        Insert: {
          cash_risk_tolerance?: string | null
          created_at?: string
          email_enabled?: boolean | null
          experiment_exposure_pct?: number | null
          landing_pages_enabled?: boolean | null
          linkedin_enabled?: boolean | null
          margin_floor_pct?: number | null
          max_cac?: number | null
          max_cac_by_segment?: Json | null
          monthly_budget_cap?: number | null
          sms_enabled?: boolean | null
          target_bookings?: number | null
          target_payback_months?: number | null
          target_pipeline?: number | null
          tenant_id: string
          updated_at?: string
          voice_enabled?: boolean | null
        }
        Update: {
          cash_risk_tolerance?: string | null
          created_at?: string
          email_enabled?: boolean | null
          experiment_exposure_pct?: number | null
          landing_pages_enabled?: boolean | null
          linkedin_enabled?: boolean | null
          margin_floor_pct?: number | null
          max_cac?: number | null
          max_cac_by_segment?: Json | null
          monthly_budget_cap?: number | null
          sms_enabled?: boolean | null
          target_bookings?: number | null
          target_payback_months?: number | null
          target_pipeline?: number | null
          tenant_id?: string
          updated_at?: string
          voice_enabled?: boolean | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          billing_plan: string
          cfo_expansion_enabled: boolean
          config: Json | null
          created_at: string
          default_currency: string
          id: string
          metrics_mode: string
          name: string
          revenue_os_activated_at: string | null
          revenue_os_enabled: boolean
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_plan?: string
          cfo_expansion_enabled?: boolean
          config?: Json | null
          created_at?: string
          default_currency?: string
          id?: string
          metrics_mode?: string
          name: string
          revenue_os_activated_at?: string | null
          revenue_os_enabled?: boolean
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_plan?: string
          cfo_expansion_enabled?: boolean
          config?: Json | null
          created_at?: string
          default_currency?: string
          id?: string
          metrics_mode?: string
          name?: string
          revenue_os_activated_at?: string | null
          revenue_os_enabled?: boolean
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_gmail_tokens: {
        Row: {
          access_token: string
          created_at: string
          email: string
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
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
          last_used_workspace_id: string | null
          onboarding_completed_at: string | null
          role: string | null
          tenant_id: string
          user_id: string
          wants_product_updates: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_workspace_id?: string | null
          onboarding_completed_at?: string | null
          role?: string | null
          tenant_id: string
          user_id: string
          wants_product_updates?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          last_used_workspace_id?: string | null
          onboarding_completed_at?: string | null
          role?: string | null
          tenant_id?: string
          user_id?: string
          wants_product_updates?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_last_used_workspace_id_fkey"
            columns: ["last_used_workspace_id"]
            isOneToOne: false
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_tenants_last_used_workspace_id_fkey"
            columns: ["last_used_workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_tenants_last_used_workspace_id_fkey"
            columns: ["last_used_workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_tenants_last_used_workspace_id_fkey"
            columns: ["last_used_workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_tenants_last_used_workspace_id_fkey"
            columns: ["last_used_workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_tenants_last_used_workspace_id_fkey"
            columns: ["last_used_workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_tenants_last_used_workspace_id_fkey"
            columns: ["last_used_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "voice_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "voice_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "voice_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "voice_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "voice_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
      voice_call_records: {
        Row: {
          analysis: Json | null
          call_type: string
          campaign_id: string | null
          cost: number | null
          created_at: string
          customer_name: string | null
          customer_number: string | null
          duration_seconds: number | null
          ended_at: string | null
          failure_reason: string | null
          id: string
          lead_id: string | null
          outcome: string | null
          phone_number_id: string | null
          provider_call_id: string | null
          recording_url: string | null
          started_at: string | null
          status: string
          summary: string | null
          tenant_id: string
          transcript: string | null
          updated_at: string
          voice_agent_id: string | null
          workspace_id: string
        }
        Insert: {
          analysis?: Json | null
          call_type?: string
          campaign_id?: string | null
          cost?: number | null
          created_at?: string
          customer_name?: string | null
          customer_number?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          failure_reason?: string | null
          id?: string
          lead_id?: string | null
          outcome?: string | null
          phone_number_id?: string | null
          provider_call_id?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          tenant_id: string
          transcript?: string | null
          updated_at?: string
          voice_agent_id?: string | null
          workspace_id: string
        }
        Update: {
          analysis?: Json | null
          call_type?: string
          campaign_id?: string | null
          cost?: number | null
          created_at?: string
          customer_name?: string | null
          customer_number?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          failure_reason?: string | null
          id?: string
          lead_id?: string | null
          outcome?: string | null
          phone_number_id?: string | null
          provider_call_id?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          tenant_id?: string
          transcript?: string | null
          updated_at?: string
          voice_agent_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_records_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_lead_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_records_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "voice_phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_records_voice_agent_id_fkey"
            columns: ["voice_agent_id"]
            isOneToOne: false
            referencedRelation: "voice_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_phone_numbers: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_default: boolean
          phone_number: string
          provider: string
          provider_number_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_default?: boolean
          phone_number: string
          provider?: string
          provider_number_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_default?: boolean
          phone_number?: string
          provider?: string
          provider_number_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      worker_tick_metrics: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          jobs_claimed: number | null
          jobs_failed: number | null
          jobs_processed: number | null
          jobs_succeeded: number | null
          jobs_throttled: number | null
          lock_contention_count: number | null
          queue_depth_at_start: number | null
          tenant_jobs: Json | null
          tick_completed_at: string | null
          tick_duration_ms: number | null
          tick_started_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          jobs_claimed?: number | null
          jobs_failed?: number | null
          jobs_processed?: number | null
          jobs_succeeded?: number | null
          jobs_throttled?: number | null
          lock_contention_count?: number | null
          queue_depth_at_start?: number | null
          tenant_jobs?: Json | null
          tick_completed_at?: string | null
          tick_duration_ms?: number | null
          tick_started_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          jobs_claimed?: number | null
          jobs_failed?: number | null
          jobs_processed?: number | null
          jobs_succeeded?: number | null
          jobs_throttled?: number | null
          lock_contention_count?: number | null
          queue_depth_at_start?: number | null
          tenant_jobs?: Json | null
          tick_completed_at?: string | null
          tick_duration_ms?: number | null
          tick_started_at?: string
          worker_id?: string
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
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
          demo_mode: boolean
          id: string
          is_default: boolean | null
          name: string
          owner_id: string
          platform_certification_hash: string | null
          platform_certification_run_id: string | null
          platform_certification_version: string | null
          platform_certified_at: string | null
          public_form_password_hash: string | null
          settings: Json | null
          slug: string
          stripe_connected: boolean
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          demo_mode?: boolean
          id?: string
          is_default?: boolean | null
          name: string
          owner_id: string
          platform_certification_hash?: string | null
          platform_certification_run_id?: string | null
          platform_certification_version?: string | null
          platform_certified_at?: string | null
          public_form_password_hash?: string | null
          settings?: Json | null
          slug: string
          stripe_connected?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          demo_mode?: boolean
          id?: string
          is_default?: boolean | null
          name?: string
          owner_id?: string
          platform_certification_hash?: string | null
          platform_certification_run_id?: string | null
          platform_certification_version?: string | null
          platform_certified_at?: string | null
          public_form_password_hash?: string | null
          settings?: Json | null
          slug?: string
          stripe_connected?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_campaign_dashboard_metrics: {
        Row: {
          created_at: string | null
          delivered_or_sent: number | null
          failed: number | null
          outbox_total: number | null
          provider_ids: number | null
          run_id: string | null
          run_status: string | null
          tenant_id: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      v_campaign_metrics_gated: {
        Row: {
          bounce_count: number | null
          campaign_id: string | null
          clicks: number | null
          comments: number | null
          conversions: number | null
          cost: number | null
          created_at: string | null
          data_mode: Database["public"]["Enums"]["data_mode"] | null
          delivered_count: number | null
          engagement_rate: number | null
          id: string | null
          impressions: number | null
          is_visible: boolean | null
          last_synced_at: string | null
          likes: number | null
          open_count: number | null
          reply_count: number | null
          revenue: number | null
          sent_count: number | null
          shares: number | null
          unsubscribe_count: number | null
          updated_at: string | null
          video_views: number | null
          workspace_demo_mode: boolean | null
          workspace_id: string | null
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
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
      v_cmo_metrics_by_workspace: {
        Row: {
          campaign_id: string | null
          channel_id: string | null
          clicks: number | null
          conversion_rate: number | null
          conversions: number | null
          cost: number | null
          created_at: string | null
          custom_metrics: Json | null
          data_mode: Database["public"]["Enums"]["data_mode"] | null
          data_quality_status: string | null
          demo_mode: boolean | null
          engagement_rate: number | null
          id: string | null
          impressions: number | null
          metric_type: string | null
          revenue: number | null
          roi: number | null
          snapshot_date: string | null
          stripe_connected: boolean | null
          tenant_id: string | null
          workspace_id: string | null
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
        ]
      }
      v_crm_conversion_funnel: {
        Row: {
          active_deals: number | null
          contacted_leads: number | null
          converted_leads: number | null
          data_quality_status: string | null
          demo_mode: boolean | null
          lead_to_qualified_rate: number | null
          lost_deals: number | null
          lost_leads: number | null
          new_leads: number | null
          overall_conversion_rate: number | null
          qualified_leads: number | null
          qualified_to_won_rate: number | null
          stripe_connected: boolean | null
          tenant_id: string | null
          total_leads: number | null
          won_deals: number | null
          workspace_id: string | null
        }
        Relationships: []
      }
      v_crm_lead_pipeline: {
        Row: {
          company: string | null
          contacted_at: string | null
          converted_at: string | null
          created_at: string | null
          data_mode: Database["public"]["Enums"]["data_mode"] | null
          demo_mode: boolean | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          lost_at: string | null
          qualified_at: string | null
          score: number | null
          source: string | null
          status: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_cmo_metrics_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_conversion_funnel"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_pipeline_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_crm_source_of_truth"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_impressions_clicks_by_workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_by_workspace"
            referencedColumns: ["workspace_id"]
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
      v_crm_pipeline_truth: {
        Row: {
          data_quality_status: string | null
          demo_mode: boolean | null
          lost_count: number | null
          lost_value: number | null
          pipeline_count: number | null
          pipeline_value: number | null
          stripe_connected: boolean | null
          tenant_id: string | null
          verified_won_count: number | null
          won_count: number | null
          won_revenue: number | null
          workspace_id: string | null
        }
        Relationships: []
      }
      v_crm_source_of_truth: {
        Row: {
          active_deals: number | null
          avg_days_to_contact: number | null
          avg_days_to_convert: number | null
          avg_days_to_qualify: number | null
          contacted_leads: number | null
          converted_leads: number | null
          data_quality_status: string | null
          demo_mode: boolean | null
          lead_to_contact_rate: number | null
          lead_to_qualified_rate: number | null
          lost_deals: number | null
          lost_leads: number | null
          new_leads: number | null
          overall_conversion_rate: number | null
          pipeline_value: number | null
          qualified_leads: number | null
          qualified_to_won_rate: number | null
          stripe_connected: boolean | null
          stripe_revenue: number | null
          tenant_id: string | null
          total_deals: number | null
          total_leads: number | null
          verified_won_count: number | null
          win_rate: number | null
          won_deals: number | null
          won_revenue: number | null
          workspace_id: string | null
        }
        Relationships: []
      }
      v_impressions_clicks_by_workspace: {
        Row: {
          analytics_connected: boolean | null
          cmo_clicks: number | null
          cmo_conversions: number | null
          cmo_impressions: number | null
          data_quality_status: string | null
          demo_mode: boolean | null
          email_clicks: number | null
          email_opens: number | null
          email_sends: number | null
          paid_clicks: number | null
          paid_impressions: number | null
          stripe_connected: boolean | null
          tenant_id: string | null
          total_clicks: number | null
          total_impressions: number | null
          workspace_id: string | null
        }
        Relationships: []
      }
      v_revenue_by_workspace: {
        Row: {
          data_quality_status: string | null
          demo_mode: boolean | null
          revenue: number | null
          stripe_connected: boolean | null
          tenant_id: string | null
          workspace_id: string | null
        }
        Relationships: []
      }
      worker_health_summary: {
        Row: {
          avg_tick_duration_ms: number | null
          last_tick_at: string | null
          max_tick_duration_ms: number | null
          seconds_since_last_tick: number | null
          tick_count: number | null
          total_jobs_claimed: number | null
          total_jobs_failed: number | null
          total_jobs_processed: number | null
          total_jobs_succeeded: number | null
          total_jobs_throttled: number | null
          total_lock_contentions: number | null
          worker_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_team_invitation: {
        Args: { _email: string; _user_id: string }
        Returns: Json
      }
      advance_rollout_phase: { Args: { p_phase_id: string }; Returns: Json }
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
      check_campaign_launch_prerequisites: {
        Args: { p_campaign_id: string; p_tenant_id: string }
        Returns: Json
      }
      check_rollout_gate: { Args: { p_gate_id: string }; Returns: Json }
      check_tenant_rate_limit: {
        Args: { p_amount?: number; p_channel: string; p_tenant_id: string }
        Returns: Json
      }
      check_workspace_form_password: {
        Args: { _password: string; _workspace_id: string }
        Returns: boolean
      }
      claim_queued_jobs: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: {
          attempts: number
          created_at: string
          data_mode: Database["public"]["Enums"]["data_mode"]
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          payload: Json
          run_id: string | null
          scheduled_for: string
          status: string
          tenant_id: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clear_load_test_data: { Args: never; Returns: Json }
      complete_campaign_run: { Args: { p_run_id: string }; Returns: Json }
      complete_job: {
        Args: { p_error?: string; p_job_id: string; p_success: boolean }
        Returns: undefined
      }
      content_variant_workspace_access: {
        Args: { variant_asset_id: string }
        Returns: boolean
      }
      crm_log_activity: {
        Args: {
          in_activity_type: string
          in_contact_id: string
          in_lead_id: string
          in_meta: Json
          in_new_status?: string
          in_tenant_id: string
        }
        Returns: string
      }
      crm_map_outcome_to_status: {
        Args: { in_outcome: string }
        Returns: string
      }
      crm_promote_to_customer: {
        Args: {
          in_contact_id: string
          in_lead_id?: string
          in_meta?: Json
          in_tenant_id: string
        }
        Returns: undefined
      }
      crm_upsert_contact_and_lead: {
        Args: {
          in_campaign_id: string
          in_company: string
          in_email: string
          in_first_name: string
          in_job_title: string
          in_last_name: string
          in_phone: string
          in_source: string
          in_tenant_id: string
        }
        Returns: {
          contact_id: string
          lead_id: string
        }[]
      }
      deploy_campaign: { Args: { p_campaign_id: string }; Returns: Json }
      dispatch_outbound_cron: { Args: never; Returns: undefined }
      funnel_stage_workspace_access: {
        Args: { stage_funnel_id: string }
        Returns: boolean
      }
      gc_rate_limit_counters: { Args: never; Returns: undefined }
      get_horizontal_scaling_metrics: {
        Args: { p_window_minutes?: number }
        Returns: Json
      }
      get_load_test_metrics: { Args: never; Returns: Json }
      get_outbox_duplicate_groups: {
        Args: { p_window_hours?: number }
        Returns: number
      }
      get_tenant_metrics_mode: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      get_tenant_rate_limit_status: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      get_user_by_email: {
        Args: { _email: string }
        Returns: {
          email: string
          id: string
        }[]
      }
      get_user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_workspace: {
        Args: { p_user_id: string }
        Returns: {
          is_owner: boolean
          workspace_id: string
          workspace_name: string
        }[]
      }
      get_weekly_cfo_portfolio_summary: {
        Args: never
        Returns: {
          avg_cac_blended: number
          avg_contribution_margin_pct: number
          avg_gross_margin_pct: number
          avg_payback_months: number
          avg_revenue_per_fte: number
          avg_sales_efficiency_ratio: number
          tenants_active: number
          total_econ_actions: number
          total_econ_actions_hurt: number
          total_econ_actions_improved: number
        }[]
      }
      get_weekly_cfo_snapshot: {
        Args: never
        Returns: {
          cac_blended: number
          cfo_enabled: boolean
          cfo_gates_triggered: number
          contribution_margin_pct: number
          econ_actions_hurt: number
          econ_actions_improved: number
          econ_actions_total: number
          gross_margin_pct: number
          payback_months: number
          revenue_per_fte: number
          sales_efficiency_ratio: number
          tenant_id: string
          tenant_name: string
        }[]
      }
      get_workspace_certification: {
        Args: { _workspace_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_campaign_reply_count: {
        Args: { p_campaign_id: string; p_workspace_id: string }
        Returns: undefined
      }
      is_platform_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin_safe: { Args: never; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      is_workspace_certified: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner_or_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner_or_member_sd: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      must_change_password: { Args: { _user_id: string }; Returns: boolean }
      rebuild_campaign_daily_stats: {
        Args: { _date_from: string; _date_to: string; _tenant_id: string }
        Returns: undefined
      }
      record_reply_metric_snapshot: {
        Args: {
          p_campaign_id: string
          p_tenant_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      record_worker_tick: {
        Args: {
          p_error?: string
          p_jobs_claimed: number
          p_jobs_failed: number
          p_jobs_processed: number
          p_jobs_succeeded: number
          p_jobs_throttled: number
          p_lock_contention: number
          p_queue_depth: number
          p_tenant_jobs: Json
          p_tick_started_at: string
          p_worker_id: string
        }
        Returns: string
      }
      recover_stale_jobs: {
        Args: { p_timeout_minutes?: number }
        Returns: number
      }
      resume_sequence_for_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: undefined
      }
      retry_job: { Args: { p_job_id: string }; Returns: boolean }
      run_job_queue_cron: { Args: never; Returns: undefined }
      run_job_queue_parallel: { Args: never; Returns: undefined }
      seed_load_test_jobs: {
        Args: { p_tenant_count?: number; p_total_jobs?: number }
        Returns: Json
      }
      sequence_step_workspace_access: {
        Args: { step_sequence_id: string }
        Returns: boolean
      }
      set_last_used_workspace: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: undefined
      }
      update_campaign_run_status:
        | {
            Args: {
              p_completed_at?: string
              p_error_message?: string
              p_run_id: string
              p_started_at?: string
              p_status: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_completed_at?: string
              p_error_code?: string
              p_error_message?: string
              p_metrics_snapshot?: Json
              p_run_id: string
              p_started_at?: string
              p_status: string
            }
            Returns: Json
          }
      upsert_campaign_daily_stat: {
        Args: {
          p_campaign_id: string
          p_channel: string
          p_day: string
          p_increment?: number
          p_stat_type: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      user_belongs_to_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      user_has_workspace_access: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
      validate_campaign_completion: {
        Args: { p_run_id: string }
        Returns: boolean
      }
      validate_campaign_integrations: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
      weekly_cfo_portfolio_snapshot: {
        Args: never
        Returns: {
          avg_cac_blended: number
          avg_contribution_margin_pct: number
          avg_gross_margin_pct: number
          avg_payback_months: number
          avg_revenue_per_fte: number
          avg_sales_efficiency_ratio: number
          tenants_active: number
          total_econ_actions: number
          total_econ_actions_hurt: number
          total_econ_actions_improved: number
        }[]
      }
      weekly_cfo_snapshot: {
        Args: never
        Returns: {
          cac_blended: number
          contribution_margin_pct: number
          econ_actions_hurt: number
          econ_actions_improved: number
          econ_actions_total: number
          gross_margin_pct: number
          payback_months: number
          revenue_per_fte: number
          sales_efficiency_ratio: number
          tenant_id: string
          tenant_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "sales" | "manager"
      asset_status: "draft" | "review" | "approved" | "live"
      asset_type: "video" | "email" | "voice" | "landing_page" | "website"
      data_mode: "live" | "demo"
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
      data_mode: ["live", "demo"],
    },
  },
} as const
