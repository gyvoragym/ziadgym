ALTER TABLE public.owner_requests ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION public.submit_owner_request(request_name text, request_plan text, request_phone text)
RETURNS public.owner_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.owner_requests; uid uuid := auth.uid();
BEGIN
 IF uid IS NULL OR NOT public.otp_verified() OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=uid AND account_type='owner' AND disabled_at IS NULL) THEN RAISE EXCEPTION 'Gym owner account required'; END IF;
 IF length(trim(request_name)) NOT BETWEEN 1 AND 100 OR request_plan NOT IN ('Monthly Plan','Annual Plan') OR length(trim(request_phone)) NOT BETWEEN 6 AND 30 OR request_phone !~ '^\+?[0-9 ()-]+$' THEN RAISE EXCEPTION 'Enter a gym name, phone number and Monthly or Annual plan'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 SELECT * INTO r FROM public.owner_requests WHERE user_id=uid FOR UPDATE;
 IF r.status='Approved' THEN RAISE EXCEPTION 'This gym request is already approved'; END IF;
 IF r.status='Pending' THEN RETURN r; END IF;
 IF r.id IS NULL THEN
 INSERT INTO public.owner_requests(user_id,gym_name,phone,plan,status) VALUES(uid,trim(request_name),trim(request_phone),request_plan,'Pending') RETURNING * INTO r;
 ELSE
 UPDATE public.owner_requests SET gym_name=trim(request_name),phone=trim(request_phone),plan=request_plan,status='Pending',created_at=now(),decision_by=NULL,decided_at=NULL WHERE id=r.id RETURNING * INTO r;
 END IF;
 RETURN r;
END; $$;
REVOKE ALL ON FUNCTION public.submit_owner_request(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_owner_request(text,text,text) TO authenticated;
