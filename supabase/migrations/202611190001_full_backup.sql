-- Backup v2. Storage objects are staged privately before this transaction.
-- Existing migrations and the v1 import function remain unchanged.
CREATE FUNCTION public.import_full_user_data(payload jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  table_key text; row_data jsonb; columns_sql text; values_sql text;
  tables text[] := ARRAY['subjects','tasks','study_sessions','flashcards','goals','materials','quiz_answers',
    'study_conversations','study_messages','study_message_sources','study_message_feedback',
    'generated_question_sets','generated_questions','generated_question_options','generated_question_sources',
    'question_attempts','question_attempt_answers','material_files'];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF payload->>'app' IS DISTINCT FROM 'studymind' OR payload->>'version' IS DISTINCT FROM '2'
    OR octet_length(payload::text) > 67108864 OR jsonb_typeof(payload->'records') IS DISTINCT FROM 'object'
    OR jsonb_typeof(payload->'profile') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid full backup'; END IF;
  PERFORM (payload->>'exported_at')::timestamptz;
  FOREACH table_key IN ARRAY tables LOOP
    IF jsonb_typeof(payload->'records'->table_key) IS DISTINCT FROM 'array'
      OR jsonb_array_length(payload->'records'->table_key) > 20000 THEN RAISE EXCEPTION 'invalid backup table'; END IF;
    FOR row_data IN SELECT value FROM jsonb_array_elements(payload->'records'->table_key) LOOP
      IF jsonb_typeof(row_data) <> 'object' OR row_data->>'id' IS NULL THEN RAISE EXCEPTION 'invalid row'; END IF;
      -- Ignore any caller-provided owner. RLS and composite foreign keys stay active.
      row_data := row_data || jsonb_build_object('user_id',uid);
      IF table_key = 'material_files' AND NOT EXISTS (
        SELECT 1 FROM storage.objects WHERE bucket_id='study-materials' AND name=row_data->>'object_path'
          AND split_part(name,'/',1)=uid::text
      ) THEN RAISE EXCEPTION 'original file missing'; END IF;
      -- Only actual columns of the fixed table allowlist; omitted columns keep SQL defaults.
      SELECT string_agg(format('%I',c.column_name),',' ORDER BY c.ordinal_position),
        string_agg(format('r.%I',c.column_name),',' ORDER BY c.ordinal_position)
        INTO columns_sql,values_sql FROM information_schema.columns c
        WHERE c.table_schema='public' AND c.table_name=table_key AND row_data ? c.column_name;
      EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r',
        table_key,columns_sql,values_sql,table_key) USING row_data;
    END LOOP;
  END LOOP;
  INSERT INTO profiles(id,display_name,course,objective,weekly_hours,availability,onboarded)
    SELECT uid,r.display_name,r.course,r.objective,r.weekly_hours,r.availability,true
    FROM jsonb_to_record(payload->'profile') r(display_name text,course text,objective text,weekly_hours integer,availability integer[])
    ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,course=EXCLUDED.course,
      objective=EXCLUDED.objective,weekly_hours=EXCLUDED.weekly_hours,availability=EXCLUDED.availability,
      onboarded=true,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.import_full_user_data(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_full_user_data(jsonb) TO authenticated;
