/**
 * Automation Step Types
 * Defines the various step types available in automation workflows
 */

export type AutomationStepType = 'email' | 'sms' | 'wait' | 'condition' | 'voice';

export interface AutomationStep {
  id: string;
  sequence_id: string;
  step_type: AutomationStepType;
  step_order: number;
  delay_days: number;
  delay_hours?: number;
  config: AutomationStepConfig;
  created_at: string;
  updated_at: string;
}

export interface AutomationStepConfig {
  // Email config
  subject?: string;
  body?: string;
  template_id?: string;
  
  // SMS config
  message?: string;
  
  // Voice config
  assistant_id?: string;
  agent_id?: string; // ElevenLabs agent ID
  script?: string;
  script_template?: string; // Script template for the call
  phone_number_id?: string;
  max_duration_seconds?: number;
  retry_on_no_answer?: boolean; // Retry if no answer
  max_retries?: number;
  
  // Condition config
  field?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value?: string;
  true_branch_id?: string;
  false_branch_id?: string;
  
  // Wait config
  wait_type?: 'fixed' | 'until_event' | 'best_time';
  event_type?: string;
}

export const STEP_TYPE_INFO: Record<AutomationStepType, {
  label: string;
  description: string;
  icon: string;
  color: string;
}> = {
  email: {
    label: 'Email',
    description: 'Send an email to the lead',
    icon: 'mail',
    color: 'text-blue-500',
  },
  sms: {
    label: 'SMS',
    description: 'Send a text message',
    icon: 'message-square',
    color: 'text-green-500',
  },
  wait: {
    label: 'Wait',
    description: 'Pause the sequence for a duration',
    icon: 'clock',
    color: 'text-yellow-500',
  },
  condition: {
    label: 'Condition',
    description: 'Branch based on lead attributes',
    icon: 'git-branch',
    color: 'text-purple-500',
  },
  voice: {
    label: 'AI Voice',
    description: 'Initiate an AI voice call',
    icon: 'phone',
    color: 'text-primary',
  },
};
