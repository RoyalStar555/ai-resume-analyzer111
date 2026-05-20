import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { generateText } from "ai";
import { z } from "zod";

const AnalysisSchema = z.object({
  resume_skills: z.array(z.string()).describe("Core technical/professional skills found in the resume"),
  job_description_skills: z.array(z.string()).describe("Core skills the job description requires"),
  missing_skills: z.array(z.string()).describe("Skills in the JD that are missing or weak in the resume"),
  bullet_point_improvements: z
    .array(z.string())
    .describe("2-4 tailored resume bullet rewrites with action verbs and quantifiable results"),
  summary: z.string().describe("A 2-3 sentence executive summary of fit and recommended focus areas"),
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
        prompt: `You are an expert technical recruiter and ATS optimization expert. Analyze the resume against the job description.

Return ONLY a single JSON object (no markdown, no prose, no code fences) matching EXACTLY this TypeScript shape:

{
  "resume_skills": string[],           // core technical/professional skills found in the resume
  "job_description_skills": string[],  // core skills the job description requires
  "missing_skills": string[],          // skills in the JD missing or weak in the resume
  "bullet_point_improvements": string[], // 2-4 tailored resume bullet rewrites with action verbs and metrics
  "summary": string                    // 2-3 sentence executive summary of fit and focus areas
}

Use these EXACT keys. Do not invent other keys (no "match_score", "structural_critique", etc.).

JOB DESCRIPTION:
${data.jobDescription}

RESUME:
${data.resumeText}`,
      });
      analysis = AnalysisSchema.parse(extractJson(text));
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
