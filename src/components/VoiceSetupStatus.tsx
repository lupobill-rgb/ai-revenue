// Voice Setup Status Component
// Shows auto-detected voice agent status
// Zero-config - just displays what's available

import { useVoiceSetup } from '@/hooks/useVoiceSetup'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, Phone, Zap, Brain, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function VoiceSetupStatus() {
  const { ready, loading, providers, capabilities, message, error, refresh } = useVoiceSetup()

  if (loading) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Detecting voice agents...</AlertTitle>
        <AlertDescription>Checking your configuration</AlertDescription>
      </Alert>
    )
  }

  // If there's an error, show a simplified fallback
  if (error) {
    return (
      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800">Voice Setup Status</AlertTitle>
        <AlertDescription className="text-yellow-700">
          <p>{message}</p>
          <div className="mt-3 flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={refresh}
            >
              Try Again
            </Button>
            <Button 
              variant="link" 
              size="sm"
              asChild
            >
              <a 
                href="https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/functions"
                target="_blank"
                rel="noopener noreferrer"
              >
                Check Functions →
              </a>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {ready ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Voice Agents Ready
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-yellow-500" />
                  Setup Required
                </>
              )}
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={refresh}
          >
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Provider Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Connected Providers</h4>
          <div className="flex flex-wrap gap-2">
            {providers.elevenlabs.connected && (
              <Badge variant="default" className="gap-1">
                <Phone className="h-3 w-3" />
                ElevenLabs ({providers.elevenlabs.agents} agents)
              </Badge>
            )}
            {providers.orchestration.enabled && (
              <Badge variant="default" className="gap-1">
                <Brain className="h-3 w-3" />
                Smart Routing
              </Badge>
            )}
            {!providers.elevenlabs.connected && 
             !providers.orchestration.enabled && (
              <Badge variant="outline">No providers configured</Badge>
            )}
          </div>
        </div>

        {/* Capabilities */}
        {capabilities.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Available Capabilities</h4>
            <div className="flex flex-wrap gap-2">
              {capabilities.map((capability, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  <Zap className="h-3 w-3" />
                  {capability}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Ready State Message */}
        {ready ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Ready to Go!</AlertTitle>
            <AlertDescription className="text-green-700">
              Just select leads and click "Send" - the system automatically chooses
              the best channel for each lead (voice call, voicemail, SMS, or email).
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertTitle className="text-yellow-800">Configuration Needed</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Add your voice provider API keys to enable voice campaigns.
              <br />
              <a 
                href="https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/settings/functions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline mt-2 inline-block"
              >
                Configure API Keys →
              </a>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for dashboards
export function VoiceSetupBadge() {
  const { ready, loading, providers } = useVoiceSetup()

  if (loading) {
    return (
      <Badge variant="outline">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Checking...
      </Badge>
    )
  }

  if (ready) {
    const providerCount = providers.elevenlabs.connected ? 1 : 0
    
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {providerCount} provider{providerCount !== 1 ? 's' : ''} ready
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="h-3 w-3" />
      Setup required
    </Badge>
  )
}
