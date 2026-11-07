CREATE TABLE IF NOT EXISTS public.platform_subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  billing_type text NOT NULL CHECK (billing_type IN ('Monthly', 'Annual')),
  price numeric NOT NULL CHECK (price > 0),
  duration_days integer NOT NULL CHECK (duration_days > 0 AND duration_days <= 36500),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_subscription_plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.platform_subscription_plans TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view active platform plans"
  ON public.platform_subscription_plans;
CREATE POLICY "Authenticated users can view active platform plans"
  ON public.platform_subscription_plans
  FOR SELECT TO authenticated
  USING (active OR public.is_super_admin());

ALTER TABLE public.owner_requests
  ADD COLUMN IF NOT EXISTS request_plan_id text,
  ADD COLUMN IF NOT EXISTS request_billing_type text,
  ADD COLUMN IF NOT EXISTS request_duration_days integer,
  ADD COLUMN IF NOT EXISTS request_price numeric;

CREATE OR REPLACE FUNCTION public.submit_owner_request(
  request_name text,
  request_plan text,
  request_phone text
)
RETURNS public.owner_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.owner_requests;
  selected_plan public.platform_subscription_plans;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.otp_verified()
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = uid AND account_type = 'owner' AND disabled_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'Gym owner account required';
  END IF;

  IF length(trim(request_name)) NOT BETWEEN 1 AND 100
    OR length(trim(request_phone)) NOT BETWEEN 6 AND 30
    OR request_phone !~ '^\+?[0-9 ()-]+$'
  THEN
    RAISE EXCEPTION 'Enter a gym name and valid phone number';
  END IF;

  SELECT * INTO selected_plan
  FROM public.platform_subscription_plans
  WHERE id = request_plan AND active = true;
  IF selected_plan.id IS NULL THEN
    RAISE EXCEPTION 'Choose an available subscription plan';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  SELECT * INTO r FROM public.owner_requests WHERE user_id = uid FOR UPDATE;
  IF r.status = 'Approved' THEN
    RAISE EXCEPTION 'This gym request is already approved';
  END IF;
  IF r.status = 'Pending' THEN
    RETURN r;
  END IF;

  IF r.id IS NULL THEN
    INSERT INTO public.owner_requests(
      user_id, gym_name, phone, plan, status,
      request_plan_id, request_billing_type, request_duration_days, request_price
    ) VALUES (
      uid, trim(request_name), trim(request_phone), selected_plan.name, 'Pending',
      selected_plan.id, selected_plan.billing_type, selected_plan.duration_days, selected_plan.price
    ) RETURNING * INTO r;
  ELSE
    UPDATE public.owner_requests
    SET gym_name = trim(request_name),
        phone = trim(request_phone),
        plan = selected_plan.name,
        status = 'Pending',
        request_plan_id = selected_plan.id,
        request_billing_type = selected_plan.billing_type,
        request_duration_days = selected_plan.duration_days,
        request_price = selected_plan.price,
        decision_by = NULL,
        decided_at = NULL,
        decision_note = '',
        created_at = now()
    WHERE id = r.id
    RETURNING * INTO r;
  END IF;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_owner_request(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_owner_request(text, text, text) TO authenticated;
