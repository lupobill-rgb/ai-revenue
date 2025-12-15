import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Mail, Phone, Layout } from "lucide-react";
import { getAssetPlaceholder } from "@/lib/placeholders";

interface AssetPreviewProps {
  type: string;
  previewUrl?: string;
  content: any;
  name: string;
}

const AssetPreview = ({ type, previewUrl, content, name }: AssetPreviewProps) => {
  const renderVideoPreview = () => {
    if (previewUrl && !previewUrl.startsWith("/videos/")) {
      return (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <video
            controls
            className="h-full w-full"
            src={previewUrl}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg">
        <img 
          src={getAssetPlaceholder("video")} 
          alt="Pickleball Video Placeholder"
          className="w-full h-full object-cover"
        />
      </div>
    );
  };

  const renderEmailPreview = () => {
    // Email campaigns should never show an image preview.
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Subject</h3>
          <p className="text-foreground font-medium">
            {content?.subject || "Transform Your Business with AI-Powered Marketing"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Email Body</h3>
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
            {content?.body ? (
              <div
                className="whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: content.body }}
              />
            ) : (
              <div>
                <p className="mb-3">Discover how AI-powered marketing can revolutionize your customer engagement.</p>
                <p className="mb-3">Our cutting-edge technology provides personalized campaigns, real-time analytics, and automated optimization designed to drive results.</p>
                <p className="font-semibold">Start your free trial today and experience the difference.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderVoicePreview = () => {
    return (
      <div className="space-y-4">
        <div className="aspect-video w-full overflow-hidden rounded-lg mb-4">
          <img 
            src={getAssetPlaceholder("voice")} 
            alt="Voice Campaign"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Opening Script</h3>
          <p className="text-foreground whitespace-pre-wrap">
            {content?.opening_script || content?.script?.split('\n\n')?.[0] || "Click 'Generate Content' to create a personalized opening script for your voice campaign."}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Pitch Script</h3>
          <p className="text-foreground whitespace-pre-wrap">
            {content?.pitch_script || content?.script?.split('\n\n')?.[1] || "Click 'Generate Content' to create a personalized pitch script for your voice campaign."}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Objection Handling</h3>
          <p className="text-foreground whitespace-pre-wrap">
            {content?.objection_handling || content?.script?.split('[OBJECTION HANDLING]')?.[1]?.split('\n\n')?.[0] || "Click 'Generate Content' to create objection handling scripts for your voice campaign."}
          </p>
        </div>
      </div>
    );
  };

  const renderLandingPagePreview = () => {
    const hasStructuredContent =
      !!(content?.hero_headline || content?.subheadline || content?.primary_cta_label);
    const hasHeroImage = !!(content?.hero_image_url || previewUrl);

    // If we have structured landing page content, prioritize showing that
    if (hasStructuredContent) {
      return (
        <div className="rounded-lg border border-border overflow-hidden bg-background">
          <div className="aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5">
            <img 
              src={content?.hero_image_url || previewUrl || getAssetPlaceholder("landing_page")} 
              alt="Hero" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center space-y-4 p-8">
            <h2 className="text-3xl font-bold text-foreground">
              {content?.hero_headline || name || "Transform Your Business with AI Marketing"}
            </h2>
            <p className="text-xl text-muted-foreground">
              {content?.subheadline || "Experience intelligent marketing automation designed to drive results"}
            </p>
            <button className="rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
              {content?.primary_cta_label || "Book Your Session"}
            </button>
          </div>
        </div>
      );
    }

    // Fallback to iframe preview when we don't have structured content
    if (previewUrl) {
      return (
        <div className="w-full overflow-hidden rounded-lg border border-border">
          <iframe
            src={previewUrl}
            className="h-[600px] w-full"
            title={`Preview of ${name}`}
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      );
    }

    // Final fallback - use placeholder image
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg">
        <img 
          src={getAssetPlaceholder("landing_page")} 
          alt="Landing Page Placeholder"
          className="w-full h-full object-cover"
        />
      </div>
    );
  };

  return (
    <Card className="border-border bg-card sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          {type === "video" && <Video className="h-5 w-5" />}
          {type === "email" && <Mail className="h-5 w-5" />}
          {type === "voice" && <Phone className="h-5 w-5" />}
          {type === "landing_page" && <Layout className="h-5 w-5" />}
          Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {type === "video" && renderVideoPreview()}
        {type === "email" && renderEmailPreview()}
        {type === "voice" && renderVoicePreview()}
        {type === "landing_page" && renderLandingPagePreview()}
      </CardContent>
    </Card>
  );
};

export default AssetPreview;
