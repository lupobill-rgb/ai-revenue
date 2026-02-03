# Voicemail Drop Implementation Status

## Current State: ❌ NOT IMPLEMENTED

### What EXISTS
- **Live Voice Calls** via ElevenLabs (`voice_call_batch` job type)
  - AI-powered conversational calls
  - Uses ElevenLabs agents for voice interactions
  - Creates channel_outbox rows with provider='elevenlabs'
  - Status: ✅ WORKING

### What is MISSING
- **Pre-recorded Voicemail Drops**
  - Drops a pre-recorded audio message directly to voicemail
  - Does NOT ring the phone
  - Typically uses Slybroadcast or Twilio's voicemail detection

## Implementation Required

### Option 1: Slybroadcast Integration
```typescript
async function processVoicemailDropBatch(
  supabase: any,
  job: Job,
  slybroadcastApiKey: string
): Promise<BatchResult> {
  // POST to Slybroadcast API
  // https://www.mobile-sphere.com/gateway/vmb.php
  // Required params: c_uid, c_password, c_phone, c_audio
}
```

### Option 2: Twilio AMD (Answering Machine Detection)
```typescript
// Use Twilio Calls API with AMD
body: new URLSearchParams({
  To: lead.phone,
  From: twilioFromNumber,
  Url: twimlUrl, // TwiML with <Play> for voicemail
  MachineDetection: 'Enable',
  MachineDetectionTimeout: 5,
  AsyncAmd: 'true',
  StatusCallback: callbackUrl,
})
```

## Recommendation
**Implement Slybroadcast** as primary voicemail drop provider:
- Dedicated voicemail drop service
- Higher success rate than AMD
- Lower cost than live calls
- Job type: `voicemail_drop_batch`
- Provider: `slybroadcast`

## Schema Already Supports It
- `channel_outbox.channel` can be `voicemail`
- `channel_outbox.provider` can be `slybroadcast`
- Payload structure: `{ audio_url, phone }`

