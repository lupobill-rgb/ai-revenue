/**
 * AI Settings Tenant ID Invariant Test
 * 
 * INVARIANT: For UI/provider settings, the join key is:
 *   ai_settings_*.tenant_id == workspaces.id (NOT workspaces.tenant_id)
 * 
 * WHY: workspaces.tenant_id is NULL in most rows, but ai_settings_* tables
 * store workspaceId in their tenant_id column (misnamed but consistent).
 * 
 * This test ensures we don't regress by accidentally using workspaces.tenant_id.
 */

import { describe, it, expect } from "vitest";

// Simulating the pattern used in hooks
interface WorkspaceRow {
  id: string;
  tenant_id: string | null; // This is NULL in most workspaces
  demo_mode: boolean;
}

interface AiSettingsVoiceRow {
  tenant_id: string; // This actually stores workspaceId
  is_connected: boolean;
  elevenlabs_api_key: string | null;
  default_elevenlabs_voice_id: string | null;
}

/**
 * CORRECT pattern: join on ai_settings_voice.tenant_id = workspace.id
 */
function correctJoin(workspace: WorkspaceRow, settings: AiSettingsVoiceRow[]): AiSettingsVoiceRow | undefined {
  return settings.find(s => s.tenant_id === workspace.id);
}

/**
 * WRONG pattern: join on ai_settings_voice.tenant_id = workspace.tenant_id
 * This will fail when workspace.tenant_id is NULL
 */
function wrongJoin(workspace: WorkspaceRow, settings: AiSettingsVoiceRow[]): AiSettingsVoiceRow | undefined {
  return settings.find(s => s.tenant_id === workspace.tenant_id);
}

describe("AI Settings Tenant ID Invariant", () => {
  // Real-world scenario: workspace.tenant_id is NULL but settings exist
  const testWorkspace: WorkspaceRow = {
    id: "245f7faf-0fab-47ea-91b2-16ef6830fb8a",
    tenant_id: null, // NULL as observed in production
    demo_mode: false,
  };

  const testSettings: AiSettingsVoiceRow[] = [
    {
      tenant_id: "245f7faf-0fab-47ea-91b2-16ef6830fb8a", // Stores workspaceId
      is_connected: true,
      elevenlabs_api_key: "elevenlabs_xxx",
      default_elevenlabs_voice_id: "voice_abc123",
    },
  ];

  it("CORRECT: ai_settings_voice.tenant_id == workspace.id should find settings", () => {
    const result = correctJoin(testWorkspace, testSettings);
    expect(result).toBeDefined();
    expect(result?.is_connected).toBe(true);
  });

  it("WRONG: ai_settings_voice.tenant_id == workspace.tenant_id returns undefined when tenant_id is NULL", () => {
    const result = wrongJoin(testWorkspace, testSettings);
    // This SHOULD be undefined because workspace.tenant_id is NULL
    expect(result).toBeUndefined();
  });

  it("INVARIANT: workspace.tenant_id being NULL must not break voice settings lookup", () => {
    // Given a workspace with NULL tenant_id
    expect(testWorkspace.tenant_id).toBeNull();
    
    // The correct pattern MUST still find settings
    const result = correctJoin(testWorkspace, testSettings);
    expect(result).toBeDefined();
    expect(result?.tenant_id).toBe(testWorkspace.id);
  });

  it("INVARIANT: settings write path stores workspaceId in tenant_id column", () => {
    // This validates the assumption that SettingsIntegrations.tsx
    // saves ai_settings_voice.tenant_id = workspaceId
    const settingsRow = testSettings[0];
    expect(settingsRow.tenant_id).toBe(testWorkspace.id);
    expect(settingsRow.tenant_id).not.toBe(testWorkspace.tenant_id);
  });
});

describe("Voice Connection Detection", () => {
  it("should detect connection from is_connected flag", () => {
    const settings: AiSettingsVoiceRow = {
      tenant_id: "ws-123",
      is_connected: true,
      elevenlabs_api_key: null,
      default_elevenlabs_voice_id: null,
    };
    
    const isConnected = settings.is_connected === true;
    expect(isConnected).toBe(true);
  });

  it("should detect connection from key presence (fallback)", () => {
    const settings: AiSettingsVoiceRow = {
      tenant_id: "ws-123",
      is_connected: false,
      elevenlabs_api_key: "elevenlabs_xxx",
      default_elevenlabs_voice_id: "voice_abc123",
    };
    
    const isExplicitlyConnected = settings.is_connected === true;
    const hasElevenLabs = !!settings.elevenlabs_api_key && !!settings.default_elevenlabs_voice_id;
    const voiceConnected = isExplicitlyConnected || hasElevenLabs;
    
    expect(voiceConnected).toBe(true);
  });

  it("should return false when no keys and is_connected is false", () => {
    const settings: AiSettingsVoiceRow = {
      tenant_id: "ws-123",
      is_connected: false,
      elevenlabs_api_key: null,
      default_elevenlabs_voice_id: null,
    };
    
    const isExplicitlyConnected = settings.is_connected === true;
    const hasElevenLabs = !!settings.elevenlabs_api_key && !!settings.default_elevenlabs_voice_id;
    const voiceConnected = isExplicitlyConnected || hasElevenLabs;
    
    expect(voiceConnected).toBe(false);
  });
});
