UPDATE public.owner_requests
SET request_duration_days = CASE lower(trim(plan))
  WHEN 'basic' THEN 30
  WHEN 'monthly plan' THEN 30
  WHEN 'premium' THEN 90
  WHEN '3 months plan' THEN 90
  WHEN 'vip' THEN 365
  WHEN 'annual plan' THEN 365
END
WHERE status = 'Approved'
  AND decided_at IS NOT NULL
  AND request_duration_days IS NULL
  AND lower(trim(plan)) IN ('basic', 'monthly plan', 'premium', '3 months plan', 'vip', 'annual plan');

CREATE OR REPLACE FUNCTION public.owner_gate_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.owner_requests;
  g public.gyms;
  subscription_end date;
BEGIN
  SELECT * INTO r
  FROM public.owner_requests
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT * INTO g FROM public.gyms WHERE id = r.gym_id;
  IF g.id IS NULL THEN
    SELECT * INTO g
    FROM public.gyms
    WHERE owner_id = auth.uid()
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF r.status = 'Approved'
    AND r.decided_at IS NOT NULL
    AND r.request_duration_days > 0
  THEN
    subscription_end := r.decided_at::date + r.request_duration_days;
  END IF;

  RETURN jsonb_build_object(
    'gymId', g.id,
    'deleted', g.deleted_at IS NOT NULL OR EXISTS(
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND disabled_at IS NOT NULL
    ),
    'deletionNote', coalesce(g.deletion_note, ''),
    'frozen', g.frozen_at IS NOT NULL,
    'freezeNote', coalesce(g.freeze_note, ''),
    'requestStatus', r.status,
    'decisionNote', coalesce(r.decision_note, ''),
    'plan', r.plan,
    'gymName', coalesce(g.name, r.gym_name),
    'subscriptionEnd', subscription_end,
    'subscriptionExpired', coalesce(subscription_end <= now()::date, false),
    'trialStartedAt', r.trial_started_at,
    'trialEndsAt', r.trial_started_at + interval '1 hour',
    'now', now()
  );
END
$function$;
