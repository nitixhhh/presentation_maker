-- Supabase / PostgreSQL Schema for AI Presentation Maker

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  amount_inr NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (
    status IN (
      'pending_payment',
      'pending_review',
      'paid',
      'generating',
      'completed',
      'failed',
      'rejected',
      'refund_due'
    )
  ),
  utr TEXT UNIQUE,
  screenshot_url TEXT,
  rejection_reason TEXT,
  deck_id TEXT,
  deck_data JSONB,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for capacity check per day
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
-- Index for quick status lookups by worker
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
-- Unique index on UTR to prevent duplicate submission
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_utr_unique ON orders (utr) WHERE utr IS NOT NULL;

-- Job Queue table for background worker execution
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue (status);

