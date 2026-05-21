import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { generateText } from "ai";
import { z } from "zod";

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

const AnalysisSchema = z.object({
  success: z.boolean().default(true),
  harsh_feedback_summary: z.string(),
  chart_data: z.array(ChartDatumSchema).min(1),
  analysis: AnalysisInnerSchema,
  interview_probability: z.number().min(0).max(100).default(0),
  aspect_scores: z.array(AspectScoreSchema).default([]),
  real_world_connect: RealWorldSchema.default({ target_roles: [], target_companies: [], market_upskill_advice: "" }),
});

export type ResumeAnalysis = z.infer<typeof AnalysisSchema>;

function extractKeywords(text: string): string[] {
  const stop = new Set([
    "the","and","for","with","you","are","but","not","this","that","from","your","our","will","have","has","was","were","their","they","them","its","into","per","also","any","all","may","can","using","use","used",
  ]);
  return (text.toLowerCase().match(/\b[a-z][a-z+#.]{2,}\b/g) || []).filter((w) => !stop.has(w));
}

function computeAtsScore(jd: string, resume: string): number {
  const jdWords = [...new Set(extractKeywords(jd))];
  if (!jdWords.length) return 0;
  const resumeSet = new Set(extractKeywords(resume));
  const matches = jdWords.filter((w) => resumeSet.has(w));
  return Math.round((matches.length / jdWords.length) * 100);
}

function extractJson(text: string): unknown {
  let s = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = s.search(/[\{\[]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start === -1 || end === -1) throw new Error("AI returned no JSON.");
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    s = s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(s);
  }
}

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resumeText: string; jobDescription: string; filename?: string }) =>
    z
      .object({
        resumeText: z.string().min(20).max(50_000),
        jobDescription: z.string().min(20).max(20_000),
        filename: z.string().max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway is not configured.");

    const score = computeAtsScore(data.jobDescription, data.resumeText);

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    let analysis: ResumeAnalysis;
    try {
      const { text } = await generateText({
        model,
        prompt: `You are a ruthless, highly critical Senior Technical Recruiter and an advanced ATS. Critically analyze the resume against the job description. Do not give the candidate the benefit of the doubt. Penalize missing or vaguely mentioned required skills heavily.

Use this EXACT JSON schema response framework:
{
  "success": true,
  "harsh_feedback_summary": "Write 2-3 highly critical sentences explaining exactly why this candidate might be rejected based on the job requirements.",
  "chart_data": [
    { "name": "Strong Points", "value": <integer out of 100> },
    { "name": "Weak Points", "value": <integer out of 100> },
    { "name": "Actionable Suggestions", "value": <integer out of 100> }
  ],
  "analysis": {
    "strong_points": ["List 2-3 explicit strengths"],
    "weak_points": ["List 3-4 critical weaknesses or missing tech"],
    "suggestions": ["List 2-3 strategic suggestions to improve"],
    "resume_skills": ["list core technical skills identified in the resume"],
    "job_description_skills": ["list core technical skills expected in the job description"],
    "missing_skills": ["skills explicit in job description but missing or weak in resume"],
    "bullet_point_improvements": ["provide 2 tailored bullet points rewritten for high impact using quantifiable metrics"]
  }
}
Note: Ensure the 'value' integers in 'chart_data' add up to exactly 100.

Return ONLY the JSON object — no markdown, no code fences, no prose.

JOB DESCRIPTION:
${data.jobDescription}

RESUME:
${data.resumeText}`,
      });
      analysis = AnalysisSchema.parse(extractJson(text));

      // Normalize chart_data to sum to 100
      const sum = analysis.chart_data.reduce((a, b) => a + (b.value || 0), 0);
      if (sum > 0 && sum !== 100) {
        analysis.chart_data = analysis.chart_data.map((d) => ({
          ...d,
          value: Math.round((d.value / sum) * 100),
        }));
      }
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status;
      if (status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
      if (status === 402) throw new Error("AI credits exhausted. Add credits in Workspace Settings.");
      console.error("AI analysis failed:", err);
      throw new Error("AI analysis failed. Please try again.");
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
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("DB insert error:", error);
      throw new Error("Failed to save analysis.");
    }

    return { id: saved.id, score, analysis, createdAt: saved.created_at };
  });

export const listResumes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("resumes")
      .select("id, ats_score, filename, created_at, analysis")
      .order("created_at", { ascending: false })
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
