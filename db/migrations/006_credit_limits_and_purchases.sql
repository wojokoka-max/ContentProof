CREATE TABLE IF NOT EXISTS credit_purchases (
  stripe_checkout_session_id text PRIMARY KEY,
  owner_id text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  amount_total integer,
  currency text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_purchases_owner_created_idx
  ON credit_purchases (owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION reserve_analysis_quota(
  p_subject_id text,
  p_analysis_id text,
  p_plan text,
  p_input_mode text,
  p_billing_period text
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  limit_value integer,
  purchased_remaining integer,
  reason text,
  bucket_key text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_bucket_key text;
  v_limit integer;
  v_monthly_limit integer;
  v_used integer;
  v_purchased_remaining integer := 0;
  v_monthly_reserved boolean := false;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM analysis_usage
    WHERE subject_id = p_subject_id AND analysis_id = p_analysis_id
  ) THEN
    RETURN QUERY
    SELECT
      true,
      CASE
        WHEN usage_row.bucket_key IS NULL THEN NULL
        ELSE GREATEST(quota_bucket.limit_value - quota_bucket.used, 0)
      END,
      quota_bucket.limit_value,
      COALESCE((
        SELECT GREATEST(credit_bucket.limit_value - credit_bucket.used, 0)
        FROM analysis_quota_buckets AS credit_bucket
        WHERE credit_bucket.subject_id = p_subject_id
          AND credit_bucket.bucket_key = 'credits:purchased'
      ), 0),
      NULL::text,
      usage_row.bucket_key
    FROM analysis_usage AS usage_row
    LEFT JOIN analysis_quota_buckets AS quota_bucket
      ON quota_bucket.subject_id = usage_row.subject_id
      AND quota_bucket.bucket_key = usage_row.bucket_key
    WHERE usage_row.subject_id = p_subject_id
      AND usage_row.analysis_id = p_analysis_id
    LIMIT 1;
    RETURN;
  END IF;

  IF p_plan = 'admin' THEN
    INSERT INTO analysis_usage (
      id, subject_id, analysis_id, plan, input_mode, bucket_key, status
    )
    VALUES (
      gen_random_uuid(), p_subject_id, p_analysis_id, p_plan, p_input_mode, NULL, 'reserved'
    )
    ON CONFLICT (subject_id, analysis_id) DO NOTHING;

    RETURN QUERY
      SELECT true, NULL::integer, NULL::integer, 0, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF p_plan = 'guest' THEN
    v_bucket_key := 'guest:lifetime';
    v_limit := 1;
  ELSIF p_plan = 'premium' THEN
    v_bucket_key := 'premium:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
    v_limit := CASE WHEN p_billing_period = 'yearly' THEN 200 ELSE 30 END;
  ELSE
    v_bucket_key := 'free:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
    v_limit := 5;
  END IF;
  v_monthly_limit := v_limit;

  UPDATE analysis_quota_buckets AS quota_bucket
  SET
    plan = p_plan,
    limit_value = v_limit,
    updated_at = now()
  WHERE quota_bucket.subject_id = p_subject_id
    AND quota_bucket.bucket_key = v_bucket_key;

  IF NOT FOUND THEN
    INSERT INTO analysis_quota_buckets (
      subject_id, bucket_key, plan, used, limit_value
    )
    VALUES (p_subject_id, v_bucket_key, p_plan, 0, v_limit)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE analysis_quota_buckets AS quota_bucket
  SET used = quota_bucket.used + 1, updated_at = now()
  WHERE quota_bucket.subject_id = p_subject_id
    AND quota_bucket.bucket_key = v_bucket_key
    AND quota_bucket.used < quota_bucket.limit_value
  RETURNING quota_bucket.used, quota_bucket.limit_value
    INTO v_used, v_limit;
  v_monthly_reserved := FOUND;

  SELECT COALESCE(GREATEST(credit_bucket.limit_value - credit_bucket.used, 0), 0)
    INTO v_purchased_remaining
  FROM analysis_quota_buckets AS credit_bucket
  WHERE credit_bucket.subject_id = p_subject_id
    AND credit_bucket.bucket_key = 'credits:purchased';

  IF v_monthly_reserved THEN
    INSERT INTO analysis_usage (
      id, subject_id, analysis_id, plan, input_mode, bucket_key, status
    )
    VALUES (
      gen_random_uuid(), p_subject_id, p_analysis_id, p_plan, p_input_mode, v_bucket_key, 'reserved'
    )
    ON CONFLICT (subject_id, analysis_id) DO NOTHING;

    RETURN QUERY
      SELECT true, GREATEST(v_limit - v_used, 0), v_limit,
        COALESCE(v_purchased_remaining, 0), NULL::text, v_bucket_key;
    RETURN;
  END IF;

  IF p_plan <> 'guest' THEN
    UPDATE analysis_quota_buckets AS credit_bucket
    SET used = credit_bucket.used + 1, updated_at = now()
    WHERE credit_bucket.subject_id = p_subject_id
      AND credit_bucket.bucket_key = 'credits:purchased'
      AND credit_bucket.used < credit_bucket.limit_value
    RETURNING
      credit_bucket.limit_value - credit_bucket.used,
      credit_bucket.limit_value
    INTO v_purchased_remaining, v_limit;

    IF FOUND THEN
      INSERT INTO analysis_usage (
        id, subject_id, analysis_id, plan, input_mode, bucket_key, status
      )
      VALUES (
        gen_random_uuid(), p_subject_id, p_analysis_id, p_plan, p_input_mode,
        'credits:purchased', 'reserved'
      )
      ON CONFLICT (subject_id, analysis_id) DO NOTHING;

      RETURN QUERY
        SELECT true, 0, v_monthly_limit, GREATEST(v_purchased_remaining, 0),
          NULL::text, 'credits:purchased'::text;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
    SELECT false, 0, v_monthly_limit, COALESCE(v_purchased_remaining, 0),
      'limit_reached'::text, v_bucket_key;
END;
$$;
