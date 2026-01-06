/**
 * Email Reply-To Explainer
 * Visual component that clearly shows where replies will go
 */

import { Mail, Reply, ArrowRight, User, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EmailReplyToExplainerProps {
  fromAddress: string;
  replyToAddress: string;
  senderName: string;
}

export function EmailReplyToExplainer({
  fromAddress,
  replyToAddress,
  senderName,
}: EmailReplyToExplainerProps) {
  const isDifferent = fromAddress !== replyToAddress && !!replyToAddress && !!fromAddress;

  return (
    <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
      <h4 className="font-medium text-sm flex items-center gap-2">
        <Reply className="h-4 w-4 text-primary" />
        How Your Emails Work
      </h4>

      <div className="flex items-center gap-3 text-sm">
        {/* Your Company */}
        <div className="flex items-center gap-2 p-2 rounded bg-background border">
          <Building2 className="h-4 w-4 text-primary" />
          <div className="text-left">
            <p className="font-medium">{senderName || "Your Company"}</p>
            <p className="text-xs text-muted-foreground">{fromAddress || "from@email.com"}</p>
          </div>
        </div>

        {/* Arrow to Customer */}
        <div className="flex flex-col items-center">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">sends</span>
        </div>

        {/* Customer */}
        <div className="flex items-center gap-2 p-2 rounded bg-background border">
          <User className="h-4 w-4 text-muted-foreground" />
          <div className="text-left">
            <p className="font-medium">Customer</p>
            <p className="text-xs text-muted-foreground">prospect@company.com</p>
          </div>
        </div>
      </div>

      {/* Reply Flow */}
      <div className="flex items-center gap-3 text-sm pl-[calc(50%-20px)]">
        <div className="flex flex-col items-center">
          <ArrowRight className="h-4 w-4 text-green-500 rotate-180" />
          <span className="text-xs text-green-600">replies to</span>
        </div>

        <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/30">
          <Mail className="h-4 w-4 text-green-500" />
          <div className="text-left">
            <p className="font-medium text-green-700">Reply Inbox</p>
            <p className="text-xs text-green-600">{replyToAddress || "reply@email.com"}</p>
          </div>
        </div>
      </div>

      {isDifferent && (
        <Alert className="mt-3 border-amber-500/30 bg-amber-500/5">
          <AlertDescription className="text-sm text-amber-700">
            <strong>Note:</strong> Your From address ({fromAddress}) is different from your Reply-To 
            address ({replyToAddress}). Customer replies will go to {replyToAddress}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default EmailReplyToExplainer;
