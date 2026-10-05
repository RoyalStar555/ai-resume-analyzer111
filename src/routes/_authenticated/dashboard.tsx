import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { EmptyPdfTextError, extractTextFromPdf } from "@/lib/pdf-parser";
import {
  analyzeResume,
  createResumeAbTest,
  listResumes,
  deleteResume,
  type ResumeAnalysis,
  type ResumeAnalysisResult,
} from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  Target,
  Sparkles,
  Check,
  StopCircle,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Download,
  Share2,
  TrendingUp,
  Building2,
  GraduationCap,
  ShieldAlert,
  Activity,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { BentoArea, BentoGrid } from "@/components/dashboard/BentoGrid";
import { AbComparisonView } from "@/components/dashboard/AbComparisonView";
import { AbTestInput } from "@/components/dashboard/AbTestInput";
import { PercentileBellCurve } from "@/components/dashboard/PercentileBellCurve";
import { SkillFlashcardDeck } from "@/components/dashboard/SkillFlashcardDeck";
import {
  AwaitingAnalysis,
  SimulationSlider,
  type AnalysisPreviewData,
} from "@/components/dashboard/AwaitingAnalysis";

function friendlyErrorMessage(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";
  if ((error as any)?.name === "AbortError") return "Analysis canceled";
  const message = String((error as any)?.message ?? error);
  if (
    message.toLowerCase().includes("jobdescription") ||
    message.toLowerCase().includes("job description") ||
    message.toLowerCase().includes("too short") ||
    message.toLowerCase().includes("min_length") ||
    message.toLowerCase().includes("validation") ||
    message.toLowerCase().includes("invalid")
  ) {
    return "Please paste a complete job description (at least 20 characters).";
  }
  if (
    message.toLowerCase().includes("resumetext") ||
    message.toLowerCase().includes("resume text")
  ) {
    return "Please upload a resume with extractable text.";
  }
  if (message.length > 160) return "Something went wrong. Please try again.";
  return message;
}

type Stage = "parsing" | "scoring" | "analyzing" | "saving" | "uploading";
const SAMPLE_ANALYSIS_PAYLOAD: AnalysisPreviewData = {
  matchScore: 85,
  missingSkills: ["GraphQL Architecture", "Docker Optimization"],
  originalBullet: "Built reusable React components for customer-facing product features.",
  bulletRewrites: [
    "Architected reusable React components that accelerated feature delivery by 30% across customer-facing workflows.",
  ],
};
const SIMULATION_STEPS = [
  "Extracting document text...",
  "Sanitizing PII data...",
  "Vectorizing skill metrics...",
  "Drafting ATS rewrites...",
];
const STAGES: { key: Stage; label: string }[] = [
  { key: "uploading", label: "Uploading resume" },
  { key: "parsing", label: "Reading PDF" },
  { key: "scoring", label: "Computing ATS keyword score" },
  { key: "analyzing", label: "Analyzing with Gemini AI" },
  { key: "saving", label: "Saving results" },
];

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Analyze your resume — ATS Lens" },
      {
        name: "description",
        content:
          "Upload a resume and a job description to get an ATS match score, missing keywords, and AI-tailored bullet rewrites.",
      },
      { property: "og:title", content: "Dashboard — ATS Lens" },
      {
        property: "og:description",
        content: "Run an AI ATS analysis on your resume against any job description.",
      },
      { property: "og:url", content: "https://ai-resume-analyzer111.lovable.app/dashboard" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://ai-resume-analyzer111.lovable.app/dashboard" }],
  }),
  component: Dashboard,
});

type AnalysisResult = ResumeAnalysisResult & {
  percentile?: number | null;
  percentileBenchmarkYear?: number | null;
};

function Dashboard() {
  const analyzeFn = useServerFn(analyzeResume);
  const createAbTestFn = useServerFn(createResumeAbTest);
  const listFn = useServerFn(listResumes);
  const deleteFn = useServerFn(deleteResume);
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [stage, setStage] = useState<Stage | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showMockData, setShowMockData] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [pendingResult, setPendingResult] = useState<{
    result: AnalysisResult;
    variants?: [AnalysisResult, AnalysisResult];
  } | null>(null);
  const [current, setCurrent] = useState<AnalysisResult | null>(null);
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);
  const [abVariants, setAbVariants] = useState<[AnalysisResult, AnalysisResult] | null>(null);
  const [mockScore, setMockScore] = useState(85);
  const [analysisPreview, setAnalysisPreview] = useState<AnalysisPreviewData | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const jdValid = jd.trim().length >= 20;

  useEffect(() => {
    if (!isAnalyzing) return;

    const intervalId = window.setInterval(() => {
      setLoadingStepIndex((index) => (index + 1) % SIMULATION_STEPS.length);
    }, 1200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAnalyzing]);

  useEffect(() => {
    if (!showMockData || !pendingResult) return;
    setCurrent(pendingResult.result);
    if (pendingResult.variants) setAbVariants(pendingResult.variants);
    setPendingResult(null);
  }, [showMockData, pendingResult]);

  const resetForInputChange = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStage(null);
    setIsAnalyzing(false);
    setShowMockData(false);
    setLoadingStepIndex(0);
    setCurrent(null);
    setAbVariants(null);
    setPendingResult(null);
    setAnalysisPreview(null);
    setMockScore(85);
  };

  const startAnalysisPreview = () => {
    toast.dismiss();
    setCurrent(null);
    setAbVariants(null);
    setLoadingStepIndex(0);
    setShowMockData(false);
    setPendingResult(null);
    setAnalysisPreview(null);
    setIsAnalyzing(true);
  };

  const history = useQuery({ queryKey: ["resumes"], queryFn: () => listFn() });

  const analyze = useMutation({
    mutationFn: async (): Promise<{ payload: AnalysisPreviewData; usedFallback: boolean }> => {
      if (!file) throw new Error("Please upload a PDF resume.");
      if (jd.trim().length < 20) throw new Error("Please paste a job description (20+ chars).");

      const controller = new AbortController();
      abortRef.current = controller;
      const throwIfAborted = () => {
        if (controller.signal.aborted) throw new DOMException("Canceled", "AbortError");
      };

      try {
        setStage("uploading");
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw authError ?? new Error("Sign in to analyze a resume.");
        throwIfAborted();

        const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "resume.pdf";
        const path = `${authData.user.id}/${crypto.randomUUID()}_${safeFilename}`;
        const { error: uploadError } = await supabase.storage
          .from("enterprise_ingestion_vault")
          .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
        if (uploadError) throw uploadError;
        throwIfAborted();

        setStage("analyzing");
        let data: unknown;
        try {
          const response = await supabase.functions.invoke("analyze-resume", {
            body: { storage_path: path, job_description: jd },
          });
          if (response.error) throw response.error;
          data = response.data;
        } catch (error) {
          if (controller.signal.aborted) throw error;
          return { payload: SAMPLE_ANALYSIS_PAYLOAD, usedFallback: true };
        }
        throwIfAborted();

        if (
          !data ||
          typeof data !== "object" ||
          !("matchScore" in data) ||
          typeof data.matchScore !== "number" ||
          !("missingSkills" in data) ||
          !Array.isArray(data.missingSkills)
        ) {
          throw new Error("The analysis service returned an invalid result.");
        }
        const rewrites = Array.isArray(data.bulletRewrites)
          ? data.bulletRewrites.filter((item: unknown): item is string => typeof item === "string")
          : typeof data.bulletRewrites === "string"
            ? [data.bulletRewrites]
            : [];
        const missingSkills = data.missingSkills.filter(
          (item: unknown): item is string => typeof item === "string",
        );
        if (!rewrites.length || missingSkills.length !== data.missingSkills.length) {
          throw new Error("The analysis service returned an incomplete result.");
        }
        return {
          payload: {
            matchScore: Math.max(0, Math.min(100, Math.round(data.matchScore))),
            missingSkills,
            bulletRewrites: rewrites,
          },
          usedFallback: false,
        };
      } catch (error) {
        throw error;
      }
    },
    onSuccess: ({ payload, usedFallback }) => {
      toast.dismiss();
      setAnalysisPreview(payload);
      setMockScore(payload.matchScore);
      setIsAnalyzing(false);
      setShowMockData(true);
      setStage(null);
      abortRef.current = null;
      if (usedFallback) {
        toast.error("Analysis failed. Please verify your connection and try again.");
      } else {
        toast.success(`Analysis complete — ${payload.matchScore}% match`);
      }
    },
    onError: (e: any) => {
      setStage(null);
      setIsAnalyzing(false);
      setShowMockData(false);
      setPendingResult(null);
      abortRef.current = null;
      const msg = e?.name === "AbortError"
        ? "Analysis canceled"
        : "Analysis failed. Please verify your connection and try again.";
      if (msg === "Analysis canceled") {
        toast(msg);
        return;
      }
      toast.error(msg);
    },
  });

  const compare = useMutation({
    mutationFn: async () => {
      if (!file || !secondaryFile) throw new Error("Choose two PDF resumes to compare.");
      if (!jdValid) throw new Error("Please paste a job description (20+ chars).");
      const controller = new AbortController();
      abortRef.current = controller;
      setStage("parsing");
      const [resumeTextA, resumeTextB] = await Promise.all([
        readResumeText(file, controller.signal),
        readResumeText(secondaryFile, controller.signal),
      ]);
      if (controller.signal.aborted) throw new DOMException("Canceled", "AbortError");
      setStage("scoring");
      await new Promise((resolve) => setTimeout(resolve, 250));
      setStage("analyzing");
      const test = await createAbTestFn({ data: { jobDescription: jd } });
      const variantA = await analyzeFn({
        data: {
          resumeText: resumeTextA,
          jobDescription: jd,
          filename: file.name,
          abTestId: test.id,
          variantLabel: "A",
        },
        signal: controller.signal,
      });
      const variantB = await analyzeFn({
        data: {
          resumeText: resumeTextB,
          jobDescription: jd,
          filename: secondaryFile.name,
          abTestId: test.id,
          variantLabel: "B",
        },
        signal: controller.signal,
      });
      setStage("saving");
      await new Promise((resolve) => setTimeout(resolve, 150));
      return [variantA, variantB] as [AnalysisResult, AnalysisResult];
    },
    onSuccess: (variants) => {
      toast.dismiss();
      setPendingResult({ result: variants[0], variants });
      setIsAnalyzing(false);
      setShowMockData(true);
      setStage(null);
      abortRef.current = null;
      qc.invalidateQueries({ queryKey: ["resumes"] });
      toast.success("A/B comparison complete");
    },
    onError: (error: Error) => {
      setStage(null);
      setIsAnalyzing(false);
      setShowMockData(false);
      setPendingResult(null);
      abortRef.current = null;
      const msg = friendlyErrorMessage(error);
      if (msg === "Analysis canceled") return toast("Comparison canceled");
      toast.error(msg);
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
    <BentoGrid>
      <BentoArea area="input">
        <div className="min-w-0 space-y-8">
          <div>
            <h1 className="font-display text-3xl font-semibold text-slate-950">Resume intelligence</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste the target job description and upload your resume PDF.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!file || !jdValid || isAnalyzing || running) return;
              startAnalysisPreview();
              analyze.mutate();
            }}
            className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="space-y-2">
              <Label htmlFor="jd">Job description</Label>
              <Textarea
                id="jd"
                rows={8}
                placeholder="Paste the full job description here…"
                value={jd}
                onChange={(e) => {
                  resetForInputChange();
                  setJd(e.target.value);
                }}
                readOnly={isAnalyzing || running}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Resume (PDF)</Label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 transition hover:border-emerald-500">
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
                  disabled={isAnalyzing || running}
                  onChange={(e) => {
                    resetForInputChange();
                    setFile(e.target.files?.[0] ?? null);
                  }}
                />
              </label>
            </div>

            {running && stage ? <StageTracker active={stage} /> : null}

            <div className="flex gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={!file || !jdValid || isAnalyzing || running}
                className="w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                <Sparkles className="mr-2 size-4" />
                Analyze match
              </Button>
              {running && (
                <Button type="button" variant="outline" size="lg" onClick={cancel}>
                  <StopCircle className="mr-2 size-4" />
                  Cancel
                </Button>
              )}
            </div>
          </form>

          <AbTestInput
            primaryFile={file}
            secondaryFile={secondaryFile}
            onSecondaryFileChange={(nextFile) => {
              resetForInputChange();
              setSecondaryFile(nextFile);
            }}
            onCompare={() => {
              if (!jdValid || isAnalyzing || running || compare.isPending) return;
              startAnalysisPreview();
              compare.mutate();
            }}
            disabled={isAnalyzing || running || compare.isPending}
            jdValid={jdValid}
          />
        </div>
      </BentoArea>

      <BentoArea area="report">
        {abVariants && <AbComparisonView variants={abVariants} />}

        {!current && (
          <AwaitingAnalysis
            threshold={mockScore}
            onThresholdChange={setMockScore}
            isAnalyzing={isAnalyzing}
            showMockData={showMockData}
            loadingMessage={SIMULATION_STEPS[loadingStepIndex]}
            analysisData={analysisPreview ?? undefined}
          />
        )}

        {current && (
          <SectionErrorBoundary label="Analysis results">
            <AnalysisCard
              result={current}
              simulationThreshold={mockScore}
              onSimulationThresholdChange={setMockScore}
            />
          </SectionErrorBoundary>
        )}
      </BentoArea>

      <BentoArea area="history">
        <aside className="space-y-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recent analyses</h2>
          {history.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {history.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No analyses yet.</p>
          )}
          <ul className="space-y-2">
            {history.data?.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <button
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() =>
                    setCurrent({
                      id: r.id,
                      score: r.ats_score,
                      analysis: r.analysis as unknown as ResumeAnalysis,
                      createdAt: r.created_at,
                      percentile: r.percentile,
                      percentileBenchmarkYear: r.percentile_benchmark_year,
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
      </BentoArea>
    </BentoGrid>
  );
}

async function readResumeText(file: File, signal: AbortSignal): Promise<string> {
  try {
    return await extractTextFromPdf(file);
  } catch (error) {
    if (!(error instanceof EmptyPdfTextError)) throw error;
    const { extractTextWithOcr } = await import("@/lib/ocr-parser");
    const text = await extractTextWithOcr(file, undefined, signal);
    if (text.length < 30) throw new EmptyPdfTextError();
    return text;
  }
}

function AnalysisCard({
  result,
  simulationThreshold,
  onSimulationThresholdChange,
}: {
  result: AnalysisResult;
  simulationThreshold: number;
  onSimulationThresholdChange: (value: number) => void;
}) {
  const { score, analysis } = result;
  const inner = analysis.analysis;
  const tone =
    score >= 70 ? "var(--success)" : score >= 40 ? "var(--warning)" : "var(--destructive)";

  const chartColors = useThemeChartColors();
  const chartData = (analysis.chart_data ?? []).filter((d) => d.value > 0);
  const aspects = analysis.aspect_scores ?? [];
  const rwc = analysis.real_world_connect ?? {
    target_roles: [],
    target_companies: [],
    market_upskill_advice: "",
  };
  const interviewProb = Math.max(0, Math.min(100, Math.round(analysis.interview_probability ?? 0)));

  const handlePrint = () => window.print();
  const handleShare = async () => {
    const txt = `ATS Match: ${score}% — Interview probability: ${interviewProb}%\n\nRecruiter's verdict: ${analysis.harsh_feedback_summary}`;
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm print:bg-white print:text-slate-950">
      {/* Export & share */}
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Button size="sm" variant="outline" onClick={handlePrint}>
          <Download className="mr-2 size-4" /> Download report (PDF)
        </Button>
        <Button size="sm" variant="outline" onClick={handleShare}>
          <Share2 className="mr-2 size-4" /> Copy shareable summary
        </Button>
      </div>

      {/* Section A: Top-level verdict */}
      <div className="flex items-center gap-4">
        <div
          className="grid size-20 place-items-center rounded-lg text-2xl font-semibold"
          style={{ background: `color-mix(in oklch, ${tone} 20%, transparent)`, color: tone }}
        >
          {score}%
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="size-4" /> ATS keyword match
          </div>
          <Progress value={score} className="mt-2" />
        </div>
      </div>

      {analysis.harsh_feedback_summary && (
        <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <h3 className="font-display text-sm font-semibold text-destructive">
              Recruiter's verdict
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90">
              {analysis.harsh_feedback_summary}
            </p>
          </div>
        </div>
      )}

      {/* Section B: Visual breakdown */}
      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <SectionErrorBoundary label="Evaluation breakdown">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Evaluation breakdown
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    stroke="var(--background)"
                    strokeWidth={2}
                    isAnimationActive={false}
                    label={({ value }) => `${value}%`}
                    labelLine={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                  >
                    {chartData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={chartColors[i % chartColors.length]}
                        style={{ fill: chartColors[i % chartColors.length] }}
                      />
                    ))}
                  </Pie>
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number, n: string) => [`${v}%`, n]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SectionErrorBoundary>

        <div className="space-y-4">
          <FeedbackList
            title="Strong points"
            items={inner.strong_points}
            tone="success"
            icon={<ThumbsUp className="size-4" />}
          />
          <FeedbackList
            title="Weak points"
            items={inner.weak_points}
            tone="destructive"
            icon={<ThumbsDown className="size-4" />}
          />
          <FeedbackList
            title="Suggestions"
            items={inner.suggestions}
            tone="primary"
            icon={<Lightbulb className="size-4" />}
          />
        </div>
      </div>

      {/* Advanced visualizations: Radar competency + Market alignment */}
      {(analysis.advanced_metrics?.radar_competency?.length ?? 0) +
        (analysis.advanced_metrics?.market_alignment?.length ?? 0) >
        0 && (
        <SectionErrorBoundary label="Competency & market charts">
          <div className="grid gap-6 md:grid-cols-2">
            {(analysis.advanced_metrics?.radar_competency?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <Activity className="size-4" /> Competency radar
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={analysis.advanced_metrics.radar_competency} outerRadius="75%">
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis
                        dataKey="domain"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      />
                      <Radar
                        name="Score"
                        dataKey="score"
                        stroke={chartColors[2]}
                        fill={chartColors[2]}
                        fillOpacity={0.45}
                      />
                      <RTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {(analysis.advanced_metrics?.market_alignment?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <TrendingUp className="size-4" /> Market alignment
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analysis.advanced_metrics.market_alignment}
                      margin={{ top: 8, right: 8, bottom: 8, left: -16 }}
                    >
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="category"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      />
                      <RTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="candidate"
                        name="Candidate"
                        fill={chartColors[0]}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="market"
                        name="Market 2026"
                        fill={chartColors[1]}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </SectionErrorBoundary>
      )}

      {/* Deep analysis: Impact audit + Red flags */}
      {(analysis.advanced_metrics?.deep_analysis?.impact_audit ||
        (analysis.advanced_metrics?.deep_analysis?.red_flags?.length ?? 0) > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {analysis.advanced_metrics?.deep_analysis?.impact_audit && (
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-primary">
                <Activity className="size-4" /> Impact audit
              </h3>
              <p className="text-sm leading-relaxed text-foreground/90">
                {analysis.advanced_metrics.deep_analysis.impact_audit}
              </p>
            </div>
          )}
          {(analysis.advanced_metrics?.deep_analysis?.red_flags?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-rose-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-destructive">
                <ShieldAlert className="size-4" /> Critical red flags
              </h3>
              <ul className="space-y-2 text-sm text-foreground/90">
                {analysis.advanced_metrics.deep_analysis.red_flags.map((rf, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-destructive" />
                    <span>{rf}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Advanced metrics */}
      {(aspects.length > 0 || interviewProb > 0) && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <TrendingUp className="size-4" /> Advanced metrics
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Interview prediction</span>
                <span className="font-display text-2xl font-bold text-primary">
                  {interviewProb}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-input">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${interviewProb}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Estimated likelihood of receiving a callback for this role based on resume strength.
              </p>
            </div>

            <div className="h-64 w-full">
              {aspects.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={aspects} outerRadius="75%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke={chartColors[0]}
                      fill={chartColors[0]}
                      fillOpacity={0.45}
                    />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Career mapping */}
      {(rwc.target_roles.length > 0 ||
        rwc.target_companies.length > 0 ||
        rwc.market_upskill_advice) && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Building2 className="size-4" /> Career mapping
          </h3>
          <div className="space-y-4">
            {rwc.target_roles.length > 0 && (
              <div>
                <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Roles you qualify for now
                </h5>
                <div className="flex flex-wrap gap-2">
                  {rwc.target_roles.map((r, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {rwc.target_companies.length > 0 && (
              <div>
                <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Companies that hire this stack
                </h5>
                <div className="flex flex-wrap gap-2">
                  {rwc.target_companies.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-input/40 px-3 py-1 text-xs font-medium"
                    >
                      <Building2 className="size-3" /> {c}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  These companies hire for this specific stack and resume profile.
                </p>
              </div>
            )}
            {rwc.market_upskill_advice && (
              <div className="flex gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
                <GraduationCap className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <h5 className="font-display text-sm font-semibold text-primary">Upskill next</h5>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                    {rwc.market_upskill_advice}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <PercentileBellCurve
          percentile={result.percentile}
          benchmarkYear={result.percentileBenchmarkYear}
        />
        <SkillFlashcardDeck skills={inner.missing_skills} />
      </div>

      {/* Career mapping (from advanced_metrics) */}
      {(() => {
        const cm = analysis.advanced_metrics?.career_mapping;
        const roles = cm?.target_roles ?? [];
        const companies = cm?.target_companies ?? [];
        const advice = cm?.upskill_advice ?? "";
        if (roles.length === 0 && companies.length === 0 && !advice) return null;
        return (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Building2 className="size-4" /> Career mapping
            </h3>
            <div className="space-y-4">
              {roles.length > 0 && (
                <div>
                  <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Target roles
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((r, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {companies.length > 0 && (
                <div>
                  <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Target companies
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {companies.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-input/40 px-3 py-1 text-xs font-medium"
                      >
                        <Building2 className="size-3" /> {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {advice && (
                <div className="flex gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
                  <GraduationCap className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <h5 className="font-display text-sm font-semibold text-primary">
                      Upskill advice
                    </h5>
                    <p className="mt-1 text-sm leading-relaxed text-foreground/90">{advice}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Section C: Preserved badges + rewrites */}

      <Section title="Skills detected in your resume" items={inner.resume_skills} tone="primary" />
      <Section title="Skills the job requires" items={inner.job_description_skills} tone="muted" />
      <Section
        title="Missing or weak skills to address"
        items={inner.missing_skills}
        tone="destructive"
      />

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <FileText className="size-4" /> Tailored bullet rewrites
        </h3>
        <ul className="space-y-2">
          {inner.bullet_point_improvements.map((b, i) => (
            <li key={i} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                <span className="mb-2 block text-[9px] font-semibold uppercase tracking-wider text-slate-400">Original</span>
                Resume bullet identified for improvement
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm leading-relaxed text-slate-900">
                <span className="mb-2 inline-flex rounded bg-emerald-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-700">ATS optimized</span>
                <p>{b}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <BonusFeaturesSection bonus={analysis.bonus_features} />

      <SimulationSlider
        threshold={simulationThreshold}
        onThresholdChange={onSimulationThresholdChange}
      />
    </div>
  );
}

function useThemeChartColors() {
  const [colors, setColors] = useState(["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]);
  useEffect(() => {
    const readColors = () => {
      const styles = getComputedStyle(document.documentElement);
      setColors([
        styles.getPropertyValue("--chart-1").trim() || "var(--chart-1)",
        styles.getPropertyValue("--chart-2").trim() || "var(--chart-2)",
        styles.getPropertyValue("--chart-3").trim() || "var(--chart-3)",
      ]);
    };
    readColors();
    const observer = new MutationObserver(readColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return colors;
}

function BonusFeaturesSection({ bonus }: { bonus: ResumeAnalysis["bonus_features"] }) {
  if (!bonus) return null;
  const verb = bonus.action_verb_audit;
  const portfolio = bonus.portfolio_github_impact;
  const salary = bonus.salary_estimate;
  const cover = bonus.generated_cover_letter ?? "";

  const copyCover = async () => {
    try {
      await navigator.clipboard.writeText(cover);
      toast.success("Cover letter copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Premium Tools & Extras
        </h3>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BonusMetricCard
          title="Action Verb Power"
          icon={<Activity className="size-4" />}
          score={verb?.score ?? 0}
          feedback={verb?.feedback ?? ""}
        />
        <BonusMetricCard
          title="Project & Portfolio Impact"
          icon={<Sparkles className="size-4" />}
          score={portfolio?.score ?? 0}
          feedback={portfolio?.feedback ?? ""}
        />
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <TrendingUp className="size-4" /> Estimated Market Salary
          </h4>
          <p className="mt-3 break-words font-display text-2xl font-semibold text-emerald-700">
            {salary?.range || "—"}
          </p>
          <p className="mt-3 break-words text-xs leading-relaxed text-foreground/80">
            {salary?.reasoning}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <FileText className="size-4" /> AI Generated Cover Letter
          </h4>
          <Button size="sm" variant="outline" onClick={copyCover} disabled={!cover}>
            <Check className="mr-1 size-3.5" /> Copy
          </Button>
        </div>
        <Textarea
          readOnly
          value={cover}
          className="min-h-[260px] resize-y whitespace-pre-wrap bg-slate-50 text-sm leading-relaxed"
          placeholder="Cover letter will appear here."
        />
      </div>
    </div>
  );
}

function BonusMetricCard({
  title,
  icon,
  score,
  feedback,
}: {
  title: string;
  icon: React.ReactNode;
  score: number;
  feedback: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h4 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {icon} {title}
      </h4>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold text-foreground">{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
      <Progress value={score} className="mt-2 h-2" />
      <p className="mt-3 text-xs leading-relaxed text-foreground/80">{feedback}</p>
    </div>
  );
}

function FeedbackList({
  title,
  items,
  tone,
  icon,
}: {
  title: string;
  items: string[];
  tone: "success" | "destructive" | "primary";
  icon: React.ReactNode;
}) {
  if (!items?.length) return null;
  const color =
    tone === "success"
      ? "text-success border-success/30 bg-success/10"
      : tone === "destructive"
        ? "text-destructive border-destructive/30 bg-destructive/10"
        : "text-primary border-primary/30 bg-primary/10";
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <h5 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        {icon} {title}
      </h5>
      <ul className="space-y-1 text-sm text-foreground/90">
        {items.map((it, i) => (
          <li key={i} className="leading-relaxed">
            • {it}
          </li>
        ))}
      </ul>
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
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "destructive"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <div>
      <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((s, i) => (
          <span key={i} className={`rounded-md border px-3 py-1 text-xs font-medium ${cls}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function StageTracker({ active }: { active: Stage }) {
  const activeIdx = STAGES.findIndex((s) => s.key === active);
  return (
    <ol className="space-y-2 rounded-xl border border-border bg-input/30 p-4">
      {STAGES.map((s, i) => {
        const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
        return (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span
              className={
                "grid size-6 place-items-center rounded-full border " +
                (state === "done"
                  ? "border-success/50 bg-success/15 text-success"
                  : state === "active"
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border bg-background/40 text-muted-foreground")
              }
            >
              {state === "done" ? (
                <Check className="size-3.5" />
              ) : state === "active" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <span className="size-1.5 rounded-full bg-current opacity-50" />
              )}
            </span>
            <span
              className={
                state === "pending"
                  ? "text-muted-foreground"
                  : state === "active"
                    ? "font-medium"
                    : ""
              }
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
