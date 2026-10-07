CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'candidate',
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own role row" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own role row" ON public.user_roles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own role row" ON public.user_roles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE FUNCTION public.prevent_user_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.user_id AND (NEW.role <> 'candidate' OR NEW.org_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Users may only assign themselves the candidate role without an organization';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_user_role_self_escalation
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_role_self_escalation();

CREATE TABLE public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  resume_storage_path text,
  job_description text NOT NULL,
  parsed_profile jsonb,
  score_matrix jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO authenticated;
GRANT ALL ON public.analyses TO service_role;

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own analyses" ON public.analyses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analyses" ON public.analyses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses" ON public.analyses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses" ON public.analyses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Organization members can read their organization" ON public.organizations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.org_id = organizations.id
    )
  );

CREATE INDEX analyses_user_id_idx ON public.analyses(user_id);
CREATE INDEX user_roles_org_id_idx ON public.user_roles(org_id);