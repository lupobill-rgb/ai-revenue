-- Add channel column to outbound_sequence_steps for multi-channel sequences
ALTER TABLE outbound_sequence_steps 
ADD COLUMN IF NOT EXISTS channel text DEFAULT 'email';