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
          <a 
            href="https://www.ubigrowth.ai/privacy" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground/60 hover:text-primary transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;