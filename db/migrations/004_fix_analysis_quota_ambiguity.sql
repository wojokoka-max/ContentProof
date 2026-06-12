CREATE OR REPLACE FUNCTION reserve_analysis_quota(
  p_subject_id text,
  p_analysis_id text,
  p_plan text,
  p_input_mode text
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  limit_value integer,
  reason text,
  bucket_key text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_bucket_key text;
  v_limit integer;
  v_used integer;
  v_starter_created timestamptz;
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

    RETURN QUERY SELECT true, NULL::integer, NULL::integer, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF p_plan = 'guest' THEN
    v_bucket_key := 'guest:lifetime';
    v_limit := 1;
  ELSIF p_plan = 'premium' THEN
    v_bucket_key := 'premium:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
    v_limit := 30;
  ELSE
    INSERT INTO analysis_quota_buckets (
      subject_id, bucket_key, plan, used, limit_value
    )
    VALUES (p_subject_id, 'free:starter', 'free', 0, 3)
    ON CONFLICT (subject_id, bucket_key) DO NOTHING;

    SELECT quota_bucket.used, quota_bucket.created_at
      INTO v_used, v_starter_created
    FROM analysis_quota_buckets AS quota_bucket
    WHERE quota_bucket.subject_id = p_subject_id
      AND quota_bucket.bucket_key = 'free:starter'
    FOR UPDATE;

    IF v_used < 3 THEN
      v_bucket_key := 'free:starter';
      v_limit := 3;
    ELSIF date_trunc('month', now() AT TIME ZONE 'UTC')
      > date_trunc('month', v_starter_created AT TIME ZONE 'UTC') THEN
      v_bucket_key := 'free:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
      v_limit := 1;
    ELSE
      RETURN QUERY SELECT false, 0, 3, 'free_starter_exhausted'::text, 'free:starter'::text;
      RETURN;
    END IF;
  END IF;

  INSERT INTO analysis_quota_buckets (
    subject_id, bucket_key, plan, used, limit_value
  )
  VALUES (p_subject_id, v_bucket_key, p_plan, 0, v_limit)
  ON CONFLICT (subject_id, bucket_key) DO NOTHING;

  UPDATE analysis_quota_buckets AS quota_bucket
  SET used = quota_bucket.used + 1, updated_at = now()
  WHERE quota_bucket.subject_id = p_subject_id
    AND quota_bucket.bucket_key = v_bucket_key
    AND quota_bucket.used < quota_bucket.limit_value
  RETURNING quota_bucket.used, quota_bucket.limit_value
    INTO v_used, v_limit;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, v_limit, 'limit_reached'::text, v_bucket_key;
    RETURN;
  END IF;

  INSERT INTO analysis_usage (
    id, subject_id, analysis_id, plan, input_mode, bucket_key, status
  )
  VALUES (
    gen_random_uuid(), p_subject_id, p_analysis_id, p_plan, p_input_mode, v_bucket_key, 'reserved'
  )
  ON CONFLICT (subject_id, analysis_id) DO NOTHING;

  RETURN QUERY SELECT true, GREATEST(v_limit - v_used, 0), v_limit, NULL::text, v_bucket_key;
END;
$$;

CREATE OR REPLACE FUNCTION release_analysis_quota(
  p_subject_id text,
  p_analysis_id text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_bucket_key text;
BEGIN
  DELETE FROM analysis_usage
  WHERE subject_id = p_subject_id
    AND analysis_id = p_analysis_id
    AND status = 'reserved'
  RETURNING bucket_key INTO v_bucket_key;

  IF v_bucket_key IS NOT NULL THEN
    UPDATE analysis_quota_buckets AS quota_bucket
    SET used = GREATEST(quota_bucket.used - 1, 0), updated_at = now()
    WHERE quota_bucket.subject_id = p_subject_id
      AND quota_bucket.bucket_key = v_bucket_key;
  END IF;
END;
$$;
