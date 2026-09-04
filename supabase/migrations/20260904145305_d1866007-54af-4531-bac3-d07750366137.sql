ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS role_slug text,
  ADD COLUMN IF NOT EXISTS percentile integer,
  ADD COLUMN IF NOT EXISTS percentile_benchmark_year integer,
  ADD COLUMN IF NOT EXISTS ab_test_id uuid,
  ADD COLUMN IF NOT EXISTS variant_label text,
  ADD COLUMN IF NOT EXISTS keyword_density jsonb,
  ADD COLUMN IF NOT EXISTS formatting_metrics jsonb;

GRANT SELECT, INSERT, DELETE ON public.resumes TO authenticated;
GRANT ALL ON public.resumes TO service_role;

CREATE TABLE public.resume_ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_ab_tests TO authenticated;
GRANT ALL ON public.resume_ab_tests TO service_role;

ALTER TABLE public.resume_ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resume A/B tests" ON public.resume_ab_tests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own resume A/B tests" ON public.resume_ab_tests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resume A/B tests" ON public.resume_ab_tests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own resume A/B tests" ON public.resume_ab_tests
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.role_market_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_slug text NOT NULL,
  role_label text NOT NULL,
  benchmark_year integer NOT NULL,
  percentile_cut_points jsonb NOT NULL,
  sample_size integer,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_slug, benchmark_year)
);

GRANT SELECT ON public.role_market_benchmarks TO authenticated;
GRANT ALL ON public.role_market_benchmarks TO service_role;

ALTER TABLE public.role_market_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view market benchmarks" ON public.role_market_benchmarks
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id_created_at
  ON public.resumes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_ab_test_id
  ON public.resumes(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_resume_ab_tests_user_id_created_at
  ON public.resume_ab_tests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_market_benchmarks_role_year
  ON public.role_market_benchmarks(role_slug, benchmark_year);