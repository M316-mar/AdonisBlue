-- Add ongoing flag to offers — when true, offer has no expiry date
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ongoing boolean DEFAULT false;
