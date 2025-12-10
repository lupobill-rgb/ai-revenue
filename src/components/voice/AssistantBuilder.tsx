/**
 * AI Assistant Builder Component
 * Create and configure voice assistants with AI-powered generation
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import {
  ASSISTANT_TEMPLATES,
  VOICE_OPTIONS,
  MODEL_OPTIONS,
  type AssistantTemplate,
  type VoiceAssistant,
} from '@/lib/voice/types';

interface AssistantBuilderProps {
  onSubmit: (assistant: Partial<VoiceAssistant>) => Promise<void>;
  onGenerateAI?: (templateId?: string) => Promise<void>;
  isCreating?: boolean;
  isGenerating?: boolean;
}

export function AssistantBuilder({
  onSubmit,
  onGenerateAI,
  isCreating,
  isGenerating,
}: AssistantBuilderProps) {
  const [mode, setMode] = useState<'template' | 'custom' | 'ai'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<AssistantTemplate | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [model, setModel] = useState('gpt-4o');

  const handleTemplateSelect = (template: AssistantTemplate) => {
    setSelectedTemplate(template);
    setName(template.name);
    setFirstMessage(template.firstMessage);
    setSystemPrompt(template.systemPrompt);
    setVoice(template.voiceId);
    setModel(template.model);
  };

  const handleSubmit = async () => {
    await onSubmit({
      name,
      firstMessage,
      systemPrompt,
      voice,
      model,
    });
  };

  const handleAIGenerate = async () => {
    if (onGenerateAI) {
      await onGenerateAI(selectedTemplate?.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Voice Assistant</CardTitle>
        <CardDescription>
          Build a custom AI assistant for your voice campaigns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid grid-cols-3 w-full mb-6">
            <TabsTrigger value="template">From Template</TabsTrigger>
            <TabsTrigger value="custom">Custom Build</TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI Generate
            </TabsTrigger>
          </TabsList>

          {/* Template Selection */}
          <TabsContent value="template" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {ASSISTANT_TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    selectedTemplate?.id === template.id ? 'border-primary ring-1 ring-primary' : ''
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {template.category}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedTemplate && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Select value={voice} onValueChange={setVoice}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICE_OPTIONS.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name} - {v.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODEL_OPTIONS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleSubmit} disabled={isCreating} className="w-full">
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  Create Assistant
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Custom Build */}
          <TabsContent value="custom" className="space-y-4">
            <div className="space-y-2">
              <Label>Assistant Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sales Outreach Agent"
              />
            </div>

            <div className="space-y-2">
              <Label>First Message</Label>
              <Textarea
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                placeholder="The greeting your assistant will use..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Instructions for how the assistant should behave..."
                rows={4}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Voice</Label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} - {v.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isCreating || !name}
              className="w-full"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              Create Assistant
            </Button>
          </TabsContent>

          {/* AI Generate */}
          <TabsContent value="ai" className="space-y-4">
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Wand2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI-Powered Generation</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Our AI will analyze your brand profile and create a custom
                  voice assistant optimized for your business.
                </p>
              </div>

              <div className="space-y-3 max-w-md mx-auto">
                <p className="text-sm text-muted-foreground">
                  Optionally select a template to guide the AI:
                </p>
                <Select
                  value={selectedTemplate?.id || ''}
                  onValueChange={(v) => {
                    const t = ASSISTANT_TEMPLATES.find((t) => t.id === v);
                    setSelectedTemplate(t || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSISTANT_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleAIGenerate}
                disabled={isGenerating}
                size="lg"
                className="mt-4"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate with AI
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
