import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

const Privacy = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground">
              We collect information you provide directly to us, such as when you create an account, 
              use our services, or contact us for support. This may include your name, email address, 
              company information, and any other information you choose to provide.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground">
              We use the information we collect to provide, maintain, and improve our services, 
              to communicate with you, to monitor and analyze trends and usage, and to carry out 
              any other purpose for which the information was collected.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Information Sharing</h2>
            <p className="text-muted-foreground">
              We do not share your personal information with third parties except as described 
              in this policy. We may share information with vendors, consultants, and other 
              service providers who need access to such information to carry out work on our behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
            <p className="text-muted-foreground">
              We take reasonable measures to help protect information about you from loss, theft, 
              misuse, unauthorized access, disclosure, alteration, and destruction. All data is 
              encrypted in transit and at rest.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Your Rights</h2>
            <p className="text-muted-foreground">
              You may access, correct, or delete your personal information at any time by 
              contacting us. You may also opt out of receiving promotional communications 
              from us by following the instructions in those messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:privacy@ubigrowth.com" className="text-primary hover:underline">
                privacy@ubigrowth.com
              </a>
            </p>
          </section>

          <p className="text-sm text-muted-foreground/60 mt-8">
            Last updated: January 2026
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
