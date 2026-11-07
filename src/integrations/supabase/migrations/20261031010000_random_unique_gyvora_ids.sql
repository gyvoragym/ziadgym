CREATE OR REPLACE FUNCTION public.allocate_gyvora_id(a text, k uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_number text;
  v_id text;
BEGIN
  IF a IS NULL OR a NOT IN ('C', 'G') THEN
    RAISE EXCEPTION 'Unsupported GYVORA ID kind';
  END IF;

  INSERT INTO public.gyvora_allocator_state (singleton)
  VALUES (true)
  ON CONFLICT (singleton) DO NOTHING;

  PERFORM 1
  FROM public.gyvora_allocator_state
  WHERE singleton = true
  FOR UPDATE;

  SELECT gyvora_id
  INTO v_id
  FROM public.gyvora_id_registry
  WHERE kind = a AND account_id = k
  ORDER BY identity_version DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  SELECT candidates.number::text
  INTO v_number
  FROM generate_series(100, 999) AS candidates(number)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.gyvora_id_registry
    WHERE number = candidates.number::text
  )
  ORDER BY random()
  LIMIT 1;

  IF v_number IS NULL THEN
    v_number := '999';
    LOOP
      v_number := public.gyvora_next_number(v_number);
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.gyvora_id_registry
        WHERE number = v_number
      );
    END LOOP;
  END IF;

  INSERT INTO public.gyvora_id_registry (kind, account_id, identity_version, number)
  VALUES (a, k, 2, v_number)
  RETURNING gyvora_id INTO v_id;

  RETURN v_id;
END;
$function$;
