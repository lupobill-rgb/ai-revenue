// useVoiceSetup Hook
// Auto-detect and configure voice agents
// Zero-config experience for users

import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface VoiceSetupStatus {
  ready: boolean
  loading: boolean
  providers: {
    elevenlabs: { connected: boolean; agents: number }
    orchestration: { enabled: boolean }
  }
  capabilities: string[]
  message: string
  action_required: string | null
  error?: string
}

export function useVoiceSetup() {
  const [status, setStatus] = useState<VoiceSetupStatus>({
    ready: false,
    loading: true,
    providers: {
      elevenlabs: { connected: false, agents: 0 },
      orchestration: { enabled: false }
    },
    capabilities: [],
    message: 'Checking voice agent setup...',
    action_required: null
  })

  const checkHealth = async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true, error: undefined }))
      
      const { data, error } = await supabase.functions.invoke('voice-health-check', {
        body: {}
      })
      
      if (error) {
        console.error('Voice health check error:', error)
        throw error
      }
      
      if (data) {
        setStatus({
          ...data,
          loading: false,
          error: undefined
        })
        
        // Auto-setup if needed
        if (data.action_required === 'auto_create_agent') {
          await autoSetup()
        }
      } else {
        throw new Error('No data returned from health check')
      }
      
    } catch (error) {
      console.error('Failed to check voice setup:', error)
      
      // Show a helpful message but don't break the UI
      setStatus(prev => ({
        ...prev,
        loading: false,
        ready: false,
        message: 'Unable to check voice setup. Check console for details.',
        error: error instanceof Error ? error.message : 'Failed to check setup'
      }))
    }
  }

  const autoSetup = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .single()
      
      if (!workspace) return
      
      const { data, error } = await supabase.functions.invoke('auto-setup-voice', {
        body: {
          workspace_id: workspace.id,
          user_id: user?.user?.id
        }
      })
      
      if (!error && data.ready_to_use) {
        // Re-check health after setup
        await checkHealth()
      }
    } catch (error) {
      console.error('Auto-setup failed:', error)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return {
    ...status,
    refresh: checkHealth,
    autoSetup
  }
}
