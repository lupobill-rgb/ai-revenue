ALTER TABLE prospect_scores
  ADD COLUMN IF NOT EXISTS key_signals text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hypothesized_pain_points text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recommended_angle text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tone_recommendation text DEFAULT '';