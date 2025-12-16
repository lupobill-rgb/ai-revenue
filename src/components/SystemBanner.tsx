import { AlertTriangle } from "lucide-react";

const SystemBanner = () => {
  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      <span>We are experiencing challenges with upstream providers. We will keep you updated.</span>
    </div>
  );
};

export default SystemBanner;
