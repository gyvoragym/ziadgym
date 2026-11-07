CREATE OR REPLACE FUNCTION public.mark_account_messages_read(ids uuid[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.account_messages SET read_at = now()
  WHERE recipient_id = auth.uid() AND read_at IS NULL AND id = ANY(ids);
$$;
REVOKE ALL ON FUNCTION public.mark_account_messages_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_account_messages_read(uuid[]) TO authenticated;