-- Run with psql -X -v ON_ERROR_STOP=1 -f src/test/gyvora-allocation.integration.sql.
-- Exercises the installed allocator in temporary tables; no durable IDs are consumed.
BEGIN;
CREATE TEMP TABLE gyvora_id_registry (
 number text PRIMARY KEY, kind text, account_id uuid, identity_version integer,
 gyvora_id text GENERATED ALWAYS AS ('GYVORA-'||kind||'-'||number) STORED,
 UNIQUE(kind,account_id,identity_version)
);
CREATE TEMP TABLE gyvora_allocator_state(singleton boolean PRIMARY KEY,lower_bound text DEFAULT '100');
DO $$ DECLARE definition text; name text; BEGIN
 FOREACH name IN ARRAY ARRAY['public.gyvora_next_number(text)','public.allocate_gyvora_id(text,uuid)'] LOOP
  definition:=replace(replace(pg_get_functiondef(name::regprocedure),'public.','pg_temp.'),'SET search_path TO ''public''','SET search_path TO ''pg_temp''');
  EXECUTE definition;
 END LOOP;
END $$;
DO $$ DECLARE i integer; a uuid; first_id text; repeated text; BEGIN
 FOR i IN 1..1200 LOOP
  a:=gen_random_uuid();
  first_id:=pg_temp.allocate_gyvora_id(CASE WHEN i%2=0 THEN 'G' ELSE 'C' END,a);
  repeated:=pg_temp.allocate_gyvora_id(CASE WHEN i%2=0 THEN 'G' ELSE 'C' END,a);
  IF first_id IS DISTINCT FROM repeated THEN RAISE EXCEPTION 'Repeated allocation changed identity'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_temp.gyvora_id_registry WHERE length(number)=3)<>900 THEN RAISE EXCEPTION 'Must exhaust all 900 three-digit suffixes'; END IF;
 IF (SELECT count(*) FROM pg_temp.gyvora_id_registry WHERE length(number)=4)<>300 THEN RAISE EXCEPTION 'Must grow to four digits after exhaustion'; END IF;
 IF (SELECT count(DISTINCT number) FROM pg_temp.gyvora_id_registry)<>1200 THEN RAISE EXCEPTION 'Cross-type uniqueness failed'; END IF;
 IF pg_temp.gyvora_next_number(repeat('9',1000)) IS DISTINCT FROM '1'||repeat('0',1000) THEN RAISE EXCEPTION 'Unexpected numeric-width cap'; END IF;
 RAISE NOTICE 'PASS: 900 three-digit and 300 four-digit assignments; cross-type uniqueness, idempotency and text-based growth';
END $$;
ROLLBACK;