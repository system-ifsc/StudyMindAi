ALTER TABLE public.profiles ADD CHECK(cardinality(availability)=7 AND 0 <= ALL(availability) AND 960 >= ALL(availability));
ALTER TABLE public.study_sessions ADD CHECK(ended_at >= started_at);
ALTER TABLE public.flashcards ADD CHECK(ease BETWEEN 1 AND 5 AND reps >= 0);

-- Additive import; a failed statement rolls back the entire function call.
CREATE FUNCTION public.import_user_data(payload jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  ids jsonb := '{}'; mapping jsonb; table_key text; row jsonb; field text; target text;
  table_limit integer; n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF payload->>'app' IS DISTINCT FROM 'studymind' OR payload->>'version' IS DISTINCT FROM '1'
    OR octet_length(payload::text) > 20000000 THEN RAISE EXCEPTION 'invalid backup'; END IF;
  PERFORM (payload->>'exported_at')::timestamptz;
  IF jsonb_typeof(payload->'profile') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid profile'; END IF;
  FOREACH table_key IN ARRAY ARRAY['subjects','tasks','sessions','flashcards','goals','materials','quiz_answers'] LOOP
    IF jsonb_typeof(payload->table_key) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid array: %',table_key; END IF;
    table_limit := CASE table_key WHEN 'subjects' THEN 200 WHEN 'tasks' THEN 2000 WHEN 'sessions' THEN 10000
      WHEN 'flashcards' THEN 3000 WHEN 'goals' THEN 300 WHEN 'materials' THEN 100 ELSE 20000 END;
    IF jsonb_array_length(payload->table_key) > table_limit THEN RAISE EXCEPTION 'backup table limit'; END IF;
    mapping := '{}';
    FOR row IN SELECT value FROM jsonb_array_elements(payload->table_key) LOOP
      IF row->>'id' IS NULL OR mapping ? (row->>'id') THEN RAISE EXCEPTION 'missing or duplicate id'; END IF;
      PERFORM (row->>'id')::uuid;
      mapping := mapping || jsonb_build_object(row->>'id',gen_random_uuid()::text);
    END LOOP;
    ids := ids || jsonb_build_object(table_key,mapping);
  END LOOP;
  -- Reject dangling references before remapping; never turn an invalid reference into NULL.
  FOREACH table_key IN ARRAY ARRAY['tasks','sessions','flashcards'] LOOP
    FOR row IN SELECT value FROM jsonb_array_elements(payload->table_key) LOOP
      FOREACH field IN ARRAY ARRAY['subject_id','task_id'] LOOP
        IF field='task_id' AND table_key <> 'sessions' THEN CONTINUE; END IF;
        target := CASE field WHEN 'subject_id' THEN 'subjects' ELSE 'tasks' END;
        IF row->>field IS NOT NULL AND NOT ((ids->target) ? (row->>field)) THEN
          RAISE EXCEPTION 'dangling reference: %',field;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  SELECT count(*)-count(DISTINCT value->>'client_id') INTO n FROM jsonb_array_elements(payload->'sessions');
  IF n <> 0 THEN RAISE EXCEPTION 'duplicate or missing client_id'; END IF;

  INSERT INTO subjects(id,user_id,name,color)
    SELECT (ids->'subjects'->>r.id)::uuid,uid,r.name,r.color
    FROM jsonb_to_recordset(payload->'subjects') r(id text,name text,color text);
  INSERT INTO tasks(id,user_id,subject_id,title,notes,due_date,duration_min,priority,done,completed_at)
    SELECT (ids->'tasks'->>r.id)::uuid,uid,(ids->'subjects'->>r.subject_id)::uuid,r.title,coalesce(r.notes,''),
      r.due_date,r.duration_min,r.priority,r.done,r.completed_at
    FROM jsonb_to_recordset(payload->'tasks') r(id text,subject_id text,title text,notes text,due_date date,
      duration_min integer,priority smallint,done boolean,completed_at timestamptz);
  INSERT INTO study_sessions(id,user_id,client_id,subject_id,task_id,title,started_at,ended_at,minutes)
    SELECT (ids->'sessions'->>r.id)::uuid,uid,gen_random_uuid(),(ids->'subjects'->>r.subject_id)::uuid,
      (ids->'tasks'->>r.task_id)::uuid,coalesce(r.title,''),r.started_at,r.ended_at,r.minutes
    FROM jsonb_to_recordset(payload->'sessions') r(id text,subject_id text,task_id text,title text,
      started_at timestamptz,ended_at timestamptz,minutes integer);
  INSERT INTO flashcards(id,user_id,subject_id,front,back,due_date,interval_days,ease,reps)
    SELECT (ids->'flashcards'->>r.id)::uuid,uid,(ids->'subjects'->>r.subject_id)::uuid,r.front,r.back,
      r.due_date,r.interval_days,r.ease,r.reps
    FROM jsonb_to_recordset(payload->'flashcards') r(id text,subject_id text,front text,back text,due_date date,
      interval_days integer,ease numeric,reps integer);
  INSERT INTO goals(id,user_id,title,target_date,done)
    SELECT (ids->'goals'->>r.id)::uuid,uid,r.title,r.target_date,r.done
    FROM jsonb_to_recordset(payload->'goals') r(id text,title text,target_date date,done boolean);
  INSERT INTO materials(id,user_id,name,kind,content)
    SELECT (ids->'materials'->>r.id)::uuid,uid,r.name,r.kind,r.content
    FROM jsonb_to_recordset(payload->'materials') r(id text,name text,kind text,content text);
  INSERT INTO quiz_answers(id,user_id,question_id,topic,correct,answered_at)
    SELECT (ids->'quiz_answers'->>r.id)::uuid,uid,r.question_id,r.topic,r.correct,r.answered_at
    FROM jsonb_to_recordset(payload->'quiz_answers') r(id text,question_id text,topic text,correct boolean,answered_at timestamptz);
  INSERT INTO profiles(id,display_name,course,objective,weekly_hours,availability,onboarded)
    SELECT uid,r.display_name,r.course,r.objective,r.weekly_hours,r.availability,true
    FROM jsonb_to_record(payload->'profile') r(display_name text,course text,objective text,weekly_hours integer,availability integer[])
    ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,course=EXCLUDED.course,objective=EXCLUDED.objective,
      weekly_hours=EXCLUDED.weekly_hours,availability=EXCLUDED.availability,onboarded=true,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.import_user_data(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_user_data(jsonb) TO authenticated;
