CREATE TRIGGER create_profile_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_ironhaus_profile();

INSERT INTO public.profiles (id, full_name, email, phone, photo, account_type)
SELECT u.id,
       left(coalesce(u.raw_user_meta_data->>'full_name', ''), 100),
       coalesce(u.email, ''),
       left(coalesce(u.raw_user_meta_data->>'phone', ''), 30),
       left(coalesce(u.raw_user_meta_data->>'photo', ''), 1500000),
       CASE WHEN u.raw_user_meta_data->>'account_type' IN ('owner', 'staff') THEN u.raw_user_meta_data->>'account_type' ELSE 'client' END
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);