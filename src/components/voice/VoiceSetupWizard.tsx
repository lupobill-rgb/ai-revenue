/**
 * Voice Setup Wizard
 * Displayed when tenant has no phone numbers configured
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Settings, ExternalLink, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VoiceSetupWizardProps {
  onAddNumber: (data: { phone_number: string; display_name: string; provider: string }) => Promise<any>;
  isAdding?: boolean;
}

export function VoiceSetupWizard({ onAddNumber, isAdding }: VoiceSetupWizardProps) {
  const [step, setStep] = useState<'intro' | 'add'>('intro');
  const [provider, setProvider] = useState('vapi');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async () => {
    if (!phoneNumber || !displayName) return;
    try {
      await onAddNumber({ phone_number: phoneNumber, display_name: displayName, provider });
      setPhoneNumber('');
      setDisplayName('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (step === 'intro') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Phone className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Connect Voice Provider</CardTitle>
          <CardDescription className="text-base mt-2">
            To make and receive calls, you need to connect a voice provider and add a phone number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Voice calling requires a VAPI or ElevenLabs account. You'll need to configure your API keys in Settings first.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStep('add')}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">I have a phone number</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add an existing VAPI or Twilio number
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors opacity-60">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <ExternalLink className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">Get a new number</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Coming soon: provision via VAPI
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center pt-4">
            <Button variant="outline" asChild>
              <a href="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configure Voice Settings
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Add Phone Number</CardTitle>
        <CardDescription>
          Enter your voice provider phone number details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vapi">VAPI</SelectItem>
              <SelectItem value="twilio">Twilio</SelectItem>
              <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Phone Number</Label>
          <Input
            placeholder="+1 (555) 123-4567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Display Name</Label>
          <Input
            placeholder="Sales Line"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={() => setStep('intro')} className="flex-1">
            Back
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!phoneNumber || !displayName || isAdding}
            className="flex-1"
          >
            {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Number
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
