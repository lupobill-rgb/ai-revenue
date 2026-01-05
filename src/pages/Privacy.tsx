import { useEffect, useState } from "react";

const PRIVACY_URL = "https://www.ubigrowth.ai/privacy";

const Privacy = () => {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Use replace to avoid polluting browser history with a dead-end route.
    window.location.replace(PRIVACY_URL);

    // If the redirect is blocked for any reason (extensions, browser policy), show a direct link.
    const t = window.setTimeout(() => setShowFallback(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <p className="text-muted-foreground">Redirecting to privacy policy…</p>
        {showFallback && (
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-4"
          >
            Open privacy policy
          </a>
        )}
      </div>
    </div>
  );
};

export default Privacy;

