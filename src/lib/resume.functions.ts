import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const ChartDatumSchema = z.object({
  name: z.string(),
  value: z.number(),
});

const AnalysisInnerSchema = z.object({
  strong_points: z.array(z.string()).default([]),
  weak_points: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  resume_skills: z.array(z.string()).default([]),
  job_description_skills: z.array(z.string()).default([]),
  missing_skills: z.array(z.string()).default([]),
  bullet_point_improvements: z.array(z.string()).default([]),
});

const AspectScoreSchema = z.object({
  subject: z.string(),
  score: z.number().min(0).max(100),
});

const RealWorldSchema = z.object({
  target_roles: z.array(z.string()).default([]),
  target_companies: z.array(z.string()).default([]),
  market_upskill_advice: z.string().default(""),
});

const RadarCompetencySchema = z.object({
  domain: z.string(),
  score: z.number().min(0).max(100),
});

const MarketAlignmentSchema = z.object({
  category: z.string(),
  candidate: z.number().min(0).max(100),
  market: z.number().min(0).max(100),
});

const DeepAnalysisSchema = z.object({
  impact_audit: z.string().default(""),
  red_flags: z.array(z.string()).default([]),
});

const CareerMappingSchema = z.object({
  target_roles: z.array(z.string()).default([]),
  target_companies: z.array(z.string()).default([]),
  upskill_advice: z.string().default(""),
});

const AdvancedMetricsSchema = z.object({
  interview_probability: z.number().min(0).max(100).default(0),
  radar_competency: z.array(RadarCompetencySchema).default([]),
  market_alignment: z.array(MarketAlignmentSchema).default([]),
  deep_analysis: DeepAnalysisSchema.default({ impact_audit: "", red_flags: [] }),
  career_mapping: CareerMappingSchema.default({
    target_roles: [],
    target_companies: [],
    upskill_advice: "",
  }),
});

const BonusAuditSchema = z.object({
  score: z.number().min(0).max(100).default(0),
  feedback: z.string().default(""),
});

const SalaryEstimateSchema = z.object({
  range: z.string().default(""),
  reasoning: z.string().default(""),
});

const BonusFeaturesSchema = z.object({
  action_verb_audit: BonusAuditSchema.default({ score: 0, feedback: "" }),
  portfolio_github_impact: BonusAuditSchema.default({ score: 0, feedback: "" }),
  salary_estimate: SalaryEstimateSchema.default({ range: "", reasoning: "" }),
  generated_cover_letter: z.string().default(""),
});

const AnalysisSchema = z.object({
  success: z.boolean().default(true),
  harsh_feedback_summary: z.string(),
  chart_data: z.array(ChartDatumSchema).min(1),
  analysis: AnalysisInnerSchema,
  interview_probability: z.number().min(0).max(100).default(0),
  aspect_scores: z.array(AspectScoreSchema).default([]),
  real_world_connect: RealWorldSchema.default({
    target_roles: [],
    target_companies: [],
    market_upskill_advice: "",
  }),
  advanced_metrics: AdvancedMetricsSchema.default({
    interview_probability: 0,
    radar_competency: [],
    market_alignment: [],
    deep_analysis: { impact_audit: "", red_flags: [] },
    career_mapping: { target_roles: [], target_companies: [], upskill_advice: "" },
  }),
  bonus_features: BonusFeaturesSchema.default({
    action_verb_audit: { score: 0, feedback: "" },
    portfolio_github_impact: { score: 0, feedback: "" },
    salary_estimate: { range: "", reasoning: "" },
    generated_cover_letter: "",
  }),
});

export type ResumeAnalysis = z.infer<typeof AnalysisSchema>;

export type ResumeAnalysisResult = {
  id: string;
  score: number;
  analysis: ResumeAnalysis;
  createdAt: string;
  percentile?: number | null;
  percentileBenchmarkYear?: number | null;
  keywordDensity?: Record<string, unknown> | null;
  formattingMetrics?: Record<string, unknown> | null;
};

type AnalyzeInput = {
  resumeText: string;
  jobDescription: string;
  filename?: string;
  abTestId?: string;
  variantLabel?: "A" | "B";
};

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

// --- Smart keyword normalization ---
// Treat "React", "React.js", and "ReactJS" as the same skill.
const SKILL_ALIASES: Record<string, string> = {
  reactjs: "react",
  "react.js": "react",
  nodejs: "node",
  "node.js": "node",
  nextjs: "next",
  "next.js": "next",
  vuejs: "vue",
  "vue.js": "vue",
  expressjs: "express",
  "express.js": "express",
  ts: "typescript",
  js: "javascript",
  postgres: "postgresql",
  k8s: "kubernetes",
  gcp: "googlecloud",
  "google cloud": "googlecloud",
  "ci/cd": "cicd",
  ci: "cicd",
  golang: "go",
  "c#": "csharp",
  "c++": "cpp",
};

function canonicalize(token: string): string {
  const lower = token.toLowerCase();
  if (SKILL_ALIASES[lower]) return SKILL_ALIASES[lower];
  const stripped = lower.replace(/[\s_\-]+/g, "");
  if (SKILL_ALIASES[stripped]) return SKILL_ALIASES[stripped];
  // Strip trailing .js / js suffix variants ("reactjs" -> "react")
  const suffixStripped = stripped.replace(/(?:\.?js|\.?ts)$/i, "");
  if (suffixStripped && SKILL_ALIASES[suffixStripped]) return SKILL_ALIASES[suffixStripped];
  return suffixStripped || stripped;
}

function extractKeywords(text: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "you",
    "are",
    "but",
    "not",
    "this",
    "that",
    "from",
    "your",
    "our",
    "will",
    "have",
    "has",
    "was",
    "were",
    "their",
    "they",
    "them",
    "its",
    "into",
    "per",
    "also",
    "any",
    "all",
    "may",
    "can",
    "using",
    "use",
    "used",
    "work",
    "working",
    "team",
    "teams",
    "role",
    "roles",
    "year",
    "years",
  ]);
  const raw = text.toLowerCase().match(/\b[a-z][a-z0-9+#./]{1,30}\b/g) || [];
  return raw.map(canonicalize).filter((w) => w.length >= 2 && !stop.has(w));
}

function computeAtsScore(jd: string, resume: string): number {
  const jdWords = [...new Set(extractKeywords(jd))];
  if (!jdWords.length) return 0;
  const resumeSet = new Set(extractKeywords(resume));
  const matches = jdWords.filter((w) => resumeSet.has(w));
  return Math.round((matches.length / jdWords.length) * 100);
}

function computeKeywordDensity(jd: string, resume: string) {
  const required = [...new Set(extractKeywords(jd))];
  const resumeSet = new Set(extractKeywords(resume));
  const missing = required.filter((keyword) => !resumeSet.has(keyword));
  return {
    required_count: required.length,
    matched_count: required.length - missing.length,
    coverage_percent: required.length
      ? Math.round(((required.length - missing.length) / required.length) * 100)
      : 0,
    missing_keywords: missing.slice(0, 40),
  };
}

function inferRoleSlug(jobDescription: string): string | null {
  const roleRules: Array<[string, string[]]> = [
    ["senior-react-developer", ["senior react", "react developer", "react engineer"]],
    ["frontend-engineer", ["frontend engineer", "front-end engineer", "frontend developer"]],
    ["backend-engineer", ["backend engineer", "back-end engineer", "backend developer"]],
    ["full-stack-engineer", ["full stack", "full-stack"]],
    ["data-engineer", ["data engineer"]],
    ["product-manager", ["product manager"]],
  ];
  const lower = jobDescription.toLowerCase();
  return (
    roleRules.find(([, phrases]) => phrases.some((phrase) => lower.includes(phrase)))?.[0] ?? null
  );
}

function percentileFromCutPoints(score: number, cutPoints: unknown): number | null {
  if (!cutPoints || typeof cutPoints !== "object" || Array.isArray(cutPoints)) return null;
  const points = Object.entries(cutPoints)
    .map(([label, threshold]) => {
      const numericThreshold = Number(threshold);
      const percentile = Number(label.replace(/[^0-9]/g, ""));
      return Number.isFinite(numericThreshold) && percentile > 0
        ? { threshold: numericThreshold, percentile }
        : null;
    })
    .filter((point): point is { threshold: number; percentile: number } => point !== null)
    .sort((a, b) => a.threshold - b.threshold);
  if (!points.length) return null;
  let result = points[0].percentile;
  for (const point of points) {
    if (score >= point.threshold) result = point.percentile;
  }
  return Math.max(1, Math.min(99, result));
}

function extractJson(text: string): unknown {
  if (!text || typeof text !== "string") throw new Error("AI returned empty response.");
  let s = text
    .replace(/```(?:json|javascript|js)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = s.search(/[\{\[]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start === -1 || end === -1 || end < start) throw new Error("AI returned no JSON.");
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    s = s
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\x00-\x1F\x7F]/g, " ");
    return JSON.parse(s);
  }
}

const FALLBACK_CHART_DATA = [
  { name: "Strong Points", value: 33 },
  { name: "Weak Points", value: 34 },
  { name: "Actionable Suggestions", value: 33 },
];

function parseAnalysisResponse(text: string): ResumeAnalysis {
  const raw = extractJson(text);
  const parsed = AnalysisSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  console.warn("AI response failed strict schema, applying defaults:", parsed.error.issues);
  return AnalysisSchema.parse({
    ...(typeof raw === "object" && raw !== null ? raw : {}),
    harsh_feedback_summary:
      (raw as any)?.harsh_feedback_summary ??
      "Analysis returned partial data — some fields used safe defaults.",
    chart_data:
      Array.isArray((raw as any)?.chart_data) && (raw as any).chart_data.length
        ? (raw as any).chart_data
        : FALLBACK_CHART_DATA,
    analysis: (raw as any)?.analysis ?? {},
  });
}

function normalizeChartData(analysis: ResumeAnalysis): ResumeAnalysis {
  const sum = analysis.chart_data.reduce((total, datum) => total + (datum.value || 0), 0);
  if (sum <= 0 || sum === 100) return analysis;
  const normalized = analysis.chart_data.map((datum) => ({
    ...datum,
    value: Math.round((datum.value / sum) * 100),
  }));
  const normalizedSum = normalized.reduce((total, datum) => total + datum.value, 0);
  if (normalized.length > 0 && normalizedSum !== 100) {
    normalized[normalized.length - 1].value += 100 - normalizedSum;
  }
  return { ...analysis, chart_data: normalized };
}

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AnalyzeInput) =>
    z
      .object({
        resumeText: z.string().min(20).max(50_000),
        jobDescription: z.string().min(20).max(20_000),
        filename: z.string().max(255).optional(),
        abTestId: z.string().uuid().optional(),
        variantLabel: z.enum(["A", "B"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI gateway is not configured.");

    const score = computeAtsScore(data.jobDescription, data.resumeText);
    const keywordDensity = computeKeywordDensity(data.jobDescription, data.resumeText);
    const roleSlug = inferRoleSlug(data.jobDescription);

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    let analysis: ResumeAnalysis | undefined;
    try {
      const prompt = `You are an elite FAANG-level Senior Technical Recruiter and advanced ATS, benchmarking candidates against 2026 market standards. Be ruthless, never give the benefit of the doubt, and penalize missing or vaguely mentioned required skills heavily.

Use this EXACT merged JSON schema (return BOTH the new advanced_metrics AND the legacy analysis fields):
{
  "success": true,
  "harsh_feedback_summary": "2-3 highly critical sentences explaining exactly why this candidate might be rejected.",
  "chart_data": [
    { "name": "Strong Points", "value": <int> },
    { "name": "Weak Points", "value": <int> },
    { "name": "Actionable Suggestions", "value": <int> }
  ],
  "advanced_metrics": {
    "interview_probability": <int 0-100>,
    "radar_competency": [
      { "domain": "Frontend", "score": <int 0-100> },
      { "domain": "Backend", "score": <int 0-100> },
      { "domain": "Database", "score": <int 0-100> },
      { "domain": "Cloud/DevOps", "score": <int 0-100> },
      { "domain": "Architecture", "score": <int 0-100> }
    ],
    "market_alignment": [
      { "category": "Languages", "candidate": <int 0-100>, "market": <int 0-100> },
      { "category": "Frameworks", "candidate": <int 0-100>, "market": <int 0-100> },
      { "category": "Infrastructure", "candidate": <int 0-100>, "market": <int 0-100> }
    ],
    "deep_analysis": {
      "impact_audit": "Detailed critique on whether the bullet points show measurable business impact or just list duties.",
      "red_flags": ["List of 3 deal-breaking red flags"]
    },
    "career_mapping": {
      "target_roles": ["3 specific job titles this resume qualifies for"],
      "target_companies": ["3 real-world companies that hire this stack"],
      "upskill_advice": "Hyper-specific advice on what to learn next."
    }
  },
  "interview_probability": <int 0-100, mirror of advanced_metrics.interview_probability>,
  "aspect_scores": [
    { "subject": "Technical Depth", "score": <int 0-100> },
    { "subject": "Business Impact", "score": <int 0-100> },
    { "subject": "Formatting & Clarity", "score": <int 0-100> },
    { "subject": "Leadership/Initiative", "score": <int 0-100> }
  ],
  "real_world_connect": {
    "target_roles": ["mirror advanced_metrics.career_mapping.target_roles"],
    "target_companies": ["mirror advanced_metrics.career_mapping.target_companies"],
    "market_upskill_advice": "mirror advanced_metrics.career_mapping.upskill_advice"
  },
  "analysis": {
    "strong_points": ["List 2-3 explicit strengths"],
    "weak_points": ["List 3-4 critical weaknesses or missing tech"],
    "suggestions": ["List 2-3 strategic suggestions to improve"],
    "resume_skills": ["core technical skills identified in the resume"],
    "job_description_skills": ["core technical skills expected in the job description"],
    "missing_skills": ["skills explicit in job description but missing or weak in resume"],
    "bullet_point_improvements": ["2 tailored bullet points rewritten for high impact with quantifiable metrics"]
  },
  "bonus_features": {
    "action_verb_audit": {
      "score": <int 0-100>,
      "feedback": "Critique on whether the resume uses strong engineering action verbs (e.g., Architected, Deployed) or weak passive verbs."
    },
    "portfolio_github_impact": {
      "score": <int 0-100>,
      "feedback": "Critique on how well the candidate highlights their personal projects, hackathons, and repository links."
    },
    "salary_estimate": {
      "range": "e.g., $75,000 - $95,000",
      "reasoning": "Brief explanation based on matched skills and estimated seniority."
    },
    "generated_cover_letter": "A highly professional, 3-paragraph cover letter tailored specifically to the job description, using the candidate's strongest matching skills. Use \\n\\n between paragraphs."
  }
}

Note: 'chart_data' integers must add up to exactly 100.

Return ONLY the JSON object — no markdown, no code fences, no prose.

JOB DESCRIPTION:
${data.jobDescription}

RESUME:
${data.resumeText}`;

      let lastParseError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const result = await generateText({
            model,
            prompt,
          });
          try {
            analysis = normalizeChartData(parseAnalysisResponse(result.text));
            lastParseError = undefined;
            break;
          } catch (parseError) {
            lastParseError = parseError;
            if (attempt === 2) throw parseError;
            console.warn(
              `Retrying malformed AI analysis response (attempt ${attempt + 1})`,
              parseError,
            );
          }
        } catch (generationError) {
          throw generationError;
        }
      }
      if (!analysis) throw lastParseError ?? new Error("AI analysis returned no usable result.");
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status;
      if (status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
      if (status === 402)
        throw new Error("AI credits exhausted. Add credits in Workspace Settings.");
      if (status === 403)
        throw new Error("AI analysis is currently unavailable for this workspace.");
      if (status >= 500)
        throw new Error("The AI service is temporarily unavailable. Please try again.");
      console.error("AI analysis failed:", err);
      throw new Error("AI analysis failed. Please try again.");
    }

    let percentile: number | null = null;
    let percentileBenchmarkYear: number | null = null;
    if (roleSlug) {
      const { data: benchmark } = await supabase
        .from("role_market_benchmarks")
        .select("benchmark_year, percentile_cut_points")
        .eq("role_slug", roleSlug)
        .order("benchmark_year", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (benchmark) {
        percentile = percentileFromCutPoints(score, benchmark.percentile_cut_points);
        percentileBenchmarkYear = benchmark.benchmark_year;
      }
    }

    const { data: saved, error } = await supabase
      .from("resumes")
      .insert({
        user_id: userId,
        job_description: data.jobDescription,
        resume_text: data.resumeText,
        ats_score: score,
        analysis: analysis as any,
        filename: data.filename ?? null,
        ab_test_id: data.abTestId ?? null,
        variant_label: data.variantLabel ?? null,
        role_slug: roleSlug,
        percentile,
        percentile_benchmark_year: percentileBenchmarkYear,
        keyword_density: keywordDensity,
        formatting_metrics: {
          word_count: data.resumeText.trim().split(/\s+/).filter(Boolean).length,
          bullet_count: (data.resumeText.match(/(^|\n)\s*[•●▪◦*-]\s+/g) ?? []).length,
          heading_count: (data.resumeText.match(/(^|\n)\s*[A-Z][A-Z &/]{3,}\s*($|\n)/g) ?? [])
            .length,
          link_count: (data.resumeText.match(/https?:\/\/\S+/gi) ?? []).length,
        },
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("DB insert error:", error);
      throw new Error("Failed to save analysis.");
    }

    return {
      id: saved.id,
      score,
      analysis,
      createdAt: saved.created_at,
      percentile,
      percentileBenchmarkYear,
      keywordDensity,
      formattingMetrics: {
        word_count: data.resumeText.trim().split(/\s+/).filter(Boolean).length,
        bullet_count: (data.resumeText.match(/(^|\n)\s*[•●▪◦*-]\s+/g) ?? []).length,
        link_count: (data.resumeText.match(/https?:\/\/\S+/gi) ?? []).length,
      },
    };
  });

export const createResumeAbTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobDescription: string }) =>
    z.object({ jobDescription: z.string().min(20).max(20_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: test, error } = await context.supabase
      .from("resume_ab_tests")
      .insert({ user_id: context.userId, job_description: data.jobDescription })
      .select("id")
      .single();
    if (error) throw new Error("Could not start the A/B test.");
    return { id: test.id };
  });

export const listResumes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("resumes")
      .select(
        "id, ats_score, filename, created_at, analysis, percentile, percentile_benchmark_year, keyword_density, formatting_metrics",
      )
      .order("created_at", { ascending: false })
      .is("ab_test_id", null)
      .limit(20);
    if (error) throw new Error(error.message);
    return data;
  });

export const deleteResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("resumes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
