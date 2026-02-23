CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
  reported_user_id TEXT REFERENCES users(auth0_id) ON DELETE SET NULL,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(auth0_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created_at ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id ON reports(reported_user_id);
