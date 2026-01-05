import { useEffect } from "react";

const Privacy = () => {
  useEffect(() => {
    window.location.href = "https://www.ubigrowth.ai/privacy";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirecting to privacy policy...</p>
    </div>
  );
};

export default Privacy;
