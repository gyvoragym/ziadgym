CREATE OR REPLACE FUNCTION public.sync_gyvora_signup_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    photo,
    account_type
  )
  VALUES (
    NEW.id,
    left(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), 100),
    coalesce(NEW.email, ''),
    left(coalesce(NEW.raw_user_meta_data->>'phone', ''), 30),
    left(coalesce(NEW.raw_user_meta_data->>'photo', NEW.raw_user_meta_data->>'avatar_url', ''), 1500000),
    CASE
      WHEN NEW.raw_user_meta_data->>'account_type' = 'owner' THEN 'owner'
      WHEN NEW.raw_user_meta_data->>'account_type' = 'staff' THEN 'staff'
      ELSE 'client'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = CASE
      WHEN coalesce(public.profiles.email, '') = '' THEN EXCLUDED.email
      ELSE public.profiles.email
    END,
    phone = CASE
      WHEN coalesce(public.profiles.phone, '') = '' THEN EXCLUDED.phone
      ELSE public.profiles.phone
    END,
    full_name = CASE
      WHEN coalesce(public.profiles.full_name, '') = '' THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    photo = CASE
      WHEN coalesce(public.profiles.photo, '') = '' THEN EXCLUDED.photo
      ELSE public.profiles.photo
    END,
    account_type = CASE
      WHEN coalesce(public.profiles.account_type, '') = ''
        THEN EXCLUDED.account_type
      ELSE public.profiles.account_type
    END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_gyvora_signup_profile ON auth.users;
CREATE TRIGGER sync_gyvora_signup_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_gyvora_signup_profile();
