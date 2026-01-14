-- Update RLS policies to be workspace-scoped for tables that have workspace_id

-- DEALS: Update to workspace-scoped
DROP POLICY IF EXISTS "Authenticated users can create deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can delete deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can update deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can view all deals" ON public.deals;
CREATE POLICY "Users can view workspace deals" ON public.deals
FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace deals" ON public.deals
FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace deals" ON public.deals
FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace deals" ON public.deals
FOR DELETE USING (user_has_workspace_access(workspace_id));
-- TASKS: Update to workspace-scoped
DROP POLICY IF EXISTS "Authenticated users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON public.tasks;
CREATE POLICY "Users can view workspace tasks" ON public.tasks
FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace tasks" ON public.tasks
FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace tasks" ON public.tasks
FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace tasks" ON public.tasks
FOR DELETE USING (user_has_workspace_access(workspace_id));
-- EMAIL_SEQUENCES: Update to workspace-scoped
DROP POLICY IF EXISTS "Authenticated users can create sequences" ON public.email_sequences;
DROP POLICY IF EXISTS "Authenticated users can delete sequences" ON public.email_sequences;
DROP POLICY IF EXISTS "Authenticated users can update sequences" ON public.email_sequences;
DROP POLICY IF EXISTS "Authenticated users can view all sequences" ON public.email_sequences;
CREATE POLICY "Users can view workspace sequences" ON public.email_sequences
FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace sequences" ON public.email_sequences
FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace sequences" ON public.email_sequences
FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace sequences" ON public.email_sequences
FOR DELETE USING (user_has_workspace_access(workspace_id));
-- SEQUENCE_ENROLLMENTS: Update to workspace-scoped
DROP POLICY IF EXISTS "Authenticated users can create enrollments" ON public.sequence_enrollments;
DROP POLICY IF EXISTS "Authenticated users can delete enrollments" ON public.sequence_enrollments;
DROP POLICY IF EXISTS "Authenticated users can update enrollments" ON public.sequence_enrollments;
DROP POLICY IF EXISTS "Authenticated users can view all enrollments" ON public.sequence_enrollments;
CREATE POLICY "Users can view workspace enrollments" ON public.sequence_enrollments
FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace enrollments" ON public.sequence_enrollments
FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace enrollments" ON public.sequence_enrollments
FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace enrollments" ON public.sequence_enrollments
FOR DELETE USING (user_has_workspace_access(workspace_id));
-- SEGMENTS: Update to workspace-scoped
DROP POLICY IF EXISTS "Authenticated users can create segments" ON public.segments;
DROP POLICY IF EXISTS "Authenticated users can delete segments" ON public.segments;
DROP POLICY IF EXISTS "Authenticated users can update segments" ON public.segments;
DROP POLICY IF EXISTS "Authenticated users can view all segments" ON public.segments;
CREATE POLICY "Users can view workspace segments" ON public.segments
FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace segments" ON public.segments
FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace segments" ON public.segments
FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace segments" ON public.segments
FOR DELETE USING (user_has_workspace_access(workspace_id));
-- CONTENT_TEMPLATES: Update to workspace-scoped
DROP POLICY IF EXISTS "Authenticated users can create templates" ON public.content_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON public.content_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON public.content_templates;
DROP POLICY IF EXISTS "Authenticated users can view all templates" ON public.content_templates;
CREATE POLICY "Users can view workspace templates" ON public.content_templates
FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace templates" ON public.content_templates
FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace templates" ON public.content_templates
FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace templates" ON public.content_templates
FOR DELETE USING (user_has_workspace_access(workspace_id));
-- CAMPAIGN_METRICS: Update to workspace-scoped
DROP POLICY IF EXISTS "Authenticated users can create campaign metrics" ON public.campaign_metrics;
DROP POLICY IF EXISTS "Authenticated users can delete campaign metrics" ON public.campaign_metrics;
DROP POLICY IF EXISTS "Authenticated users can update campaign metrics" ON public.campaign_metrics;
DROP POLICY IF EXISTS "Authenticated users can view all campaign metrics" ON public.campaign_metrics;
CREATE POLICY "Users can view workspace metrics" ON public.campaign_metrics
FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace metrics" ON public.campaign_metrics
FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace metrics" ON public.campaign_metrics
FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace metrics" ON public.campaign_metrics
FOR DELETE USING (user_has_workspace_access(workspace_id));
