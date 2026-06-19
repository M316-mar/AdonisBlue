ALTER TABLE bots ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
