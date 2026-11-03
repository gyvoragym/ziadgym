ALTER TABLE public.gyms ADD COLUMN IF NOT EXISTS admin_note text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION public.set_gym_admin_note(g uuid, note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF length(coalesce(note,'')) > 2000 THEN RAISE EXCEPTION 'Note too long'; END IF;
  UPDATE public.gyms SET admin_note = btrim(coalesce(note,'')) WHERE id = g;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gym not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_gym_admin_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_gym_admin_note(uuid, text) TO authenticated;