import Logo from "@/components/Logo";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4">
          <Logo className="h-6" />
          <p className="text-center text-sm text-muted-foreground">
            <span className="text-ubigrowth">UbiGrowth AI</span>{" "}
            <span className="font-medium">v1.0.0</span>
          </p>
          <p className="text-center text-xs text-muted-foreground/60">
            AI-powered marketing automation platform
          </p>
          <div className="flex items-center gap-4">
            <a 
              href="/privacy"
              className="text-xs text-muted-foreground/60 hover:text-primary transition-colors"
            >
              Privacy Policy
            </a>
            <span className="text-muted-foreground/40">•</span>
            <a 
              href="/service"
              className="text-xs text-muted-foreground/60 hover:text-primary transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;