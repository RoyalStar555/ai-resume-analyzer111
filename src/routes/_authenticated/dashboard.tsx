import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { extractTextFromPdf } from "@/lib/pdf-parser";
import { analyzeResume, listResumes, deleteResume, type ResumeAnalysis } from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Trash2, Loader2, Target, Sparkles, Check, X, StopCircle } from "lucide-react";
import { toast } from "sonner";

type Stage = "parsing" | "scoring" | "analyzing" | "saving";
const STAGES: { key: Stage; label: string }[] = [
  { key: "parsing", label: "Reading PDF" },
  { key: "scoring", label: "Computing ATS keyword score" },
  { key: "analyzing", label: "Analyzing with Gemini AI" },
  { key: "saving", label: "Saving results" },
];

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type AnalysisResult = { id: string; score: number; analysis: ResumeAnalysis; createdAt: string };

function Dashboard() {
  const analyzeFn = useServerFn(analyzeResume);
  const listFn = useServerFn(listResumes);
  const deleteFn = useServerFn(deleteResume);
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [stage, setStage] = useState<Stage | null>(null);
  const [current, setCurrent] = useState<AnalysisResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const history = useQuery({ queryKey: ["resumes"], queryFn: () => listFn() });

  const analyze = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please upload a PDF resume.");
      if (jd.trim().length < 20) throw new Error("Please paste a job description (20+ chars).");

      const controller = new AbortController();
      abortRef.current = controller;
      const throwIfAborted = () => {
        if (controller.signal.aborted) throw new DOMException("Canceled", "AbortError");
      };

      setStage("parsing");
      const resumeText = await extractTextFromPdf(file);
      throwIfAborted();
      if (resumeText.length < 50) throw new Error("Couldn't extract text from this PDF.");

      setStage("scoring");
      // brief pause so the user can see the stage transition
      await new Promise((r) => setTimeout(r, 250));
      throwIfAborted();

      setStage("analyzing");
      const result = await analyzeFn({
        data: { resumeText, jobDescription: jd, filename: file.name },
        signal: controller.signal,
      });
      throwIfAborted();

      setStage("saving");
      await new Promise((r) => setTimeout(r, 150));
      return result;
    },
    onSuccess: (res) => {
      setCurrent(res as AnalysisResult);
      setStage(null);
      abortRef.current = null;
      qc.invalidateQueries({ queryKey: ["resumes"] });
      toast.success(`Analysis complete — ${res.score}% match`);
    },
    onError: (e: any) => {
      setStage(null);
      abortRef.current = null;
      if (e?.name === "AbortError") {
        toast("Analysis canceled");
        return;
      }
      toast.error(e.message ?? "Analysis failed");
    },
  });

  const cancel = () => {
    abortRef.current?.abort();
  };

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resumes"] });
      toast.success("Deleted");
    },
  });

  const running = stage !== null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold">Run an analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste the target job description and upload your resume PDF.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            analyze.mutate();
          }}
          className="glass space-y-5 rounded-2xl p-6 shadow-card"
        >
          <div className="space-y-2">
            <Label htmlFor="jd">Job description</Label>
            <Textarea
              id="jd"
              rows={8}
              placeholder="Paste the full job description here…"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Resume (PDF)</Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-input/40 px-4 py-6 transition hover:border-primary/60">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Upload className="size-5" />
              </div>
              <div className="flex-1 text-sm">
                {file ? (
                  <span className="font-medium">{file.name}</span>
                ) : (
                  <span className="text-muted-foreground">Click to select a PDF file</span>
                )}
              </div>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {running && <StageTracker active={stage!} />}

          <div className="flex gap-3">
            {running ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={cancel}
                className="w-full"
              >
                <StopCircle className="mr-2 size-4" />
                Cancel analysis
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                <Sparkles className="mr-2 size-4" />
                Analyze match
              </Button>
            )}
          </div>
        </form>

        {current && <AnalysisCard result={current} />}
      </div>


      <aside className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Recent analyses</h2>
        {history.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {history.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No analyses yet.</p>
        )}
        <ul className="space-y-2">
          {history.data?.map((r) => (
            <li
              key={r.id}
              className="glass flex items-center justify-between gap-3 rounded-xl p-3 shadow-card"
            >
              <button
                className="flex flex-1 items-center gap-3 text-left"
                onClick={() =>
                  setCurrent({
                    id: r.id,
                    score: r.ats_score,
                    analysis: r.analysis as unknown as ResumeAnalysis,
                    createdAt: r.created_at,
                  })
                }
              >
                <div
                  className="grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold"
                  style={{
                    background:
                      r.ats_score >= 70
                        ? "color-mix(in oklch, var(--success) 20%, transparent)"
                        : r.ats_score >= 40
                          ? "color-mix(in oklch, var(--warning) 20%, transparent)"
                          : "color-mix(in oklch, var(--destructive) 20%, transparent)",
                  }}
                >
                  {r.ats_score}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.filename ?? "Resume"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
              </button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => del.mutate(r.id)}
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function AnalysisCard({ result }: { result: AnalysisResult }) {
  const { score, analysis } = result;
  const tone = score >= 70 ? "var(--success)" : score >= 40 ? "var(--warning)" : "var(--destructive)";

  return (
    <div className="glass space-y-6 rounded-2xl p-6 shadow-card">
      <div className="flex items-center gap-4">
        <div
          className="grid size-20 place-items-center rounded-2xl text-2xl font-bold"
          style={{ background: `color-mix(in oklch, ${tone} 20%, transparent)`, color: tone }}
        >
          {score}%
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="size-4" /> ATS keyword match
          </div>
          <Progress value={score} className="mt-2" />
          <p className="mt-2 text-sm">{analysis.summary}</p>
        </div>
      </div>

      <Section title="Skills detected in your resume" items={analysis.resume_skills} tone="primary" />
      <Section title="Skills the job requires" items={analysis.job_description_skills} tone="muted" />
      <Section
        title="Missing or weak skills to address"
        items={analysis.missing_skills}
        tone="destructive"
      />

      <div>
        <h4 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="size-4" /> Tailored bullet rewrites
        </h4>
        <ul className="space-y-2">
          {analysis.bullet_point_improvements.map((b, i) => (
            <li
              key={i}
              className="rounded-xl border border-border bg-input/30 p-4 text-sm leading-relaxed"
            >
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "primary" | "destructive" | "muted";
}) {
  if (!items?.length) return null;
  const cls =
    tone === "primary"
      ? "border-primary/30 bg-primary/10 text-primary"
      : tone === "destructive"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-input/40 text-foreground";
  return (
    <div>
      <h4 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {items.map((s, i) => (
          <span key={i} className={`rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
