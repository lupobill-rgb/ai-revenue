CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'sales',
    'manager'
);
--
-- Name: asset_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_status AS ENUM (
    'draft',
    'review',
    'approved',
    'live'
);
--
-- Name: asset_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_type AS ENUM (
    'video',
    'email',
    'voice',
    'landing_page',
    'website'
);
--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
SET default_table_access_method = heap;
--
-- Name: asset_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    status public.asset_status NOT NULL,
    comments text,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.asset_type NOT NULL,
    status public.asset_status DEFAULT 'draft'::public.asset_status NOT NULL,
    name text NOT NULL,
    description text,
    fal_id text,
    vapi_id text,
    preview_url text,
    segment_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    channel text,
    goal text,
    external_id text,
    content jsonb DEFAULT '{}'::jsonb,
    external_project_url text,
    custom_domain text,
    deployment_status text DEFAULT 'staging'::text
);
ALTER TABLE ONLY public.assets REPLICA IDENTITY FULL;
--
-- Name: business_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    business_name text,
    business_description text,
    unique_selling_points text[],
    competitive_advantages text,
    industry text,
    brand_colors jsonb DEFAULT '{"accent": "", "primary": "", "secondary": ""}'::jsonb,
    brand_fonts jsonb DEFAULT '{"body": "", "heading": ""}'::jsonb,
    brand_voice text,
    brand_tone text,
    logo_url text,
    messaging_pillars text[],
    target_audiences jsonb DEFAULT '{}'::jsonb,
    content_tone text DEFAULT 'professional'::text,
    content_length text DEFAULT 'medium'::text,
    imagery_style text,
    cta_patterns text[],
    preferred_channels text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--
-- Name: campaign_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    conversions integer DEFAULT 0,
    revenue numeric(10,2) DEFAULT 0,
    cost numeric(10,2) DEFAULT 0,
    engagement_rate numeric(5,2) DEFAULT 0,
    sent_count integer DEFAULT 0,
    delivered_count integer DEFAULT 0,
    open_count integer DEFAULT 0,
    bounce_count integer DEFAULT 0,
    unsubscribe_count integer DEFAULT 0,
    shares integer DEFAULT 0,
    comments integer DEFAULT 0,
    likes integer DEFAULT 0,
    video_views integer DEFAULT 0,
    last_synced_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    channel text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    deployed_at timestamp with time zone,
    external_campaign_id text,
    target_audience jsonb,
    budget_allocated numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--
-- Name: content_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vertical text NOT NULL,
    template_type text NOT NULL,
    template_name text NOT NULL,
    subject_line text,
    content text NOT NULL,
    tone text,
    target_audience text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    conversion_rate numeric DEFAULT 0,
    impressions integer DEFAULT 0,
    optimization_version integer DEFAULT 1,
    last_optimized_at timestamp with time zone,
    optimization_notes text
);
--
-- Name: lead_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    activity_type text NOT NULL,
    description text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    company text,
    job_title text,
    source text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    score integer DEFAULT 0,
    vertical text,
    industry text,
    company_size text,
    campaign_id uuid,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    landing_page_url text,
    notes text,
    tags text[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    assigned_to uuid,
    last_contacted_at timestamp with time zone,
    next_follow_up_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT valid_email CHECK ((email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT valid_score CHECK (((score >= 0) AND (score <= 100)))
);
--
-- Name: segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    targeting_rules jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--
-- Name: social_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    platform text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_expires_at timestamp with time zone,
    account_name text,
    account_id text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_integrations_platform_check CHECK ((platform = ANY (ARRAY['instagram'::text, 'linkedin'::text, 'facebook'::text, 'tiktok'::text])))
);
--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
--
-- Name: asset_approvals asset_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_approvals
    ADD CONSTRAINT asset_approvals_pkey PRIMARY KEY (id);
--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
--
-- Name: business_profiles business_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_pkey PRIMARY KEY (id);
--
-- Name: business_profiles business_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_user_id_key UNIQUE (user_id);
--
-- Name: campaign_metrics campaign_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_metrics
    ADD CONSTRAINT campaign_metrics_pkey PRIMARY KEY (id);
--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);
--
-- Name: content_templates content_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_templates
    ADD CONSTRAINT content_templates_pkey PRIMARY KEY (id);
--
-- Name: content_templates content_templates_template_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_templates
    ADD CONSTRAINT content_templates_template_name_key UNIQUE (template_name);
--
-- Name: lead_activities lead_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_activities
    ADD CONSTRAINT lead_activities_pkey PRIMARY KEY (id);
--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
--
-- Name: segments segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segments
    ADD CONSTRAINT segments_pkey PRIMARY KEY (id);
--
-- Name: social_integrations social_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_integrations
    ADD CONSTRAINT social_integrations_pkey PRIMARY KEY (id);
--
-- Name: social_integrations social_integrations_user_id_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_integrations
    ADD CONSTRAINT social_integrations_user_id_platform_key UNIQUE (user_id, platform);
--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
--
-- Name: idx_asset_approvals_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_approvals_asset_id ON public.asset_approvals USING btree (asset_id);
--
-- Name: idx_asset_approvals_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_approvals_created_at ON public.asset_approvals USING btree (created_at DESC);
--
-- Name: idx_assets_segment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_segment_id ON public.assets USING btree (segment_id);
--
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_status ON public.assets USING btree (status);
--
-- Name: idx_assets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_type ON public.assets USING btree (type);
--
-- Name: idx_assets_views; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_views ON public.assets USING btree (views DESC);
--
-- Name: idx_campaign_metrics_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_metrics_campaign_id ON public.campaign_metrics USING btree (campaign_id);
--
-- Name: idx_campaigns_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_asset_id ON public.campaigns USING btree (asset_id);
--
-- Name: idx_campaigns_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_channel ON public.campaigns USING btree (channel);
--
-- Name: idx_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);
--
-- Name: idx_content_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_templates_type ON public.content_templates USING btree (template_type);
--
-- Name: idx_content_templates_vertical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_templates_vertical ON public.content_templates USING btree (vertical);
--
-- Name: idx_lead_activities_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_activities_created_at ON public.lead_activities USING btree (created_at DESC);
--
-- Name: idx_lead_activities_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities USING btree (lead_id);
--
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);
--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at DESC);
--
-- Name: idx_leads_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_email ON public.leads USING btree (email);
--
-- Name: idx_leads_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_source ON public.leads USING btree (source);
--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);
--
-- Name: idx_leads_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_tags ON public.leads USING gin (tags);
--
-- Name: idx_leads_vertical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_vertical ON public.leads USING btree (vertical);
--
-- Name: assets update_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
--
-- Name: business_profiles update_business_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_business_profiles_updated_at BEFORE UPDATE ON public.business_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
--
-- Name: campaign_metrics update_campaign_metrics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaign_metrics_updated_at BEFORE UPDATE ON public.campaign_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
--
-- Name: campaigns update_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
--
-- Name: content_templates update_content_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_content_templates_updated_at BEFORE UPDATE ON public.content_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
--
-- Name: segments update_segments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON public.segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
--
-- Name: social_integrations update_social_integrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_social_integrations_updated_at BEFORE UPDATE ON public.social_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
--
-- Name: asset_approvals asset_approvals_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_approvals
    ADD CONSTRAINT asset_approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--
-- Name: asset_approvals asset_approvals_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_approvals
    ADD CONSTRAINT asset_approvals_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
--
-- Name: assets assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--
-- Name: assets assets_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.segments(id) ON DELETE SET NULL;
--
-- Name: campaign_metrics campaign_metrics_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_metrics
    ADD CONSTRAINT campaign_metrics_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
--
-- Name: campaigns campaigns_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
--
-- Name: lead_activities lead_activities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_activities
    ADD CONSTRAINT lead_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--
-- Name: lead_activities lead_activities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_activities
    ADD CONSTRAINT lead_activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
--
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
--
-- Name: leads leads_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;
--
-- Name: leads leads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--
-- Name: leads Admins and managers can delete leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can delete leads" ON public.leads FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));
--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));
--
-- Name: asset_approvals Authenticated users can create approvals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create approvals" ON public.asset_approvals FOR INSERT TO authenticated WITH CHECK (true);
--
-- Name: assets Authenticated users can create assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (true);
--
-- Name: campaign_metrics Authenticated users can create campaign metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create campaign metrics" ON public.campaign_metrics FOR INSERT WITH CHECK (true);
--
-- Name: campaigns Authenticated users can create campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create campaigns" ON public.campaigns FOR INSERT WITH CHECK (true);
--
-- Name: segments Authenticated users can create segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create segments" ON public.segments FOR INSERT TO authenticated WITH CHECK (true);
--
-- Name: content_templates Authenticated users can create templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create templates" ON public.content_templates FOR INSERT WITH CHECK (true);
--
-- Name: assets Authenticated users can delete assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete assets" ON public.assets FOR DELETE TO authenticated USING (true);
--
-- Name: campaign_metrics Authenticated users can delete campaign metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete campaign metrics" ON public.campaign_metrics FOR DELETE USING (true);
--
-- Name: campaigns Authenticated users can delete campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete campaigns" ON public.campaigns FOR DELETE USING (true);
--
-- Name: segments Authenticated users can delete segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete segments" ON public.segments FOR DELETE TO authenticated USING (true);
--
-- Name: content_templates Authenticated users can delete templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete templates" ON public.content_templates FOR DELETE USING (true);
--
-- Name: assets Authenticated users can update assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update assets" ON public.assets FOR UPDATE TO authenticated USING (true);
--
-- Name: campaign_metrics Authenticated users can update campaign metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update campaign metrics" ON public.campaign_metrics FOR UPDATE USING (true);
--
-- Name: campaigns Authenticated users can update campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update campaigns" ON public.campaigns FOR UPDATE USING (true);
--
-- Name: segments Authenticated users can update segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update segments" ON public.segments FOR UPDATE TO authenticated USING (true);
--
-- Name: content_templates Authenticated users can update templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update templates" ON public.content_templates FOR UPDATE USING (true);
--
-- Name: asset_approvals Authenticated users can view all approvals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all approvals" ON public.asset_approvals FOR SELECT TO authenticated USING (true);
--
-- Name: assets Authenticated users can view all assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all assets" ON public.assets FOR SELECT TO authenticated USING (true);
--
-- Name: campaign_metrics Authenticated users can view all campaign metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all campaign metrics" ON public.campaign_metrics FOR SELECT USING (true);
--
-- Name: campaigns Authenticated users can view all campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all campaigns" ON public.campaigns FOR SELECT USING (true);
--
-- Name: segments Authenticated users can view all segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all segments" ON public.segments FOR SELECT TO authenticated USING (true);
--
-- Name: content_templates Authenticated users can view all templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all templates" ON public.content_templates FOR SELECT USING (true);
--
-- Name: lead_activities Sales can create activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can create activities" ON public.lead_activities FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'sales'::public.app_role)));
--
-- Name: leads Sales can create leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can create leads" ON public.leads FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'sales'::public.app_role)));
--
-- Name: leads Sales can update their assigned leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can update their assigned leads" ON public.leads FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role) OR (assigned_to = auth.uid())));
--
-- Name: lead_activities Sales team can view activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales team can view activities" ON public.lead_activities FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'sales'::public.app_role)));
--
-- Name: leads Sales team can view all leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales team can view all leads" ON public.leads FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'sales'::public.app_role)));
--
-- Name: business_profiles Users can create their own business profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own business profile" ON public.business_profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));
--
-- Name: business_profiles Users can delete their own business profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own business profile" ON public.business_profiles FOR DELETE USING ((auth.uid() = user_id));
--
-- Name: social_integrations Users can delete their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own integrations" ON public.social_integrations FOR DELETE USING ((auth.uid() = user_id));
--
-- Name: social_integrations Users can insert their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own integrations" ON public.social_integrations FOR INSERT WITH CHECK ((auth.uid() = user_id));
--
-- Name: business_profiles Users can update their own business profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own business profile" ON public.business_profiles FOR UPDATE USING ((auth.uid() = user_id));
--
-- Name: social_integrations Users can update their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own integrations" ON public.social_integrations FOR UPDATE USING ((auth.uid() = user_id));
--
-- Name: business_profiles Users can view their own business profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own business profile" ON public.business_profiles FOR SELECT USING ((auth.uid() = user_id));
--
-- Name: social_integrations Users can view their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own integrations" ON public.social_integrations FOR SELECT USING ((auth.uid() = user_id));
--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));
--
-- Name: asset_approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_approvals ENABLE ROW LEVEL SECURITY;
--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
--
-- Name: business_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
--
-- Name: campaign_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;
--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
--
-- Name: content_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;
--
-- Name: lead_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
--
-- Name: segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
--
-- Name: social_integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_integrations ENABLE ROW LEVEL SECURITY;
--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
--
-- PostgreSQL database dump complete
--;
