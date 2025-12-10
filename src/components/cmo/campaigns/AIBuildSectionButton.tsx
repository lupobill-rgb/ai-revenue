/**
 * AI Build Section Button
 * Triggers AI generation for a specific content type
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Loader2 } from 'lucide-react';
import { buildAutopilotCampaign } from '@/lib/cmo/api';
import { toast } from 'sonner';

export type SectionType = 'email' | 'social' | 'landing_page' | 'voice' | 'video' | 'all';

interface AIBuildSectionButtonProps {
  sectionType: SectionType;
  icp?: string;
  offer?: string;
  campaignContext?: {
    vertical?: string;
    goal?: string;
  };
  onComplete?: (result: any) => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

const SECTION_LABELS: Record<SectionType, string> = {
  email: 'emails',
  social: 'social posts',
  landing_page: 'landing pages',
  voice: 'voice scripts',
  video: 'videos',
  all: 'full campaign',
};

export function AIBuildSectionButton({
  sectionType,
  icp,
  offer,
  campaignContext,
  onComplete,
  variant = 'outline',
  size = 'sm',
  className,
}: AIBuildSectionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleBuild = async () => {
    if (!icp && !campaignContext?.goal) {
      toast.error('Please provide campaign context (ICP or goal) first');
      return;
    }

    setLoading(true);
    try {
      const channels = sectionType === 'all' 
        ? ['email', 'social', 'landing_page', 'voice']
        : [sectionType];

      const data = await buildAutopilotCampaign({
        icp: icp || campaignContext?.goal || '',
        offer: offer || campaignContext?.vertical || '',
        channels,
        desiredResult: 'leads',
      });

      toast.success(`AI generated ${SECTION_LABELS[sectionType]} successfully!`);
      onComplete?.(data);
    } catch (error: any) {
      console.error('Error building section:', error);
      toast.error(error.message || 'Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleBuild}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Bot className="h-4 w-4 mr-2" />
          Auto-generate {SECTION_LABELS[sectionType]}
        </>
      )}
    </Button>
  );
}
