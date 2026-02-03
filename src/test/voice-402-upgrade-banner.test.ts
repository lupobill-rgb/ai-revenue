/**
 * Voice 402/Upgrade Banner Regression Tests
 * 
 * Tests for the banner logic to ensure:
 * 1. Demo mode takes precedence
 * 2. 402 shows upgrade banner
 * 3. No provider shows setup banner
 * 4. Connected + no error shows no banner
 */

import { describe, it, expect } from "vitest";
import { 
  getVoiceBannerType, 
  shouldDisableVoiceActions,
  type VoiceBannerInput 
} from "@/lib/voiceBannerLogic";

type ElevenLabsSettings = {
  is_connected?: boolean | null;
  elevenlabs_api_key?: string | null;
  default_elevenlabs_voice_id?: string | null;
};

const isVoiceConnectedFromSettings = (settings: ElevenLabsSettings) => {
  const isExplicitlyConnected = settings.is_connected === true;
  const hasElevenLabs = !!settings.elevenlabs_api_key && !!settings.default_elevenlabs_voice_id;
  return isExplicitlyConnected || hasElevenLabs;
};

describe("getVoiceBannerType", () => {
  it("returns DEMO_MODE when demoMode=true, even with 402", () => {
    const input: VoiceBannerInput = {
      demoMode: true,
      voiceConnected: false,
      statusCode: 402,
    };
    expect(getVoiceBannerType(input)).toBe("DEMO_MODE");
  });

  it("returns DEMO_MODE when demoMode=true and no provider", () => {
    const input: VoiceBannerInput = {
      demoMode: true,
      voiceConnected: false,
      statusCode: null,
    };
    expect(getVoiceBannerType(input)).toBe("DEMO_MODE");
  });

  it("returns UPGRADE_REQUIRED when demoMode=false and statusCode=402", () => {
    const input: VoiceBannerInput = {
      demoMode: false,
      voiceConnected: true, // Even if connected, 402 wins
      statusCode: 402,
    };
    expect(getVoiceBannerType(input)).toBe("UPGRADE_REQUIRED");
  });

  it("returns NO_VOICE_PROVIDER_CONNECTED when demoMode=false, no 402, not connected", () => {
    const input: VoiceBannerInput = {
      demoMode: false,
      voiceConnected: false,
      statusCode: null,
    };
    expect(getVoiceBannerType(input)).toBe("NO_VOICE_PROVIDER_CONNECTED");
  });

  it("returns null when demoMode=false, no error, and connected", () => {
    const input: VoiceBannerInput = {
      demoMode: false,
      voiceConnected: true,
      statusCode: null,
    };
    expect(getVoiceBannerType(input)).toBe(null);
  });

  it("returns null when demoMode=false, non-402 error, and connected", () => {
    const input: VoiceBannerInput = {
      demoMode: false,
      voiceConnected: true,
      statusCode: 500, // Server error, not paywall
    };
    expect(getVoiceBannerType(input)).toBe(null);
  });

  it("prioritizes 402 over no-provider when both conditions apply", () => {
    const input: VoiceBannerInput = {
      demoMode: false,
      voiceConnected: false,
      statusCode: 402,
    };
    // 402 takes precedence over setup banner
    expect(getVoiceBannerType(input)).toBe("UPGRADE_REQUIRED");
  });
});

describe("shouldDisableVoiceActions", () => {
  it("returns false in demo mode (actions enabled for exploration)", () => {
    expect(shouldDisableVoiceActions({
      demoMode: true,
      voiceConnected: false,
      statusCode: 402,
    })).toBe(false);
  });

  it("returns true when 402 in live mode", () => {
    expect(shouldDisableVoiceActions({
      demoMode: false,
      voiceConnected: true,
      statusCode: 402,
    })).toBe(true);
  });

  it("returns true when not connected in live mode", () => {
    expect(shouldDisableVoiceActions({
      demoMode: false,
      voiceConnected: false,
      statusCode: null,
    })).toBe(true);
  });

  it("returns false when connected and no error in live mode", () => {
    expect(shouldDisableVoiceActions({
      demoMode: false,
      voiceConnected: true,
      statusCode: null,
    })).toBe(false);
  });
});

describe("402 Error Shape Handling", () => {
  it("REGRESSION: exact 402 payload shape triggers upgrade banner", () => {
    // This is the exact error shape from production
    const errorPayload = {
      statusCode: 402,
      message: "Upgrade required",
      error: "PAYWALL",
      subscriptionLimits: { voiceCalls: 0, maxCalls: 100 },
    };

    const input: VoiceBannerInput = {
      demoMode: false,
      voiceConnected: true,
      statusCode: errorPayload.statusCode,
    };

    expect(getVoiceBannerType(input)).toBe("UPGRADE_REQUIRED");
    expect(shouldDisableVoiceActions(input)).toBe(true);
  });
});

describe("Eleven Labs connection detection", () => {
  it("treats key + voice ID as connected", () => {
    const voiceConnected = isVoiceConnectedFromSettings({
      is_connected: false,
      elevenlabs_api_key: "elevenlabs_xxx",
      default_elevenlabs_voice_id: "voice_abc123",
    });

    expect(voiceConnected).toBe(true);
  });

  it("treats missing voice ID as not connected", () => {
    const voiceConnected = isVoiceConnectedFromSettings({
      is_connected: false,
      elevenlabs_api_key: "elevenlabs_xxx",
      default_elevenlabs_voice_id: null,
    });

    expect(voiceConnected).toBe(false);
  });
});
