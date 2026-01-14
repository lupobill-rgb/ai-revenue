/**
 * Smoke Test: AI Direct Routing Enforcement
 * 
 * Purpose: Prevent regression - ensure user-facing AI uses direct OpenAI paths
 * 
 * This test LOCKS the architectural decision:
 * - AI Chat/Quick Actions MUST use ai-chat-direct
 * - AI Walkthrough MUST use ai-walkthrough-direct
 * - No llmRouter for these user-facing streaming features
 * 
 * If this test fails, it means someone tried to "refactor" the AI routing
 * and will cause 503 BOOT_ERROR in production.
 * 
 * DO NOT REMOVE THIS TEST without architectural review.
 * 
 * See: docs/LLM_ROUTING_ARCHITECTURE.md
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('AI Direct Routing - Architectural Lock', () => {
  const projectRoot = join(__dirname, '..');

  describe('Frontend Components MUST use direct functions', () => {
    it('AIChat.tsx calls ai-chat-direct (not ai-chat or llmRouter)', () => {
      const filePath = join(projectRoot, 'src/components/AIChat.tsx');
      const content = readFileSync(filePath, 'utf-8');

      // MUST call ai-chat-direct
      expect(content).toContain('ai-chat-direct');
      
      // MUST NOT call old ai-chat (uses llmRouter)
      expect(content).not.toMatch(/\/functions\/v1\/ai-chat[^-]/);
      
      // MUST NOT import llmRouter
      expect(content).not.toContain('llmRouter');
    });

    it('AIWalkthrough.tsx calls ai-walkthrough-direct (not ai-walkthrough or llmRouter)', () => {
      const filePath = join(projectRoot, 'src/components/AIWalkthrough.tsx');
      const content = readFileSync(filePath, 'utf-8');

      // MUST call ai-walkthrough-direct
      expect(content).toContain('ai-walkthrough-direct');
      
      // MUST NOT call old ai-walkthrough (uses llmRouter)
      expect(content).not.toMatch(/\/functions\/v1\/ai-walkthrough[^-]/);
      
      // MUST NOT import llmRouter
      expect(content).not.toContain('llmRouter');
    });
  });

  describe('Backend Functions MUST NOT use llmRouter', () => {
    it('ai-chat-direct does NOT import llmRouter', () => {
      const filePath = join(projectRoot, 'supabase/functions/ai-chat-direct/index.ts');
      const content = readFileSync(filePath, 'utf-8');

      // MUST NOT import llmRouter (causes 503)
      expect(content).not.toContain('llmRouter');
      expect(content).not.toContain('runLLM');
      
      // MUST call OpenAI directly
      expect(content).toContain('api.openai.com');
      expect(content).toContain('OPENAI_API_KEY');
    });

    it('ai-walkthrough-direct does NOT import llmRouter', () => {
      const filePath = join(projectRoot, 'supabase/functions/ai-walkthrough-direct/index.ts');
      const content = readFileSync(filePath, 'utf-8');

      // MUST NOT import llmRouter (causes 503)
      expect(content).not.toContain('llmRouter');
      expect(content).not.toContain('runLLM');
      
      // MUST call OpenAI directly
      expect(content).toContain('api.openai.com');
      expect(content).toContain('OPENAI_API_KEY');
    });
  });

  describe('Production Deployment Safety', () => {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ddwqkkiqgjptguzoeohr.supabase.co';
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    it('ai-chat-direct endpoint is accessible', async () => {
      if (!SUPABASE_ANON_KEY) {
        console.warn('⚠️ VITE_SUPABASE_PUBLISHABLE_KEY not set - skipping production check');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat-direct`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:8083',
          'Access-Control-Request-Method': 'POST',
        },
      });

      // MUST return 200 (not 503 BOOT_ERROR)
      expect(response.status).toBe(200);
      expect(response.status).not.toBe(503);
    });

    it('ai-walkthrough-direct endpoint is accessible', async () => {
      if (!SUPABASE_ANON_KEY) {
        console.warn('⚠️ VITE_SUPABASE_PUBLISHABLE_KEY not set - skipping production check');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-walkthrough-direct`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:8083',
          'Access-Control-Request-Method': 'POST',
        },
      });

      // MUST return 200 (not 503 BOOT_ERROR)
      expect(response.status).toBe(200);
      expect(response.status).not.toBe(503);
    });

    it('streaming is enabled (text/event-stream)', async () => {
      if (!SUPABASE_ANON_KEY) {
        console.warn('⚠️ VITE_SUPABASE_PUBLISHABLE_KEY not set - skipping streaming check');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
    }, 10000);
  });

  describe('Architectural Documentation Exists', () => {
    it('LLM_ROUTING_ARCHITECTURE.md exists and is comprehensive', () => {
      const filePath = join(projectRoot, 'docs/LLM_ROUTING_ARCHITECTURE.md');
      const content = readFileSync(filePath, 'utf-8');

      // MUST document the routing decision
      expect(content).toContain('LOCKED');
      expect(content).toContain('ai-chat-direct');
      expect(content).toContain('ai-walkthrough-direct');
      expect(content).toContain('llmRouter');
      expect(content).toContain('503 BOOT_ERROR');
      
      // MUST explain why
      expect(content.length).toBeGreaterThan(1000); // Comprehensive doc
    });
  });
});

/**
 * If these tests fail, it means:
 * 
 * 1. Someone tried to "refactor" AI routing to use llmRouter
 * 2. This WILL cause 503 BOOT_ERROR in production
 * 3. User-facing AI features will break
 * 
 * Before making changes:
 * 1. Read docs/LLM_ROUTING_ARCHITECTURE.md
 * 2. Open an RFC for architectural review
 * 3. Get approval from Tech Lead + Product
 * 4. Use feature flag rollout
 * 
 * DO NOT "just fix it" because it "looks messy."
 */
