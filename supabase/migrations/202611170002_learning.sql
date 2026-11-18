-- Ownership is checked by both RLS and composite foreign keys.
ALTER TABLE public.subjects ADD UNIQUE (user_id, id);
ALTER TABLE public.tasks ADD UNIQUE (user_id, id);
ALTER TABLE public.materials ADD UNIQUE (user_id, id);
ALTER TABLE public.materials ADD COLUMN subject_id uuid;
ALTER TABLE public.tasks ADD FOREIGN KEY (user_id, subject_id) REFERENCES public.subjects(user_id, id);
ALTER TABLE public.study_sessions ADD FOREIGN KEY (user_id, subject_id) REFERENCES public.subjects(user_id, id);
ALTER TABLE public.study_sessions ADD FOREIGN KEY (user_id, task_id) REFERENCES public.tasks(user_id, id);
ALTER TABLE public.flashcards ADD FOREIGN KEY (user_id, subject_id) REFERENCES public.subjects(user_id, id);
ALTER TABLE public.materials ADD FOREIGN KEY (user_id, subject_id) REFERENCES public.subjects(user_id, id);

CREATE TABLE public.study_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  subject_id uuid, material_id uuid, task_id uuid,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  mode text NOT NULL DEFAULT 'tutor' CHECK (mode IN ('tutor','summary','explanation','questions','review')),
  level text NOT NULL DEFAULT 'intermediate' CHECK (level IN ('beginner','intermediate','advanced')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,id),
  FOREIGN KEY (user_id,subject_id) REFERENCES public.subjects(user_id,id),
  FOREIGN KEY (user_id,material_id) REFERENCES public.materials(user_id,id),
  FOREIGN KEY (user_id,task_id) REFERENCES public.tasks(user_id,id)
);
CREATE TABLE public.study_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  conversation_id uuid NOT NULL, client_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 100000), model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,id), UNIQUE(user_id,conversation_id,client_id),
  FOREIGN KEY(user_id,conversation_id) REFERENCES public.study_conversations(user_id,id)
);
CREATE TABLE public.study_message_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  message_id uuid NOT NULL, material_id uuid, title text NOT NULL DEFAULT '', url text,
  excerpt text NOT NULL DEFAULT '', page_number integer CHECK(page_number > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(user_id,message_id) REFERENCES public.study_messages(user_id,id),
  FOREIGN KEY(user_id,material_id) REFERENCES public.materials(user_id,id)
);
CREATE TABLE public.study_message_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  message_id uuid NOT NULL, rating smallint NOT NULL CHECK(rating IN (-1,1)),
  comment text NOT NULL DEFAULT '' CHECK(char_length(comment) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,message_id),
  FOREIGN KEY(user_id,message_id) REFERENCES public.study_messages(user_id,id)
);
CREATE TABLE public.generated_question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  subject_id uuid, material_id uuid, task_id uuid, conversation_id uuid,
  title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 200),
  mode text NOT NULL DEFAULT 'practice' CHECK(mode IN ('practice','exam','review')),
  level text NOT NULL DEFAULT 'intermediate' CHECK(level IN ('beginner','intermediate','advanced')),
  model text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,id),
  FOREIGN KEY(user_id,subject_id) REFERENCES public.subjects(user_id,id),
  FOREIGN KEY(user_id,material_id) REFERENCES public.materials(user_id,id),
  FOREIGN KEY(user_id,task_id) REFERENCES public.tasks(user_id,id),
  FOREIGN KEY(user_id,conversation_id) REFERENCES public.study_conversations(user_id,id)
);
CREATE TABLE public.generated_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), set_id uuid NOT NULL,
  position integer NOT NULL CHECK(position >= 0),
  kind text NOT NULL CHECK(kind IN ('multiple_choice','short_answer','essay','true_false')),
  prompt text NOT NULL, expected_answer text NOT NULL, explanation text NOT NULL DEFAULT '',
  rubric jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,id), UNIQUE(user_id,set_id,id), UNIQUE(set_id,position),
  FOREIGN KEY(user_id,set_id) REFERENCES public.generated_question_sets(user_id,id)
);
CREATE TABLE public.generated_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), question_id uuid NOT NULL,
  position integer NOT NULL CHECK(position >= 0), content text NOT NULL, is_correct boolean NOT NULL,
  UNIQUE(question_id,position),
  FOREIGN KEY(user_id,question_id) REFERENCES public.generated_questions(user_id,id)
);
CREATE TABLE public.generated_question_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), question_id uuid NOT NULL,
  material_id uuid, title text NOT NULL DEFAULT '', url text, excerpt text NOT NULL DEFAULT '',
  page_number integer CHECK(page_number > 0),
  FOREIGN KEY(user_id,question_id) REFERENCES public.generated_questions(user_id,id),
  FOREIGN KEY(user_id,material_id) REFERENCES public.materials(user_id,id)
);
CREATE TABLE public.question_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), set_id uuid NOT NULL,
  client_id uuid NOT NULL, status text NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','submitted','evaluated')),
  started_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz,
  score numeric CHECK(score BETWEEN 0 AND 100), evaluation text NOT NULL DEFAULT '',
  UNIQUE(user_id,set_id,id), UNIQUE(user_id,client_id),
  FOREIGN KEY(user_id,set_id) REFERENCES public.generated_question_sets(user_id,id)
);
CREATE TABLE public.question_attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  set_id uuid NOT NULL, attempt_id uuid NOT NULL, question_id uuid NOT NULL,
  answer text NOT NULL DEFAULT '', correct boolean, score numeric CHECK(score BETWEEN 0 AND 100),
  evaluation text NOT NULL DEFAULT '', answered_at timestamptz NOT NULL DEFAULT now(), evaluated_at timestamptz,
  UNIQUE(attempt_id,question_id),
  FOREIGN KEY(user_id,set_id,attempt_id) REFERENCES public.question_attempts(user_id,set_id,id),
  FOREIGN KEY(user_id,set_id,question_id) REFERENCES public.generated_questions(user_id,set_id,id)
);
CREATE TABLE public.material_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), material_id uuid NOT NULL,
  bucket_id text NOT NULL DEFAULT 'study-materials' CHECK(bucket_id = 'study-materials'),
  object_path text NOT NULL CHECK(split_part(object_path,'/',1) = user_id::text),
  original_name text NOT NULL CHECK(char_length(original_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 0 AND 10000000),
  sha256 text, extraction_status text NOT NULL DEFAULT 'ready' CHECK(extraction_status IN ('pending','processing','ready','failed')),
  extraction_error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bucket_id,object_path),
  FOREIGN KEY(user_id,material_id) REFERENCES public.materials(user_id,id)
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['study_conversations','study_messages','study_message_sources','study_message_feedback',
    'generated_question_sets','generated_questions','generated_question_options','generated_question_sources',
    'question_attempts','question_attempt_answers','material_files'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY own_rows ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE INDEX ON public.%I (user_id)', t);
  END LOOP;
END $$;

INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES('study-materials','study-materials',false,10000000)
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10000000;
CREATE POLICY study_materials_select ON storage.objects FOR SELECT TO authenticated
  USING(bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY study_materials_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY study_materials_delete ON storage.objects FOR DELETE TO authenticated
  USING(bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
