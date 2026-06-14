-- Post reactions
CREATE TABLE IF NOT EXISTS blueroom_post_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES blueroom_posts(id) ON DELETE CASCADE,
  nurse_id text NOT NULL,
  reaction text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, nurse_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS blueroom_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id text NOT NULL,
  type text NOT NULL,
  post_id uuid,
  post_title text,
  actor_name text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blueroom_notifications_nurse_idx ON blueroom_notifications(nurse_id, is_read);

-- View tracking
CREATE TABLE IF NOT EXISTS blueroom_post_views (
  post_id uuid REFERENCES blueroom_posts(id) ON DELETE CASCADE,
  nurse_id text NOT NULL,
  viewed_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, nurse_id)
);

-- Add columns to posts
ALTER TABLE blueroom_posts ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE blueroom_posts ADD COLUMN IF NOT EXISTS view_count int DEFAULT 0;
