/**
 * Voice Banner Logic Helper
 * 
 * Determines which banner to show on the VoiceAgents page.
 * Order of precedence:
 * 1. DEMO_MODE - when in demo mode
 * 2. UPGRADE_REQUIRED - when 402/paywall detected
 * 3. NO_VOICE_PROVIDER_CONNECTED - when no voice keys configured
 * 4. null - no banner needed
 */

export type VoiceBannerType = 
  | 'DEMO_MODE' 
  | 'UPGRADE_REQUIRED' 
  | 'NO_VOICE_PROVIDER_CONNECTED' 
  | null;

export interface VoiceBannerInput {
  demoMode: boolean;
  voiceConnected: boolean;
  statusCode: number | null;
}

/**
 * Pure function to determine which banner to show.
 * Rules:
 * 1. Demo mode always wins (shows demo banner regardless of errors)
 * 2. 402 shows upgrade banner (paywall)
 * 3. No provider shows setup banner
 * 4. Otherwise no banner
 */
export function getVoiceBannerType({
  demoMode,
  voiceConnected,
  statusCode,
}: VoiceBannerInput): VoiceBannerType {
  // Demo mode takes precedence - users can still explore in demo
  if (demoMode) {
    return 'DEMO_MODE';
  }
  
  // 402/paywall - user needs to upgrade
  if (statusCode === 402) {
    return 'UPGRADE_REQUIRED';
  }
  
  // No voice provider connected
  if (!voiceConnected) {
    return 'NO_VOICE_PROVIDER_CONNECTED';
  }
  
  // All good - no banner needed
  return null;
}

/**
 * Determines if voice actions should be disabled
 */
export function shouldDisableVoiceActions({
  demoMode,
  voiceConnected,
  statusCode,
}: VoiceBannerInput): boolean {
  // In demo mode, actions are enabled for exploration
  if (demoMode) {
    return false;
  }
  
  // Disable if upgrade required or no provider
  return statusCode === 402 || !voiceConnected;
}
