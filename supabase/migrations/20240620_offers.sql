CREATE TABLE IF NOT EXISTS offers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id text NOT NULL,
  title text NOT NULL,
  description text,
  discount_type text DEFAULT 'percentage',
  discount_value numeric,
  service_name text,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nurses see own offers" ON offers
  FOR ALL USING (auth.uid()::text = nurse_id);
