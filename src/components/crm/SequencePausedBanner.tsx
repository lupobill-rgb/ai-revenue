import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pause, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SequencePausedBannerProps {
  leadId: string;
  pausedAt: string | null;
  onResume: () => void;
}

export function SequencePausedBanner({ leadId, pausedAt, onResume }: SequencePausedBannerProps) {
  const [resuming, setResuming] = useState(false);

  const handleResume = async () => {
    setResuming(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { error } = await supabase.rpc("resume_sequence_for_lead", {
        _lead_id: leadId,
        _user_id: userData.user.id,
      });

      if (error) throw error;

      toast.success("Sequence resumed");
      onResume();
    } catch (error) {
      console.error("Error resuming sequence:", error);
      toast.error("Failed to resume sequence");
    } finally {
      setResuming(false);
    }
  };

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10 mb-6">
      <Pause className="h-4 w-4 text-amber-500" />
      <AlertDescription className="flex items-center justify-between w-full">
        <span className="text-amber-700 dark:text-amber-400">
          Sequence paused due to reply{pausedAt && ` on ${format(new Date(pausedAt), "MMM d, yyyy")}`}. 
          You can respond manually or resume the sequence.
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleResume}
          disabled={resuming}
          className="ml-4 border-amber-500/50 hover:bg-amber-500/20"
        >
          {resuming ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          Resume Sequence
        </Button>
      </AlertDescription>
    </Alert>
  );
}
