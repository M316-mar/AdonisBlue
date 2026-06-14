-- Add webhook_secret to bots table (where nurse config lives)
ALTER TABLE bots ADD COLUMN IF NOT EXISTS webhook_secret text;
-- Add unique index so lookup by secret is fast and enforced unique
CREATE UNIQUE INDEX IF NOT EXISTS bots_webhook_secret_idx ON bots (webhook_secret) WHERE webhook_secret IS NOT NULL;

-- Track which intakes came via booking software integration
ALTER TABLE intakes ADD COLUMN IF NOT EXISTS came_via_booking boolean DEFAULT false;
