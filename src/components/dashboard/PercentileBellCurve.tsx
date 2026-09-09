import { Activity, LockKeyhole } from "lucide-react";

type Props = {
  percentile?: number | null;
  benchmarkYear?: number | null;
};

export function PercentileBellCurve({ percentile, benchmarkYear }: Props) {
  const hasBenchmark = typeof percentile === "number" && typeof benchmarkYear === "number";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <Activity className="size-4 text-emerald-600" /> ATS match profile
        </h3>
        {hasBenchmark && (
          <span className="text-4xl font-medium text-emerald-600">{percentile}</span>
        )}
      </div>
      {hasBenchmark ? (
        <>
          <svg viewBox="0 0 320 120" className="mt-4 h-28 w-full" role="img" aria-label={`${percentile}th percentile on the market bell curve`}>
            <path d="M18 104 C82 104 89 24 160 24 C231 24 238 104 302 104 L302 110 L18 110 Z" fill="var(--color-emerald-50)" />
            <path d="M18 104 C82 104 89 24 160 24 C231 24 238 104 302 104" fill="none" stroke="var(--color-emerald-500)" strokeWidth="2" />
            <circle cx={18 + Math.max(0, Math.min(100, percentile)) * 2.84} cy="72" r="5" fill="var(--color-emerald-600)" />
          </svg>
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>Entry</span>
            <span>Avg Candidate</span>
            <span>Expert</span>
          </div>
          <div className="mt-4 grid grid-cols-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <div><p className="text-xs text-slate-400">Percentile</p><p className="mt-1 font-medium">{percentile}th</p></div>
            <div className="border-l border-slate-100 pl-4"><p className="text-xs text-slate-400">Benchmark</p><p className="mt-1 font-medium">{benchmarkYear}</p></div>
          </div>
        </>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            A market benchmark will appear when a verified role dataset matches this analysis. The
            ATS score is never presented as a market percentile without that benchmark.
          </p>
        </div>
      )}
    </div>
  );
}
