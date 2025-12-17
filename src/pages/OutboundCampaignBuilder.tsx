import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Mail, 
  Linkedin, 
  Phone,
  Plus,
  Trash2,
  Sparkles,
  Target,
  Users,
  Zap,
  AlertTriangle,
  Settings,
  Rocket
} from "lucide-react";

interface SequenceStep {
  step_order: number;
  step_type: string;
  channel: string;
  delay_days: number;
  message_template: string;
}

const STEP_TYPES = [
  { value: "connect", label: "Connection Request" },
  { value: "follow_up", label: "Follow Up" },
  { value: "bump", label: "Bump" },
  { value: "nudge", label: "Nudge" },
  { value: "booking", label: "Booking Ask" },
];

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "phone", label: "Phone", icon: Phone },
];

const PERSONAS = [
  { value: "founder_ceo", label: "Founders & CEOs" },
  { value: "vp_sales", label: "VP of Sales" },
  { value: "marketing_director", label: "Marketing Directors" },
  { value: "operations", label: "Operations Leaders" },
  { value: "custom", label: "Custom Filter" },
];

export default function OutboundCampaignBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null);

  // Step 1: Campaign Details
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState("");
  const [channels, setChannels] = useState<string[]>(["email"]);

  // Step 2: Target Persona
  const [persona, setPersona] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [companySizeFilter, setCompanySizeFilter] = useState("");
  const [customFilter, setCustomFilter] = useState("");

  // Step 3: Sequence Steps
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([
    { step_order: 1, step_type: "connect", channel: "email", delay_days: 0, message_template: "" },
    { step_order: 2, step_type: "follow_up", channel: "email", delay_days: 3, message_template: "" },
    { step_order: 3, step_type: "bump", channel: "email", delay_days: 5, message_template: "" },
  ]);

  const toggleChannel = (channel: string) => {
    setChannels(prev => 
      prev.includes(channel) 
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  const addStep = () => {
    const newOrder = sequenceSteps.length + 1;
    setSequenceSteps([
      ...sequenceSteps,
      {
        step_order: newOrder,
        step_type: "follow_up",
        channel: channels[0] || "email",
        delay_days: 3,
        message_template: "",
      }
    ]);
  };

  const removeStep = (index: number) => {
    const updated = sequenceSteps.filter((_, i) => i !== index);
    setSequenceSteps(updated.map((s, i) => ({ ...s, step_order: i + 1 })));
  };

  const updateStep = (index: number, field: keyof SequenceStep, value: string | number) => {
    const updated = [...sequenceSteps];
    updated[index] = { ...updated[index], [field]: value };
    setSequenceSteps(updated);
  };

  const generateSequence = async () => {
    if (!campaignName || !objective || !persona) {
      toast({
        title: "Missing info",
        description: "Please complete steps 1 & 2 first",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("outbound-message-gen", {
        body: {
          mode: "sequence",
          campaign_name: campaignName,
          objective,
          persona,
          channels,
          industry: industryFilter,
          company_size: companySizeFilter,
        }
      });

      if (error) throw error;

      if (data?.sequence) {
        setSequenceSteps(data.sequence.map((s: any, i: number) => ({
          step_order: i + 1,
          step_type: s.step_type || "follow_up",
          channel: s.channel || channels[0] || "email",
          delay_days: s.delay_days || 3,
          message_template: s.message || "",
        })));
        toast({ title: "Sequence generated!", description: "Review and edit the steps below" });
      }
    } catch (error) {
      console.error("Error generating sequence:", error);
      toast({
        title: "Generation failed",
        description: "Could not generate sequence. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const saveCampaign = async () => {
    if (!campaignName || channels.length === 0) {
      toast({
        title: "Missing info",
        description: "Please provide a campaign name and select at least one channel",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!workspace) throw new Error("No workspace found");

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("outbound_campaigns")
        .insert({
          workspace_id: workspace.id,
          tenant_id: user.id,
          name: campaignName,
          objective,
          channel: channels[0],
          status: "draft",
          target_persona: persona,
          filters: {
            industry: industryFilter,
            company_size: companySizeFilter,
            custom: customFilter,
          },
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create sequence
      const { data: sequence, error: seqError } = await supabase
        .from("outbound_sequences")
        .insert({
          campaign_id: campaign.id,
          tenant_id: user.id,
          name: `${campaignName} - Primary Sequence`,
          channel: channels[0],
        })
        .select()
        .single();

      if (seqError) throw seqError;

      // Create sequence steps
      const stepsToInsert = sequenceSteps.map(s => ({
        sequence_id: sequence.id,
        tenant_id: user.id,
        step_order: s.step_order,
        step_type: s.step_type,
        delay_days: s.delay_days,
        message_template: s.message_template,
      }));

      const { error: stepsError } = await supabase
        .from("outbound_sequence_steps")
        .insert(stepsToInsert);

      if (stepsError) throw stepsError;

      setSavedCampaignId(campaign.id);
      toast({ title: "Campaign saved as draft", description: "You can now activate it" });
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast({
        title: "Save failed",
        description: "Could not save campaign. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const validateAndActivate = async (campaignId: string) => {
    setActivating(true);
    setValidationErrors([]);
    
    try {
      // Call the validation RPC
      const { data, error } = await supabase.rpc('validate_campaign_integrations', {
        p_campaign_id: campaignId
      });
      
      if (error) throw error;
      
      const result = data as { ok: boolean; errors: string[] };
      
      if (!result.ok) {
        setValidationErrors(result.errors || ['Unknown validation error']);
        toast({
          title: "Cannot activate campaign",
          description: "Please configure the required integrations first",
          variant: "destructive",
        });
        return;
      }
      
      // Validation passed - activate the campaign
      const { error: updateError } = await supabase
        .from('outbound_campaigns')
        .update({ status: 'active' })
        .eq('id', campaignId);
      
      if (updateError) throw updateError;
      
      toast({ title: "Campaign activated!", description: "Your campaign is now live" });
      navigate(`/outbound/campaigns/${campaignId}`);
    } catch (error) {
      console.error("Error activating campaign:", error);
      toast({
        title: "Activation failed",
        description: "Could not activate campaign. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActivating(false);
    }
  };

  const getIntegrationTabLink = (error: string): string => {
    if (error.toLowerCase().includes('email')) return '/settings/integrations?tab=email';
    if (error.toLowerCase().includes('linkedin')) return '/settings/integrations?tab=linkedin';
    if (error.toLowerCase().includes('calendar') || error.toLowerCase().includes('booking')) return '/settings/integrations?tab=calendar';
    if (error.toLowerCase().includes('crm') || error.toLowerCase().includes('webhook')) return '/settings/integrations?tab=crm';
    return '/settings/integrations';
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate("/outbound")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Campaign Builder</h1>
              <p className="text-muted-foreground">Create a new outbound campaign</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
                    step >= s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <Check className="h-5 w-5" /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-20 h-1 mx-2 ${step > s ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Campaign Details */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Campaign Details
                </CardTitle>
                <CardDescription>
                  Define your campaign objective and channels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Q1 Enterprise Outreach"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objective">Objective</Label>
                  <Textarea
                    id="objective"
                    placeholder="e.g., Book discovery calls with VP Sales at mid-market SaaS companies"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Channels</Label>
                  <div className="flex gap-3 flex-wrap">
                    {CHANNELS.map(({ value, label, icon: Icon }) => (
                      <div
                        key={value}
                        onClick={() => toggleChannel(value)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                          channels.includes(value)
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <Checkbox checked={channels.includes(value)} />
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!campaignName}>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Target Persona */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Target Persona
                </CardTitle>
                <CardDescription>
                  Define who you want to reach
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Persona</Label>
                  <Select value={persona} onValueChange={setPersona}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target persona" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSONAS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Industry Filter</Label>
                    <Input
                      placeholder="e.g., SaaS, Healthcare, FinTech"
                      value={industryFilter}
                      onChange={(e) => setIndustryFilter(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Size</Label>
                    <Select value={companySizeFilter} onValueChange={setCompanySizeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10 employees</SelectItem>
                        <SelectItem value="11-50">11-50 employees</SelectItem>
                        <SelectItem value="51-200">51-200 employees</SelectItem>
                        <SelectItem value="201-500">201-500 employees</SelectItem>
                        <SelectItem value="500+">500+ employees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {persona === "custom" && (
                  <div className="space-y-2">
                    <Label>Custom Filter Query</Label>
                    <Textarea
                      placeholder="Describe your custom targeting criteria..."
                      value={customFilter}
                      onChange={(e) => setCustomFilter(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={() => setStep(3)} disabled={!persona}>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Sequence Builder */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Sequence Steps
                    </CardTitle>
                    <CardDescription>
                      Define the touchpoints in your campaign
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={generateSequence} disabled={generating}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generating ? "Generating..." : "AI Generate"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {sequenceSteps.map((s, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Step {s.step_order}</Badge>
                      {sequenceSteps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Step Type</Label>
                        <Select
                          value={s.step_type}
                          onValueChange={(v) => updateStep(index, "step_type", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STEP_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Channel</Label>
                        <Select
                          value={s.channel}
                          onValueChange={(v) => updateStep(index, "channel", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CHANNELS.filter(c => channels.includes(c.value)).map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Delay (days)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={s.delay_days}
                          onChange={(e) => updateStep(index, "delay_days", parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Message Template</Label>
                      <Textarea
                        placeholder="Hi {{first_name}}, I noticed..."
                        value={s.message_template}
                        onChange={(e) => updateStep(index, "message_template", e.target.value)}
                        rows={4}
                      />
                    </div>
                  </div>
                ))}

                <Button variant="outline" onClick={addStep} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Integration Configuration Required</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        {validationErrors.map((err, i) => (
                          <li key={i} className="flex items-center justify-between gap-2">
                            <span>{err}</span>
                            <Link 
                              to={getIntegrationTabLink(err)}
                              className="text-xs underline hover:no-underline whitespace-nowrap"
                            >
                              Configure →
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3">
                        <Link to="/settings/integrations">
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-2" />
                            Go to Settings → Integrations
                          </Button>
                        </Link>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <div className="flex gap-2">
                    {!savedCampaignId ? (
                      <Button onClick={saveCampaign} disabled={saving}>
                        {saving ? "Saving..." : "Save as Draft"}
                        <Check className="h-4 w-4 ml-2" />
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => navigate(`/outbound/campaigns/${savedCampaignId}`)}>
                          View Draft
                        </Button>
                        <Button 
                          onClick={() => validateAndActivate(savedCampaignId)} 
                          disabled={activating}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {activating ? "Validating..." : "Activate Campaign"}
                          <Rocket className="h-4 w-4 ml-2" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
