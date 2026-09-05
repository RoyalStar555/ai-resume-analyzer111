import { Activity, LockKeyhole } from "lucide-react";

type Props = {
  percentile?: number | null;
  benchmarkYear?: number | null;
};

export function PercentileBellCurve({ percentile, benchmarkYear }: Props) {
  const hasBenchmark = typeof percentile === "number" && typeof benchmarkYear === "number";

  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Activity className="size-4 text-primary" /> Market percentile
        </h3>
        {hasBenchmark && <span className="font-mono text-xs text-muted-foreground">{benchmarkYear}</span>}
      </div>
      {hasBenchmark ? (
        <>
          <div className="relative mt-6 h-20 overflow-hidden rounded-t-[50%] border-t-2 border-primary/50 bg-primary/10">
            <div
              className="absolute bottom-0 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-background bg-primary shadow-glow"
              style={{ left: `${Math.max(4, Math.min(96, percentile))}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Needs work</span><span>Market median</span><span>Top tier</span>
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-primary">{percentile}th percentile</p>
        </>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-input/20 p-4">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            A market benchmark will appear when a verified role dataset matches this analysis. The ATS score is never presented as a market percentile without that benchmark.
          </p>
        </div>
      )}
    </div>
  );
}