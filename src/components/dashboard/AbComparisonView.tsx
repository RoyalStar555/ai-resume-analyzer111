import { GitCompareArrows, Trophy } from "lucide-react";
import type { ResumeAnalysis } from "@/lib/resume.functions";
import { ComparisonMetric } from "./ComparisonMetric";

type Variant = { score: number; analysis: ResumeAnalysis };

export function AbComparisonView({ variants }: { variants: [Variant, Variant] | null }) {
  if (!variants) return null;
  const [a, b] = variants;
  const winner = a.score === b.score ? "Tie" : a.score > b.score ? "Variant A" : "Variant B";
  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold">
        <GitCompareArrows className="size-4 text-primary" /> A/B comparison{" "}
        <span className="ml-auto flex items-center gap-1 text-xs text-success">
          <Trophy className="size-3" /> {winner}
        </span>
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ComparisonMetric label="ATS keyword match" a={a.score} b={b.score} />
        <ComparisonMetric
          label="Interview probability"
          a={a.analysis.interview_probability}
          b={b.analysis.interview_probability}
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Variant A verdict
          </p>
          <p className="text-sm leading-relaxed text-foreground/85">
            {a.analysis.harsh_feedback_summary}
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Variant B verdict
          </p>
          <p className="text-sm leading-relaxed text-foreground/85">
            {b.analysis.harsh_feedback_summary}
          </p>
        </div>
      </div>
    </div>
  );
}
