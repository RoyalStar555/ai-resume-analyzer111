# ATS Lens V2 — Enterprise Edition

## Architectural blueprint

### Verified current state

- The app is a TanStack Start + React 19 application with TanStack Router/Query, Lovable Cloud auth/database, and the Lovable AI Gateway. There is no Express/MongoDB runtime to preserve or introduce.
- `src/routes/_authenticated/dashboard.tsx` currently owns the upload form, staged progress/cancellation state, history query/delete actions, and the complete inline report renderer. The report already renders the Pie, Radar, and Bar visualizations, feedback lists, skill badges, career mapping, deep audits, salary estimate, cover letter, and export/share actions.
- `src/lib/resume.functions.ts` currently owns the Zod response schemas, canonical keyword aliases, deterministic ATS score, AI prompt, JSON extraction/defaulting, authenticated analysis save, history listing, and deletion. It has a single AI attempt with a timeout, but no malformed-response retry loop.
- `src/lib/pdf-parser.ts` uses `pdfjs-dist` in the browser and raises `EmptyPdfTextError` when extracted text is too short; there is no OCR fallback.
- The only current public table is `resumes`, with user-owned SELECT/INSERT/DELETE policies and no UPDATE policy. The existing migration creates the table and policies but does not include the required explicit Data API GRANT statements; this will be corrected in a non-destructive migration before new data paths are added.
- `src/styles.css` already defines semantic Tailwind v4 tokens and the current dark visual system, but only one active palette exists. `src/integrations/supabase/types.ts` is generated and will be refreshed after migrations rather than edited manually.

## Preservation contract

No existing analysis field, database field, visual report section, authentication flow, history behavior, PDF text path, keyword alias, chart, audit, salary estimate, or cover-letter feature will be removed. V2 will add adapters and new views around the existing single-resume flow; the existing analysis action remains the fallback and canonical behavior for one resume.

## Exact Bento Grid specification

The authenticated dashboard will use a named, 12-column CSS Grid on large screens. Each named area is an independent card, with the existing report modules mapped as follows:

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: minmax(168px, auto);
  grid-template-areas:
    "input input input input input input input input score score score score"
    "input input input input input input input input verdict verdict verdict verdict"
    "pie pie pie pie feedback feedback feedback feedback feedback feedback feedback feedback"
    "pie pie pie pie feedback feedback feedback feedback feedback feedback feedback feedback"
    "radar radar radar radar market market market market career career career career"
    "advanced advanced advanced advanced impact impact impact impact flags flags flags flags"
    "skills skills skills skills rewrites rewrites rewrites rewrites rewrites rewrites rewrites rewrites"
    "premium premium premium premium premium premium premium premium premium premium premium premium"
    "history history history history history history history history history history history history";
  gap: 1rem;
  align-items: stretch;
}

@media (max-width: 1023px) {
  .bento-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-template-areas:
      "input input input input input input"
      "input input input input input input"
      "score score verdict verdict verdict verdict"
      "pie pie pie feedback feedback feedback"
      "pie pie pie feedback feedback feedback"
      "radar radar radar market market market"
      "career career advanced advanced impact impact"
      "flags flags skills skills rewrites rewrites"
      "rewrites rewrites rewrites rewrites rewrites rewrites"
      "premium premium premium premium premium premium"
      "history history history history history history";
  }
}

@media (max-width: 767px) {
  .bento-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: auto;
    grid-template-areas:
      "input" "score" "verdict" "pie" "feedback" "radar"
      "market" "career" "advanced" "impact" "flags" "skills"
      "rewrites" "premium" "history";
  }
}
```

`input` contains the existing job-description/PDF workflow and stage tracker; `score` is the ATS score/progress; `verdict` is the recruiter summary; `pie` is the evaluation breakdown; `feedback` contains strong/weak/suggestion lists; `radar` is competency radar; `market` is market alignment; `career` is the combined real-world/advanced career mapping; `advanced` is interview probability plus the existing aspect radar; `impact` and `flags` are the two deep-analysis cards; `skills` preserves all three badge groups; `rewrites` preserves tailored bullet rewrites; `premium` preserves all bonus tools; and `history` preserves recent analyses.

## Phased execution checklist

### Preflight — protect the production baseline

- [ ] Add a migration that grants the existing `resumes` table to the roles already represented by its policies, without altering or deleting any rows.
- [ ] Verify authenticated server-function calls still receive the bearer token through the existing `functionMiddleware` and that the protected dashboard cannot be loaded as an anonymous user.
- [ ] Add focused tests for canonical keyword aliases, score calculation, JSON normalization, cancellation, and existing `resumes` history behavior before refactoring the dashboard.
- [ ] Keep `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `previewAuthStorage.ts`, and generated `types.ts` out of hand-authored edits.

### Milestone 1 — Bento Grid UI and dynamic theming

- [ ] Refactor `src/routes/_authenticated/dashboard.tsx` into a dashboard orchestrator that keeps the current state, mutations, cancellation, history query, and report data contract while delegating rendering to focused cards.
- [ ] Create `src/components/dashboard/BentoGrid.tsx` and focused cards for input, score, verdict, evaluation breakdown, feedback, competency radar, market alignment, advanced metrics, career mapping, impact audit, red flags, skills, bullet rewrites, premium tools, and history.
- [ ] Create `src/components/theme/ThemeProvider.tsx` and `src/components/theme/theme-options.ts` with `obsidian`, `cyberpunk`, and `monochrome` options. Apply a `data-theme` attribute to the authenticated app shell and persist the selected theme only after hydration to avoid SSR/client mismatches.
- [ ] Extend `src/styles.css` with semantic surface, foreground, border, chart, success, warning, and destructive variables for all three palettes. Recharts colors will read theme tokens instead of owning separate hardcoded palette values.
- [ ] Add a compact theme selector using the existing Button/design-system primitives. Obsidian Dark remains the default, so existing users see the current appearance unless they choose another palette.
- [ ] Preserve the existing report data fields exactly. The two currently available career-mapping sources will be rendered in one card with fallback precedence, not discarded or duplicated.

### Milestone 2 — Market percentiles and adaptive skill flashcards

- [ ] Add a client-safe `src/components/dashboard/PercentileBellCurve.tsx` that shows the raw ATS score, matched role, benchmark year, and percentile marker. If no role benchmark is available, show an honest unavailable state rather than inventing a percentile.
- [ ] Add `src/components/dashboard/SkillFlashcardDeck.tsx` driven by `analysis.weak_points` and `analysis.missing_skills`. Each card will support keyboard-accessible flip/reveal behavior, next/previous controls, and a completion count without changing the stored analysis.
- [ ] Extend the analysis normalization contract with an optional canonical role slug/label used to select a benchmark. Existing responses without that value continue to render normally.
- [ ] Keep percentile computation deterministic: select the role/year benchmark, clamp the score to the benchmark range, interpolate the percentile, and retain the benchmark year with the saved analysis so historical values remain explainable.

### Milestone 3 — Multi-resume A/B testing engine

- [ ] Add `src/components/dashboard/AbTestInput.tsx` for Variant A and Variant B PDF selection against one shared job description, reusing the existing PDF validation and cancellation UI.
- [ ] Add `src/components/dashboard/AbComparisonView.tsx` and `src/components/dashboard/ComparisonMetric.tsx` for side-by-side ATS scores, score delta, matched/missing keyword sets, keyword density, formatting metrics, and a clear winning variant. Keep the current single-resume report view unchanged when A/B mode is not selected.
- [ ] Add an authenticated `analyzeResumePair` server function in `src/lib/resume.functions.ts` that reuses the existing canonicalization, score, prompt, schema parsing, timeout, and save helpers. The two evaluations will share the same JD and use bounded parallelism with one cancellation boundary.
- [ ] Extend the PDF extraction result internally with additive document metrics—page count, word count, bullet count, section-heading count, and link count—while retaining `extractTextFromPdf(file): Promise<string>` as a compatibility wrapper for the current flow.
- [ ] Save A/B parent metadata and each variant’s comparison metrics without duplicating or overwriting ordinary history records. The comparison view will be grouped by test id in history.

### Milestone 4 — Self-healing AI and resilient parsing

- [ ] Split the current AI flow into: gateway request, JSON extraction, strict validation, and display-safe normalization helpers. The first attempt uses the current prompt and schema; malformed JSON or schema-invalid output gets up to two additional attempts with a concise correction prompt.
- [ ] Retry only malformed/schema-invalid AI output. Do not retry cancellation, authentication failures, exhausted credits, rate limits, or invalid user input; preserve the current user-facing error handling for those cases.
- [ ] Use bounded backoff and a shared timeout budget so three attempts cannot create an unbounded request. Save to `resumes` only after one validated result exists, preventing partial or duplicate history rows.
- [ ] Add `tesseract.js` as a browser-only dependency and create `src/lib/ocr-parser.ts`. When `pdfjs-dist` returns `EmptyPdfTextError`, render a capped number of PDF pages through the existing PDF worker and OCR them with progress plus cancellation support.
- [ ] Keep the text PDF path fast and unchanged. OCR is an explicit fallback, has page/image-size limits, and returns a readable error when a scan is too large or still has no useful text.
- [ ] Extend the stage tracker with an OCR fallback state and ensure OCR imports stay out of SSR/server-function bundles.

## Database changes

The existing `resumes` table remains the source of truth for ordinary analyses. Changes are additive:

1. Add nullable `role_slug`, `percentile`, and `percentile_benchmark_year` columns to `resumes` for explainable historical percentile values.
2. Add nullable `ab_test_id`, `variant_label`, `keyword_density` JSONB, and `formatting_metrics` JSONB columns to `resumes`. Existing rows remain valid; A/B variants remain ordinary user-owned resume records and therefore retain current history/RLS behavior.
3. Create `public.resume_ab_tests` with `id`, `user_id`, `job_description`, and `created_at`. It groups the two variants and is scoped to its owner.
4. Create `public.role_market_benchmarks` with `id`, `role_slug`, `role_label`, `benchmark_year`, percentile cut points, `sample_size`, `source`, and `created_at`. Authenticated users may read benchmark rows; only trusted service-side migration/maintenance paths may write them.
5. Add owner policies and explicit GRANT statements in the same migration for every new public table, in the required order: create table, grant, enable RLS, then policies. Add indexes for `(user_id, created_at)`, A/B test grouping, and `(role_slug, benchmark_year)`.
6. Refresh generated database types after the migration; do not hand-edit the generated type file.

No existing column is renamed, removed, or made stricter, and no existing RLS policy is widened to expose another user’s resumes.

## Files planned

**Modified:** `src/routes/_authenticated/dashboard.tsx`, `src/lib/resume.functions.ts`, `src/lib/pdf-parser.ts`, `src/styles.css`, `package.json`, and a new Supabase migration under `supabase/migrations/`.

**Created:** `src/components/dashboard/BentoGrid.tsx`, the focused dashboard card components, `src/components/theme/ThemeProvider.tsx`, `src/components/theme/theme-options.ts`, `src/components/dashboard/PercentileBellCurve.tsx`, `src/components/dashboard/SkillFlashcardDeck.tsx`, `src/components/dashboard/AbTestInput.tsx`, `src/components/dashboard/AbComparisonView.tsx`, `src/components/dashboard/ComparisonMetric.tsx`, and `src/lib/ocr-parser.ts`.

**Generated, not hand-edited:** `src/integrations/supabase/types.ts` after the approved database migration.

**Review-only unless a verified auth test requires it:** `src/routes/_authenticated.tsx`, `src/start.ts`, and the generated integration files.

## Acceptance gates

- [ ] Existing one-resume analysis produces the same score, saved row, history entry, charts, audits, salary estimate, cover letter, and cancellation behavior.
- [ ] All three themes work at desktop, tablet, and mobile sizes without horizontal overflow or unreadable chart labels.
- [ ] Percentile and flashcard features degrade safely when optional AI/benchmark data is absent.
- [ ] A/B tests cannot read or modify another user’s parent test or variant rows.
- [ ] Malformed AI output self-heals within three bounded attempts; provider/auth/user-input failures are not needlessly retried.
- [ ] Scanned PDFs can use OCR fallback while text-based PDFs continue through the existing `pdfjs-dist` path.
- [ ] Build, lint, targeted tests, and authenticated browser checks pass before any publish step.