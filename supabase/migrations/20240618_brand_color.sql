ALTER TABLE bots ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#0d9488';
UPDATE bots SET brand_color = primary_color WHERE brand_color IS NULL AND primary_color IS NOT NULL;
