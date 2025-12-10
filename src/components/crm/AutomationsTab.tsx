/**
 * Automations Tab Component
 * Manages multi-step automation workflows with various step types
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Mail,
  MessageSquare,
  Clock,
  GitBranch,
  Phone,
  Loader2,
  GripVertical,
  Trash2,
} from 'lucide-react';
import type { AutomationStepType, AutomationStep, AutomationStepConfig } from '@/lib/automation/types';
import { useVoiceAssistants } from '@/hooks/useVoiceAssistants';
import { useOptimizations } from '@/hooks/useOptimizations';
import { format } from 'date-fns';
import { Lightbulb, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface AutomationsTabProps {
  sequenceId: string;
  campaignId?: string;
  steps: AutomationStep[];
  onAddStep: (step: Omit<AutomationStep, 'id' | 'created_at' | 'updated_at'>) => void;
  onDeleteStep: (stepId: string) => void;
  onUpdateStep: (stepId: string, updates: Partial<AutomationStep>) => void;
}

// Recent Optimizations Panel
function RecentOptimizations({ campaignId }: { campaignId?: string }) {
  const { data, loading } = useOptimizations(campaignId);
  
  if (loading) return null;
  if (!data?.length) return null;

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'implemented': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Lightbulb className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Recent AI Optimizations
        </CardTitle>
        <CardDescription className="text-xs">
          AI-generated recommendations for your automation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.slice(0, 5).map((opt) => (
          <div
            key={opt.id}
            className="flex items-start gap-3 p-2 rounded-md bg-background/50 border border-border/50"
          >
            {getStatusIcon(opt.status)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{opt.title}</span>
                {opt.priority && (
                  <Badge variant="outline" className={`text-xs ${getPriorityColor(opt.priority)}`}>
                    {opt.priority}
                  </Badge>
                )}
              </div>
              {opt.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {opt.description}
                </p>
              )}
              <span className="text-xs text-muted-foreground">
                {format(new Date(opt.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const STEP_ICONS: Record<AutomationStepType, React.ElementType> = {
  email: Mail,
  sms: MessageSquare,
  wait: Clock,
  condition: GitBranch,
  voice: Phone,
};

const STEP_COLORS: Record<AutomationStepType, string> = {
  email: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  sms: 'bg-green-500/10 text-green-500 border-green-500/20',
  wait: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  condition: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  voice: 'bg-primary/10 text-primary border-primary/20',
};

// Voice Step Configuration Component
function VoiceStepConfig({
  config,
  onChange,
}: {
  config: AutomationStepConfig;
  onChange: (config: AutomationStepConfig) => void;
}) {
  const { assistants, isLoading } = useVoiceAssistants();

  return (
    <div className="space-y-4">
      {/* Voice Agent Selection */}
      <div className="space-y-2">
        <Label>Voice Agent</Label>
        <Select
          value={config.agent_id || ''}
          onValueChange={(v) => onChange({ ...config, agent_id: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "Loading agents..." : "Select voice agent"} />
          </SelectTrigger>
          <SelectContent>
            {assistants.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
            {assistants.length === 0 && !isLoading && (
              <SelectItem value="" disabled>
                No agents configured
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Select a VAPI or ElevenLabs voice agent
        </p>
      </div>

      {/* Script Template */}
      <div className="space-y-2">
        <Label>Script Template</Label>
        <Textarea
          value={config.script_template || ''}
          onChange={(e) => onChange({ ...config, script_template: e.target.value })}
          placeholder="Enter the call script template...&#10;&#10;Use {{first_name}}, {{company}}, etc. for personalization"
          rows={5}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Define the conversation flow for the AI voice call
        </p>
      </div>

      {/* Retry on No Answer */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="retry-no-answer"
          checked={config.retry_on_no_answer || false}
          onCheckedChange={(checked) =>
            onChange({ ...config, retry_on_no_answer: checked === true })
          }
        />
        <Label htmlFor="retry-no-answer" className="cursor-pointer">
          Retry if no answer?
        </Label>
      </div>

      {/* Max Retries (shown if retry enabled) */}
      {config.retry_on_no_answer && (
        <div className="space-y-2 pl-6">
          <Label>Max Retries</Label>
          <Input
            type="number"
            value={config.max_retries || 2}
            onChange={(e) => onChange({ ...config, max_retries: parseInt(e.target.value) || 2 })}
            min={1}
            max={5}
            className="w-24"
          />
        </div>
      )}

      {/* Max Call Duration */}
      <div className="space-y-2">
        <Label>Max Call Duration (seconds)</Label>
        <Input
          type="number"
          value={config.max_duration_seconds || 300}
          onChange={(e) => onChange({ ...config, max_duration_seconds: parseInt(e.target.value) })}
          min={30}
          max={900}
        />
        <p className="text-xs text-muted-foreground">
          Maximum duration before the call is automatically ended
        </p>
      </div>
    </div>
  );
}

export function AutomationsTab({
  sequenceId,
  campaignId,
  steps,
  onAddStep,
  onDeleteStep,
  onUpdateStep,
}: AutomationsTabProps) {
  const [showAddStep, setShowAddStep] = useState(false);
  const [newStepType, setNewStepType] = useState<AutomationStepType>('email');
  const [newStepConfig, setNewStepConfig] = useState<AutomationStepConfig>({});
  const [delayDays, setDelayDays] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleAddStep = async () => {
    setSaving(true);
    try {
      await onAddStep({
        sequence_id: sequenceId,
        step_type: newStepType,
        step_order: steps.length + 1,
        delay_days: delayDays,
        config: newStepConfig,
      });
      setShowAddStep(false);
      setNewStepType('email');
      setNewStepConfig({});
      setDelayDays(0);
    } finally {
      setSaving(false);
    }
  };

  const renderStepConfigForm = () => {
    switch (newStepType) {
      case 'email':
        return (
          <>
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input
                value={newStepConfig.subject || ''}
                onChange={(e) => setNewStepConfig({ ...newStepConfig, subject: e.target.value })}
                placeholder="Email subject..."
              />
            </div>
            <div className="space-y-2">
              <Label>Email Body</Label>
              <Textarea
                value={newStepConfig.body || ''}
                onChange={(e) => setNewStepConfig({ ...newStepConfig, body: e.target.value })}
                placeholder="Email content..."
                rows={4}
              />
            </div>
          </>
        );

      case 'sms':
        return (
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={newStepConfig.message || ''}
              onChange={(e) => setNewStepConfig({ ...newStepConfig, message: e.target.value })}
              placeholder="SMS message (max 160 chars)..."
              maxLength={160}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {(newStepConfig.message?.length || 0)}/160 characters
            </p>
          </div>
        );

      case 'voice':
        return <VoiceStepConfig config={newStepConfig} onChange={setNewStepConfig} />;

      case 'wait':
        return (
          <div className="space-y-2">
            <Label>Wait Type</Label>
            <Select
              value={newStepConfig.wait_type || 'fixed'}
              onValueChange={(v) => setNewStepConfig({ ...newStepConfig, wait_type: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed Duration</SelectItem>
                <SelectItem value="until_event">Until Event</SelectItem>
                <SelectItem value="best_time">AI Best Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'condition':
        return (
          <>
            <div className="space-y-2">
              <Label>Field to Check</Label>
              <Select
                value={newStepConfig.field || ''}
                onValueChange={(v) => setNewStepConfig({ ...newStepConfig, field: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Lead Status</SelectItem>
                  <SelectItem value="score">Lead Score</SelectItem>
                  <SelectItem value="email_opened">Email Opened</SelectItem>
                  <SelectItem value="link_clicked">Link Clicked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select
                value={newStepConfig.operator || 'equals'}
                onValueChange={(v) => setNewStepConfig({ ...newStepConfig, operator: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Not Equals</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="greater_than">Greater Than</SelectItem>
                  <SelectItem value="less_than">Less Than</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                value={newStepConfig.value || ''}
                onChange={(e) => setNewStepConfig({ ...newStepConfig, value: e.target.value })}
                placeholder="Value to compare..."
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Recent AI Optimizations */}
      <RecentOptimizations campaignId={campaignId} />

      {/* Steps List */}
      <div className="space-y-2">
        {steps.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No automation steps yet. Add your first step below.</p>
          </div>
        ) : (
          steps.map((step, index) => {
            const Icon = STEP_ICONS[step.step_type];
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-4 rounded-lg border ${STEP_COLORS[step.step_type]}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-background">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{step.step_type}</span>
                    {step.delay_days > 0 && (
                      <Badge variant="outline" className="text-xs">
                        +{step.delay_days}d delay
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {step.step_type === 'email' && step.config.subject}
                    {step.step_type === 'sms' && step.config.message?.slice(0, 50)}
                    {step.step_type === 'voice' && `Call with ${step.config.assistant_id || 'AI Assistant'}`}
                    {step.step_type === 'wait' && `Wait ${step.delay_days} days`}
                    {step.step_type === 'condition' && `If ${step.config.field} ${step.config.operator} ${step.config.value}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDeleteStep(step.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      {/* Connecting Line */}
      {steps.length > 0 && (
        <div className="flex justify-center">
          <div className="w-0.5 h-8 bg-border" />
        </div>
      )}

      {/* Add Step Button */}
      <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Step
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Automation Step</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Step Type Selection */}
            <div className="space-y-2">
              <Label>Step Type</Label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(STEP_ICONS) as AutomationStepType[]).map((type) => {
                  const Icon = STEP_ICONS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setNewStepType(type);
                        setNewStepConfig({});
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                        newStepType === type
                          ? STEP_COLORS[type]
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs capitalize">{type}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Delay */}
            <div className="space-y-2">
              <Label>Delay (days after previous step)</Label>
              <Input
                type="number"
                value={delayDays}
                onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)}
                min={0}
                max={365}
              />
            </div>

            {/* Step-specific Config */}
            {renderStepConfigForm()}

            {/* Submit */}
            <Button onClick={handleAddStep} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Step
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
