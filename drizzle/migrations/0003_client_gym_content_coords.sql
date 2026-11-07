CREATE OR REPLACE FUNCTION public.client_gym_content(g uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.gym_operational(g) THEN RAISE EXCEPTION 'This gym is unavailable'; END IF;
 SELECT jsonb_build_object(
 'profile', coalesce((SELECT jsonb_build_object('name',x.name,'logo',r.data->>'logo','code',r.data->>'code','tagline',r.data->>'tagline','description',r.data->>'description','location',r.data->>'location','coords',r.data->'coords','cover',r.data->>'cover','gallery',r.data->'gallery','facilities',r.data->'facilities','services',r.data->'services','hoursByDay',r.data->'hoursByDay','phone',r.data->>'phone','whatsapp',r.data->>'whatsapp','currency',r.data->'preferences'->>'currency') FROM public.gyms x LEFT JOIN public.gym_records r ON r.gym_id=x.id AND r.kind='gym' WHERE x.id=g),'{}'::jsonb),
 'plans',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',data->>'name','duration',data->>'duration','price',data->'price','features',data->'features','featured',data->'featured')) FROM public.gym_records WHERE gym_id=g AND kind='plans'),'[]'::jsonb),
 'workouts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',data->>'name','trainer',data->>'trainer','notes',coalesce(data->>'notes',''),'exercises',data->'exercises')) FROM public.gym_records WHERE gym_id=g AND kind='workouts'),'[]'::jsonb),
 'products',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',data->>'name','price',data->'price','image',data->>'image','category',data->>'category')) FROM public.gym_records WHERE gym_id=g AND kind='products'),'[]'::jsonb),
 'trainers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',data->>'name','specialty',data->>'specialty','bio',data->>'bio','notes',data->>'notes','image',data->>'image')) FROM public.gym_records WHERE gym_id=g AND kind='trainers'),'[]'::jsonb)) INTO result;
 RETURN result;
END $function$;