-- Fix RLS policy on offers table to allow nurses to manage their own offers
DROP POLICY IF EXISTS "Nurses see own offers" ON offers;

CREATE POLICY "Nurses can manage own offers" ON offers
FOR ALL USING (auth.uid()::text = nurse_id)
WITH CHECK (auth.uid()::text = nurse_id);
