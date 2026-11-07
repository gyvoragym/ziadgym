CREATE OR REPLACE FUNCTION public.set_gym_deletion_note(g uuid, note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF length(coalesce(note,'')) > 1000 THEN RAISE EXCEPTION 'Note too long'; END IF;
  UPDATE public.gyms SET deletion_note = btrim(coalesce(note,'')) WHERE id = g AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted gym not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_gym_deletion_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_gym_deletion_note(uuid, text) TO authenticated;