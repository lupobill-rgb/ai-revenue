/**
 * Smoke Test: AI Quick Actions End-to-End
 * 
 * Purpose: Prevent regression of the AI Quick Actions + Chat Widget flow
 * 
 * This test verifies:
 * 1. Edge Function responds to OPTIONS (CORS)
 * 2. Edge Function accepts POST requests
 * 3. OpenAI streaming works
 * 4. No authentication errors (we disabled auth for debugging)
 * 
 * Run: npm test tests/smoke-ai-quick-actions.test.ts
 */

import { describe, it, expect } from 'vitest';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ddwqkkiqgjptguzoeohr.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ai-chat-direct`;

describe('AI Quick Actions - Smoke Test', () => {
  it('should handle CORS preflight (OPTIONS)', async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8083',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,apikey',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('should accept POST request and return 200', async () => {
    if (!SUPABASE_ANON_KEY) {
      console.warn('⚠️ VITE_SUPABASE_PUBLISHABLE_KEY not set - skipping test');
      return;
    }

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test message' }],
        context: { businessName: 'Test Co' },
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
  });

  it('should stream OpenAI response (SSE format)', async () => {
    if (!SUPABASE_ANON_KEY) {
      console.warn('⚠️ VITE_SUPABASE_PUBLISHABLE_KEY not set - skipping test');
      return;
    }

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say "test" and nothing else' }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toBeTruthy();

    // Read first chunk to verify streaming works
    const reader = response.body!.getReader();
    const { done, value } = await reader.read();
    
    expect(done).toBe(false);
    expect(value).toBeTruthy();
    
    const text = new TextDecoder().decode(value);
    expect(text).toContain('data:'); // SSE format
    
    reader.cancel(); // Close stream
  }, 10000); // 10s timeout for OpenAI

  it('should NOT return 503 BOOT_ERROR', async () => {
    // This was the bug - function crashed on startup
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY || 'test-key',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    expect(response.status).not.toBe(503);
  });

  it('should have OPENAI_API_KEY configured (returns 500 if missing)', async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY || 'test-key',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    // Should NOT return 500 with "OPENAI_API_KEY not set" error
    if (response.status === 500) {
      const error = await response.json();
      expect(error.error).not.toContain('OPENAI_API_KEY');
    }
  });
});
