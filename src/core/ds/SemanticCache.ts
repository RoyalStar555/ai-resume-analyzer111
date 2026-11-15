import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";

export interface CachedAnalysis {
  id: string;
  parsed_profile: Json | null;
  score_matrix: Json | null;
}

export class SemanticCache {
  private readonly memory = new Map<string, CachedAnalysis>();

  // Loosely typed: `composite_hash` is a planned column not yet in generated types.
  constructor(private readonly client: SupabaseClient) {}

  async generateCompositeHash(pdfBuffer: ArrayBuffer, jobDescription: string): Promise<string> {
    const jd = new TextEncoder().encode(`\u0000${jobDescription.trim().replace(/\s+/g, " ")}`);
    const combined = new Uint8Array(pdfBuffer.byteLength + jd.byteLength);
    combined.set(new Uint8Array(pdfBuffer), 0);
    combined.set(jd, pdfBuffer.byteLength);
    const digest = await crypto.subtle.digest("SHA-256", combined);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** O(1) in-memory lookup, then an indexed DB lookup on completed analyses. */
  async checkCache(hash: string): Promise<CachedAnalysis | null> {
    const hit = this.memory.get(hash);
    if (hit) return hit;
    const { data, error } = await this.client
      .from("analyses")
      .select("id, parsed_profile, score_matrix")
      .eq("composite_hash", hash)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const result = data as CachedAnalysis;
    this.memory.set(hash, result);
    return result;
  }

  remember(hash: string, value: CachedAnalysis): void {
    this.memory.set(hash, value);
  }
}
