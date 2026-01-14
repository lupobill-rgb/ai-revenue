-- Create storage bucket for CMO campaign assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cmo-assets',
  'cmo-assets',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);
-- RLS policies for cmo-assets bucket
CREATE POLICY "Users can view their tenant assets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cmo-assets' 
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.user_tenants WHERE user_id = auth.uid()
  )
);
CREATE POLICY "Users can upload tenant assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cmo-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.user_tenants WHERE user_id = auth.uid()
  )
);
CREATE POLICY "Users can update their tenant assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cmo-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.user_tenants WHERE user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete their tenant assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cmo-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.user_tenants WHERE user_id = auth.uid()
  )
);
