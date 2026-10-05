# Architecture Rules

- Dashboard resume ingestion uploads PDFs through the authenticated browser client into private, user-scoped Storage, then invokes the existing `analyze-resume` function; keep its deployment external and never create a replacement Edge Function from this project.