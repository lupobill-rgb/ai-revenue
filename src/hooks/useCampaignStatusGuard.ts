/**
 * useCampaignStatusGuard - Validates campaign status transitions
 * Enforces UX contract: "Completed" only when outbox has terminal states
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StatusValidation {
  isValid: boolean;
  reason?: string;
  terminalCount: number;
  pendingCount: number;
}

export function useCampaignStatusGuard() {
  const [validating, setValidating] = useState(false);
  const [lastValidation, setLastValidation] = useState<StatusValidation | null>(null);

  /**
   * Validates if a campaign run can transition to "completed" status
   * Returns true only if outbox has terminal state entries
   */
  const validateCompletion = useCallback(async (runId: string): Promise<StatusValidation> => {
    setValidating(true);
    
    try {
      // Check for terminal states in outbox
      const { data: terminalData, error: terminalError } = await supabase
        .from("channel_outbox")
        .select("id")
        .eq("run_id", runId)
        .in("status", ["sent", "failed", "skipped"]);

      if (terminalError) throw terminalError;

      // Check for pending states
      const { data: pendingData, error: pendingError } = await supabase
        .from("channel_outbox")
        .select("id")
        .eq("run_id", runId)
        .in("status", ["queued", "pending", "processing"]);

      if (pendingError) throw pendingError;

      const terminalCount = terminalData?.length || 0;
      const pendingCount = pendingData?.length || 0;

      let isValid = false;
      let reason: string | undefined;

      if (terminalCount === 0 && pendingCount === 0) {
        reason = "No outbox entries found. Campaign has not dispatched any messages.";
      } else if (pendingCount > 0) {
        reason = `${pendingCount} message(s) still pending. Wait for all dispatches to complete.`;
      } else if (terminalCount > 0) {
        isValid = true;
        reason = `${terminalCount} message(s) reached terminal state.`;
      }

      const validation: StatusValidation = {
        isValid,
        reason,
        terminalCount,
        pendingCount,
      };

      setLastValidation(validation);
      return validation;
    } catch (error) {
      console.error("Error validating campaign completion:", error);
      const validation: StatusValidation = {
        isValid: false,
        reason: error instanceof Error ? error.message : "Validation failed",
        terminalCount: 0,
        pendingCount: 0,
      };
      setLastValidation(validation);
      return validation;
    } finally {
      setValidating(false);
    }
  }, []);

  /**
   * Checks if a specific status transition is allowed
   */
  const canTransitionTo = useCallback(
    async (runId: string, targetStatus: string): Promise<boolean> => {
      // Only "completed" status requires validation
      if (targetStatus !== "completed") {
        return true;
      }

      const validation = await validateCompletion(runId);
      return validation.isValid;
    },
    [validateCompletion]
  );

  /**
   * Gets the outbox summary for a campaign run
   */
  const getOutboxSummary = useCallback(async (runId: string) => {
    const { data, error } = await supabase
      .from("channel_outbox")
      .select("status")
      .eq("run_id", runId);

    if (error) {
      console.error("Error fetching outbox summary:", error);
      return null;
    }

    const summary = {
      total: data?.length || 0,
      queued: 0,
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    data?.forEach((entry) => {
      const status = entry.status as keyof typeof summary;
      if (status in summary && typeof summary[status] === "number") {
        summary[status]++;
      }
    });

    return summary;
  }, []);

  return {
    validating,
    lastValidation,
    validateCompletion,
    canTransitionTo,
    getOutboxSummary,
  };
}

export default useCampaignStatusGuard;
