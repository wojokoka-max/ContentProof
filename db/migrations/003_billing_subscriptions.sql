CREATE TABLE IF NOT EXISTS billing_customers (
  owner_id text PRIMARY KEY,
  stripe_customer_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  stripe_subscription_id text PRIMARY KEY,
  owner_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_price_id text NOT NULL,
  billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_subscriptions_owner_status_idx
  ON billing_subscriptions (owner_id, status, current_period_end DESC);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
