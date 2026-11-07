CREATE OR REPLACE FUNCTION public.gyvora_phone_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN compact ~ '^01[0125][0-9]{8}$'
      THEN '+20' || substring(compact FROM 2)
    WHEN compact ~ '^(\+20|20|0020)1[0125][0-9]{8}$'
      THEN '+20' || right(compact, 10)
    ELSE lower(compact)
  END
  FROM (
    SELECT regexp_replace(btrim(coalesce(value, '')), '[[:space:]()-]', '', 'g') AS compact
  ) AS normalized
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE btrim(phone) <> ''
    GROUP BY public.gyvora_phone_key(phone)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce unique GYVORA phone numbers: duplicate profiles use the same normalized phone. Review duplicate profiles before retrying; no rows were changed.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_nonempty_idx
  ON public.profiles (public.gyvora_phone_key(phone))
  WHERE btrim(phone) <> '';

CREATE OR REPLACE FUNCTION public.find_gyvora_profile_by_phone(p_phone text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles AS p
  WHERE public.gyvora_phone_key(p.phone) = public.gyvora_phone_key(p_phone)
    AND public.gyvora_phone_key(p_phone) ~ '^\+201[0125][0-9]{8}$'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_gyvora_profile_by_phone(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_gyvora_profile_by_phone(text)
  TO service_role;
