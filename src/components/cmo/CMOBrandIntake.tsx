import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  Loader2, 
  Building2, 
  Users, 
  Package, 
  CheckCircle2, 
  Sparkles,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CollectedData {
  brand?: any;
  icp: any[];
  offers: any[];
}

type IntakeStep = 'brand' | 'icp' | 'offers';

interface CMOBrandIntakeProps {
  workspaceId: string;
  onComplete?: () => void;
}

const STEPS: { key: IntakeStep; label: string; icon: React.ReactNode }[] = [
  { key: 'brand', label: 'Brand Profile', icon: <Building2 className="h-4 w-4" /> },
  { key: 'icp', label: 'ICP Segments', icon: <Users className="h-4 w-4" /> },
  { key: 'offers', label: 'Offers', icon: <Package className="h-4 w-4" /> },
];

export function CMOBrandIntake({ workspaceId, onComplete }: CMOBrandIntakeProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<IntakeStep>('brand');
  const [collectedData, setCollectedData] = useState<CollectedData>({ icp: [], offers: [] });
  const [isStarted, setIsStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const parseDataFromResponse = (content: string) => {
    // Parse JSON blocks from AI response
    const brandMatch = content.match(/```json:brand\n([\s\S]*?)\n```/);
    const icpMatch = content.match(/```json:icp\n([\s\S]*?)\n```/);
    const offerMatch = content.match(/```json:offer\n([\s\S]*?)\n```/);

    const newData = { ...collectedData };
    let hasNewData = false;

    if (brandMatch) {
      try {
        newData.brand = JSON.parse(brandMatch[1]);
        hasNewData = true;
      } catch (e) {
        console.error('Failed to parse brand JSON:', e);
      }
    }

    if (icpMatch) {
      try {
        const icpData = JSON.parse(icpMatch[1]);
        newData.icp = [...newData.icp, icpData];
        hasNewData = true;
      } catch (e) {
        console.error('Failed to parse ICP JSON:', e);
      }
    }

    if (offerMatch) {
      try {
        const offerData = JSON.parse(offerMatch[1]);
        newData.offers = [...newData.offers, offerData];
        hasNewData = true;
      } catch (e) {
        console.error('Failed to parse offer JSON:', e);
      }
    }

    if (hasNewData) {
      setCollectedData(newData);
    }

    return { hasNewData, newData };
  };

  const cleanDisplayContent = (content: string) => {
    // Remove JSON blocks from displayed content
    return content
      .replace(/```json:brand\n[\s\S]*?\n```/g, '')
      .replace(/```json:icp\n[\s\S]*?\n```/g, '')
      .replace(/```json:offer\n[\s\S]*?\n```/g, '')
      .trim();
  };

  const streamChat = async (userMessage: string) => {
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cmo-brand-intake`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: newMessages,
            currentStep,
            existingData: collectedData,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages([...newMessages, { role: 'assistant', content: cleanDisplayContent(assistantContent) }]);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Parse any data from the response
      parseDataFromResponse(assistantContent);

    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput('');
    streamChat(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startIntake = () => {
    setIsStarted(true);
    streamChat("Hi! I'm ready to set up my brand profile.");
  };

  const moveToNextStep = () => {
    const currentIndex = STEPS.findIndex(s => s.key === currentStep);
    if (currentIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentIndex + 1].key;
      setCurrentStep(nextStep);
      setMessages([]);
      streamChat(`I'm ready to set up my ${nextStep === 'icp' ? 'ideal customer profiles' : 'product/service offers'}.`);
    }
  };

  const saveAllData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to save');
        return;
      }

      // Save brand profile
      if (collectedData.brand) {
        const { error: brandError } = await supabase
          .from('cmo_brand_profiles')
          .upsert({
            workspace_id: workspaceId,
            created_by: user.id,
            ...collectedData.brand,
          }, { onConflict: 'workspace_id' });

        if (brandError) throw brandError;
      }

      // Save ICP segments
      for (const icp of collectedData.icp) {
        const { error: icpError } = await supabase
          .from('cmo_icp_segments')
          .insert({
            workspace_id: workspaceId,
            created_by: user.id,
            ...icp,
          });

        if (icpError) throw icpError;
      }

      // Save offers
      for (const offer of collectedData.offers) {
        const { error: offerError } = await supabase
          .from('cmo_offers')
          .insert({
            workspace_id: workspaceId,
            created_by: user.id,
            ...offer,
          });

        if (offerError) throw offerError;
      }

      toast.success('Brand knowledge base saved successfully!');
      onComplete?.();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save data');
    }
  };

  const resetIntake = () => {
    setMessages([]);
    setCollectedData({ icp: [], offers: [] });
    setCurrentStep('brand');
    setIsStarted(false);
  };

  if (!isStarted) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">CMO Brand Intake</CardTitle>
          <CardDescription className="text-base max-w-lg mx-auto">
            Let's build your brand knowledge base. I'll guide you through capturing your brand profile, 
            ideal customer profiles, and product/service offers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="flex gap-4">
            {STEPS.map((step, index) => (
              <div key={step.key} className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                  {step.icon}
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
                {index < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
          <Button size="lg" onClick={startIntake} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Start Brand Setup
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] gap-4">
      {/* Progress Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {STEPS.map((step, index) => (
              <div key={step.key} className="flex items-center gap-2">
                <div 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    step.key === currentStep 
                      ? 'bg-primary text-primary-foreground' 
                      : STEPS.findIndex(s => s.key === currentStep) > index
                        ? 'bg-green-500/20 text-green-600'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {STEPS.findIndex(s => s.key === currentStep) > index ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    step.icon
                  )}
                  <span className="font-medium">{step.label}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={resetIntake}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            {currentStep !== 'offers' ? (
              <Button 
                size="sm" 
                onClick={moveToNextStep}
                disabled={currentStep === 'brand' && !collectedData.brand}
              >
                Next Step
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button 
                size="sm" 
                onClick={saveAllData}
                disabled={!collectedData.brand}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Save & Complete
              </Button>
            )}
          </div>
        </div>

        {/* Collected Data Summary */}
        {(collectedData.brand || collectedData.icp.length > 0 || collectedData.offers.length > 0) && (
          <>
            <Separator className="my-3" />
            <div className="flex flex-wrap gap-2">
              {collectedData.brand && (
                <Badge variant="secondary" className="gap-1">
                  <Building2 className="h-3 w-3" />
                  {collectedData.brand.brand_name}
                </Badge>
              )}
              {collectedData.icp.map((icp, i) => (
                <Badge key={i} variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {icp.segment_name}
                </Badge>
              ))}
              {collectedData.offers.map((offer, i) => (
                <Badge key={i} variant="outline" className="gap-1">
                  <Package className="h-3 w-3" />
                  {offer.offer_name}
                </Badge>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              className="min-h-[60px] resize-none"
              disabled={isLoading}
            />
            <Button 
              onClick={handleSend} 
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
