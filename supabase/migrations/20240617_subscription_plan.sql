-- Add subscription / plan columns to bots table
-- trial_ends_at uses a DB DEFAULT so it is set automatically on INSERT
-- and is not overwritten on UPDATE when the field is absent from the payload.

ALTER TABLE bots ADD COLUMN IF NOT EXISTS plan text DEFAULT 'trial';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT now() + interval '14 days';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial';

-- Back-fill existing rows that have NULL trial_ends_at
UPDATE bots
SET trial_ends_at = created_at + interval '14 days'
WHERE trial_ends_at IS NULL;
