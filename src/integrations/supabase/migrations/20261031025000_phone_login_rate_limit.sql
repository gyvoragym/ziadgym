CREATE TABLE public.gyvora_phone_login_attempts (
  bucket_key text PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts > 0),
  window_started_at timestamptz NOT NULL
);

CREATE INDEX gyvora_phone_login_attempts_window_idx
  ON public.gyvora_phone_login_attempts (window_started_at);

ALTER TABLE public.gyvora_phone_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gyvora_phone_login_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_gyvora_phone_login_attempt(
  p_phone text,
  p_ip text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_phone_attempts integer;
  v_ip_attempts integer;
BEGIN
  IF p_phone !~ '^\+201[0125][0-9]{8}$' OR length(p_ip) > 128 THEN
    RAISE EXCEPTION 'Invalid phone login rate-limit key';
  END IF;

  DELETE FROM public.gyvora_phone_login_attempts
  WHERE window_started_at < v_now - interval '24 hours';

  INSERT INTO public.gyvora_phone_login_attempts AS existing (
    bucket_key,
    attempts,
    window_started_at
  )
  VALUES ('phone:' || md5(p_phone), 1, v_now)
  ON CONFLICT (bucket_key) DO UPDATE
  SET
    attempts = CASE
      WHEN existing.window_started_at <= v_now - interval '15 minutes' THEN 1
      ELSE existing.attempts + 1
    END,
    window_started_at = CASE
      WHEN existing.window_started_at <= v_now - interval '15 minutes' THEN v_now
      ELSE existing.window_started_at
    END
  RETURNING attempts INTO v_phone_attempts;

  INSERT INTO public.gyvora_phone_login_attempts AS existing (
    bucket_key,
    attempts,
    window_started_at
  )
  VALUES ('ip:' || md5(coalesce(nullif(p_ip, ''), 'unknown')), 1, v_now)
  ON CONFLICT (bucket_key) DO UPDATE
  SET
    attempts = CASE
      WHEN existing.window_started_at <= v_now - interval '15 minutes' THEN 1
      ELSE existing.attempts + 1
    END,
    window_started_at = CASE
      WHEN existing.window_started_at <= v_now - interval '15 minutes' THEN v_now
      ELSE existing.window_started_at
    END
  RETURNING attempts INTO v_ip_attempts;

  RETURN v_phone_attempts <= 8 AND v_ip_attempts <= 30;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_gyvora_phone_login_attempt(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_gyvora_phone_login_attempt(text, text)
  TO service_role;
