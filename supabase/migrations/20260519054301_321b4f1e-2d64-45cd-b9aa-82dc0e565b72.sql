
CREATE TABLE public.resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_description text NOT NULL,
  resume_text text NOT NULL,
  ats_score integer NOT NULL,
  analysis jsonb NOT NULL,
  filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resumes" ON public.resumes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes" ON public.resumes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes" ON public.resumes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_resumes_user_id_created_at ON public.resumes(user_id, created_at DESC);
