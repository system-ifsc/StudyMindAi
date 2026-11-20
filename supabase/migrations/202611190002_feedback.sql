CREATE TABLE public.app_feedback (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  email text NOT NULL,
  category text NOT NULL CHECK (category IN ('Opinião', 'Sugestão', 'Problema')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_feedback_user ON public.app_feedback(user_id, created_at);
ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_feedback FROM anon, authenticated;
GRANT INSERT, SELECT ON public.app_feedback TO authenticated;
CREATE POLICY feedback_insert ON public.app_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY feedback_select ON public.app_feedback FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
