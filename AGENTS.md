# Architecture Rules

- Dashboard resume ingestion uploads PDFs through the authenticated browser client into private, user-scoped Storage, then invokes the existing `analyze-resume` function; keep its deployment external and never create a replacement Edge Function from this project.
- Keep enterprise roles in `public.user_roles`; self-service role rows are limited to `candidate` with no organization, while privileged role and organization assignments require trusted server-side control.