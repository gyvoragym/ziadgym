ALTER TABLE public.owner_requests ADD COLUMN IF NOT EXISTS decision_note text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.review_owner_request(request_id uuid, approve boolean, note text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.owner_requests; g uuid;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT * INTO r FROM public.owner_requests WHERE id=request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request unavailable'; END IF;
  IF approve THEN
    g := public.decide_owner_request(request_id, true);
    UPDATE public.owner_requests SET decision_note='' WHERE id=request_id;
    RETURN g;
  END IF;
  IF r.status NOT IN ('Pending','Approved','Rejected') THEN RAISE EXCEPTION 'Request unavailable'; END IF;
  UPDATE public.owner_requests SET status='Rejected', decision_by=auth.uid(), decided_at=now(), decision_note=left(coalesce(note,''),1000), trial_started_at=NULL WHERE id=r.id;
  RETURN r.gym_id;
END $$;
REVOKE ALL ON FUNCTION public.review_owner_request(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_owner_request(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_gate_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ DECLARE r public.owner_requests; g public.gyms; BEGIN SELECT * INTO r FROM public.owner_requests WHERE user_id=auth.uid() ORDER BY created_at DESC LIMIT 1; SELECT * INTO g FROM public.gyms WHERE id=r.gym_id; IF g.id IS NULL THEN SELECT * INTO g FROM public.gyms WHERE owner_id=auth.uid() ORDER BY created_at LIMIT 1; END IF; RETURN jsonb_build_object('gymId',g.id,'deleted',g.deleted_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND disabled_at IS NOT NULL),'deletionNote',coalesce(g.deletion_note,''),'frozen',g.frozen_at IS NOT NULL,'freezeNote',coalesce(g.freeze_note,''),'requestStatus',r.status,'decisionNote',coalesce(r.decision_note,''),'plan',r.plan,'gymName',coalesce(g.name,r.gym_name),'trialStartedAt',r.trial_started_at,'trialEndsAt',r.trial_started_at+interval '1 hour','now',now()); END $function$;