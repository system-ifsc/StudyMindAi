
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 80),
  course text NOT NULL DEFAULT '' CHECK (char_length(course) <= 150),
  objective text NOT NULL DEFAULT '' CHECK (char_length(objective) <= 300),
  weekly_hours int NOT NULL DEFAULT 8 CHECK (weekly_hours BETWEEN 1 AND 100),
  availability int[] NOT NULL DEFAULT '{60,60,60,60,60,0,0}',
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1), ''), 80))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  color text NOT NULL DEFAULT 'indigo' CHECK (char_length(color) <= 30),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  due_date date NOT NULL,
  duration_min int NOT NULL DEFAULT 30 CHECK (duration_min BETWEEN 5 AND 480),
  priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  done boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 200),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  minutes int NOT NULL CHECK (minutes BETWEEN 1 AND 480),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);
CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  front text NOT NULL CHECK (char_length(front) BETWEEN 1 AND 1000),
  back text NOT NULL CHECK (char_length(back) BETWEEN 1 AND 3000),
  due_date date NOT NULL DEFAULT current_date,
  interval_days int NOT NULL DEFAULT 0 CHECK (interval_days BETWEEN 0 AND 365),
  ease numeric(4,2) NOT NULL DEFAULT 2.5,
  reps int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  target_date date,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 150),
  kind text NOT NULL CHECK (kind IN ('txt','md','pdf')),
  content text NOT NULL CHECK (char_length(content) <= 200000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  question_id text NOT NULL CHECK (char_length(question_id) <= 40),
  topic text NOT NULL DEFAULT '' CHECK (char_length(topic) <= 80),
  correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['subjects','tasks','study_sessions','flashcards','goals','materials','quiz_answers'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own rows select" ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "own rows insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "own rows update" ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "own rows delete" ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid())', t);
    EXECUTE format('CREATE INDEX ON public.%I (user_id)', t);
  END LOOP;
END $$;


REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
