-- Create voice settings table for VAPI and ElevenLabs configuration
CREATE TABLE IF NOT EXISTS public.ai_settings_voice (
  tenant_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vapi_public_key TEXT,
  vapi_private_key TEXT,
  elevenlabs_api_key TEXT,
  default_vapi_assistant_id TEXT,
  default_elevenlabs_voice_id TEXT DEFAULT 'EXAVITQu4vr4xnSDxMaL',
  elevenlabs_model TEXT DEFAULT 'eleven_multilingual_v2',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_settings_voice ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own voice settings" ON public.ai_settings_voice
  FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Users can insert own voice settings" ON public.ai_settings_voice
  FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Users can update own voice settings" ON public.ai_settings_voice
  FOR UPDATE USING (tenant_id = auth.uid());

-- Update FIELD_LABELS in audit logs
COMMENT ON TABLE public.ai_settings_voice IS 'Voice agent settings for VAPI and ElevenLabs integration';