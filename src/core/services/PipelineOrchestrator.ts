import { MinHeap, type ResumeJob } from "@/core/ds/MinHeapQueue";
import type { SemanticCache, CachedAnalysis } from "@/core/ds/SemanticCache";
import type { IDocumentParser } from "@/core/interfaces/DocumentParser";

export type JobOutcome =
  | { id: string; status: "completed"; source: "cache" | "dag"; result: CachedAnalysis }
  | { id: string; status: "retry_scheduled" | "dead_letter"; attempts: number; next_retry_at: string | null; error: string };

export interface SkillsResult { skills: string[] }
export interface ExperienceResult { years: number; roles: string[] }

export interface PipelineDeps {
  cache: SemanticCache;
  parser: IDocumentParser;
  loadFile: (storagePath: string) => Promise<ArrayBuffer>;
  persist: (id: string, patch: Record<string, unknown>) => Promise<void>;
  maxAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

export class PipelineOrchestrator {
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;

  constructor(private readonly deps: PipelineDeps) {
    this.maxAttempts = deps.maxAttempts ?? 5;
    this.baseBackoffMs = deps.baseBackoffMs ?? 30_000;
    this.maxBackoffMs = deps.maxBackoffMs ?? 3_600_000;
  }

  async processBatch(analysesRows: readonly ResumeJob[]): Promise<JobOutcome[]> {
    const queue = new MinHeap<ResumeJob>(analysesRows);
    const outcomes: JobOutcome[] = [];
    while (!queue.isEmpty()) {
      const job = queue.extractMin() as ResumeJob;
      outcomes.push(await this.processJob(job));
    }
    return outcomes;
  }

  private async processJob(job: ResumeJob): Promise<JobOutcome> {
    await this.deps.persist(job.id, { status: "processing" });
    try {
      if (!job.resume_storage_path) throw new Error("Missing resume_storage_path");
      const buffer = await this.deps.loadFile(job.resume_storage_path);
      const hash = await this.deps.cache.generateCompositeHash(buffer, job.job_description);

      const cached = await this.deps.cache.checkCache(hash);
      if (cached) {
        await this.deps.persist(job.id, {
          status: "completed", composite_hash: hash,
          parsed_profile: cached.parsed_profile, score_matrix: cached.score_matrix,
        });
        return { id: job.id, status: "completed", source: "cache", result: { ...cached, id: job.id } };
      }

      // DAG stage 1: parse. Stage 2: independent parallel branches.
      const text = await this.deps.parser.extractText(buffer);
      const [skills, experience] = await Promise.all([
        this.extractSkills(text),
        this.extractExperience(text),
      ]);
      const result: CachedAnalysis = {
        id: job.id,
        parsed_profile: { skills: skills.skills, experience: { years: experience.years, roles: experience.roles } },
        score_matrix: { skill_count: skills.skills.length, years: experience.years },
      };
      await this.deps.persist(job.id, {
        status: "completed", composite_hash: hash,
        parsed_profile: result.parsed_profile, score_matrix: result.score_matrix,
      });
      this.deps.cache.remember(hash, result);
      return { id: job.id, status: "completed", source: "dag", result };
    } catch (err) {
      const attempts = (job.attempts ?? 0) + 1;
      const dead = attempts >= this.maxAttempts;
      const next_retry_at = dead ? null : new Date(Date.now() + this.backoff(attempts)).toISOString();
      const message = err instanceof Error ? err.message : String(err);
      await this.deps.persist(job.id, {
        status: dead ? "dead_letter" : "retry_scheduled", attempts, next_retry_at, last_error: message,
      }).catch(() => undefined);
      return { id: job.id, status: dead ? "dead_letter" : "retry_scheduled", attempts, next_retry_at, error: message };
    } finally {
      // Hook for metrics / lock release.
    }
  }

  /** Exponential backoff with full jitter, capped. */
  private backoff(attempts: number): number {
    const ceiling = Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** (attempts - 1));
    return Math.floor(ceiling / 2 + Math.random() * (ceiling / 2));
  }

  // Simulated LLM tasks.
  protected async extractSkills(text: string): Promise<SkillsResult> {
    const known = ["react", "typescript", "node", "python", "sql", "docker", "graphql", "aws"];
    const lower = text.toLowerCase();
    return { skills: known.filter((k) => lower.includes(k)) };
  }

  protected async extractExperience(text: string): Promise<ExperienceResult> {
    const years = [...text.matchAll(/(\d{1,2})\+?\s*years?/gi)].map((m) => Number(m[1]));
    return { years: years.length ? Math.max(...years) : 0, roles: [] };
  }
}
