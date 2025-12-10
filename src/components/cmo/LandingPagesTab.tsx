import { useState } from "react";
import { landingTemplatePresets } from "@/lib/landingTemplates";
import type { LandingPageDraft, LandingSection } from "@/lib/cmo/types";
import { useCMOContext } from "@/contexts/CMOContext";
import {
  generateLandingPageWithAI,
  saveLandingPage,
} from "@/lib/cmo/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Sparkles,
  Save,
  Globe,
  ExternalLink,
  FileText,
  LayoutTemplate,
  Loader2,
} from "lucide-react";

const SECTION_TYPE_OPTIONS: { value: LandingSection["type"]; label: string }[] = [
  { value: "problem_solution", label: "Problem / Solution" },
  { value: "features", label: "Features" },
  { value: "social_proof", label: "Social Proof" },
  { value: "process", label: "Process" },
  { value: "faq", label: "FAQ" },
  { value: "pricing", label: "Pricing" },
  { value: "booking", label: "Booking" },
  { value: "story", label: "Story" },
];

function LandingPagesTab() {
  const { tenantId, workspaceId, isLoading: contextLoading } = useCMOContext();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [draft, setDraft] = useState<LandingPageDraft>(landingTemplatePresets[0]);
  const [loading, setLoading] = useState(false);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);

  if (contextLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Please complete onboarding to manage landing pages.
        </p>
      </div>
    );
  }

  const handleTemplateChange = (idx: number) => {
    setSelectedIndex(idx);
    setDraft(landingTemplatePresets[idx]);
    setPublishUrl(null);
  };

  const handleFieldChange = <K extends keyof LandingPageDraft>(
    key: K,
    value: LandingPageDraft[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSectionChange = (
    idx: number,
    patch: Partial<LandingSection>
  ) => {
    setDraft((prev) => {
      const sections = [...prev.sections];
      sections[idx] = { ...sections[idx], ...patch };
      return { ...prev, sections };
    });
  };

  const handleGenerateWithAI = async () => {
    setLoading(true);
    try {
      const enhanced = await generateLandingPageWithAI(tenantId, draft);
      setDraft(enhanced);
      toast.success("AI enhanced the landing page based on your brand profile.");
    } catch (err) {
      console.error("AI generation error:", err);
      toast.error("Failed to generate with AI. Check logs.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (publish: boolean) => {
    setLoading(true);
    setPublishUrl(null);
    try {
      const result = await saveLandingPage(tenantId, null, draft, publish);
      toast.success(
        publish
          ? "Landing page published successfully."
          : "Landing page saved as draft."
      );
      if (result.published) setPublishUrl(result.url);
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save landing page.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Sidebar - Templates */}
      <aside className="w-full lg:w-64 shrink-0 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="p-3 space-y-1">
                {landingTemplatePresets.map((tpl, idx) => (
                  <button
                    key={tpl.internalName}
                    onClick={() => handleTemplateChange(idx)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      idx === selectedIndex
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {tpl.internalName}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {tpl.templateType}
                    </Badge>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button
            onClick={handleGenerateWithAI}
            disabled={loading}
            variant="secondary"
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Enhance With AI
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={() => handleSave(false)}
              disabled={loading}
              variant="outline"
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={loading}
              className="flex-1"
            >
              <Globe className="h-4 w-4 mr-2" />
              Publish
            </Button>
          </div>
        </div>

        {publishUrl && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">Live URL:</p>
              <a
                href={publishUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {publishUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        )}
      </aside>

      {/* Editor */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Landing Page Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-300px)] pr-4">
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Internal Name</Label>
                  <Input
                    value={draft.internalName}
                    onChange={(e) => handleFieldChange("internalName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input
                    value={draft.urlSlug}
                    onChange={(e) => handleFieldChange("urlSlug", e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Hero Section */}
              <div className="space-y-4">
                <h3 className="font-semibold">Hero Section</h3>
                <div className="space-y-2">
                  <Label>Headline</Label>
                  <Input
                    value={draft.heroHeadline}
                    onChange={(e) => handleFieldChange("heroHeadline", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subheadline</Label>
                  <Textarea
                    value={draft.heroSubheadline}
                    onChange={(e) => handleFieldChange("heroSubheadline", e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Supporting Points (one per line)</Label>
                  <Textarea
                    value={draft.heroSupportingPoints.join("\n")}
                    onChange={(e) =>
                      handleFieldChange(
                        "heroSupportingPoints",
                        e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    rows={3}
                  />
                </div>
              </div>

              <Separator />

              {/* Sections */}
              <div className="space-y-4">
                <h3 className="font-semibold">Sections</h3>
                {draft.sections.map((section, idx) => (
                  <Card key={idx} className="bg-muted/30">
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Heading</Label>
                          <Input
                            value={section.heading}
                            onChange={(e) =>
                              handleSectionChange(idx, { heading: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={section.type}
                            onValueChange={(value) =>
                              handleSectionChange(idx, { type: value as LandingSection["type"] })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SECTION_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Body</Label>
                        <Textarea
                          value={section.body}
                          onChange={(e) =>
                            handleSectionChange(idx, { body: e.target.value })
                          }
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bullets (one per line)</Label>
                        <Textarea
                          value={section.bullets.join("\n")}
                          onChange={(e) =>
                            handleSectionChange(idx, {
                              bullets: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Separator />

              {/* Primary CTA */}
              <div className="space-y-4">
                <h3 className="font-semibold">Primary CTA</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={draft.primaryCtaLabel}
                      onChange={(e) => handleFieldChange("primaryCtaLabel", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={draft.primaryCtaType}
                      onValueChange={(value) =>
                        handleFieldChange("primaryCtaType", value as "form" | "calendar")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="form">Form</SelectItem>
                        <SelectItem value="calendar">Calendar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {draft.primaryCtaType === "form" && draft.formFields.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Form Fields</h4>
                    {draft.formFields.map((field, idx) => (
                      <div key={field.name} className="flex items-center gap-4">
                        <div className="flex-1">
                          <Input
                            value={field.label}
                            onChange={(e) => {
                              const fields = [...draft.formFields];
                              fields[idx] = { ...fields[idx], label: e.target.value };
                              handleFieldChange("formFields", fields);
                            }}
                            placeholder="Field label"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`required-${idx}`}
                            checked={field.required}
                            onCheckedChange={(checked) => {
                              const fields = [...draft.formFields];
                              fields[idx] = { ...fields[idx], required: !!checked };
                              handleFieldChange("formFields", fields);
                            }}
                          />
                          <Label htmlFor={`required-${idx}`} className="text-sm">
                            Required
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="w-full lg:w-96 shrink-0">
        <CardHeader>
          <CardTitle className="text-sm">Preview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <LandingPreview draft={draft} />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function LandingPreview({ draft }: { draft: LandingPageDraft }) {
  return (
    <div className="p-4 space-y-6 text-sm">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 space-y-3">
        <h1 className="text-lg font-bold leading-tight">{draft.heroHeadline}</h1>
        <p className="text-muted-foreground text-sm">{draft.heroSubheadline}</p>
        {draft.heroSupportingPoints.length > 0 && (
          <ul className="space-y-1">
            {draft.heroSupportingPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="text-primary">✓</span>
                {p}
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" className="w-full">
          {draft.primaryCtaLabel}
        </Button>
      </div>

      {/* Sections */}
      {draft.sections.map((section, idx) => (
        <div key={idx} className="space-y-2">
          <h3 className="font-semibold text-sm">{section.heading}</h3>
          {section.body && (
            <p className="text-muted-foreground text-xs">{section.body}</p>
          )}
          {section.bullets.length > 0 && (
            <ul className="space-y-1">
              {section.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground">•</span>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default LandingPagesTab;
