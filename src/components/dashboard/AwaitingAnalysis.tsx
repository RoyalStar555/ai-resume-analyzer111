import { Activity, FileText, ScanSearch } from "lucide-react";

export function AwaitingAnalysis({
  threshold,
  onThresholdChange,
}: {
  threshold: number;
  onThresholdChange: (value: number) => void;
}) {
  return (
    <div className="space-y-4" aria-label="Analysis preview">
      <div className="grid gap-4 md:grid-cols-2">
        <PreviewCard title="ATS match profile" icon={<Activity className="size-4" />}>
          <div className="flex items-end justify-between border-b border-slate-100 pb-4">
            <div className="h-3 w-24 rounded bg-slate-100" />
            <span className="text-4xl font-medium text-emerald-600">85</span>
          </div>
          <svg viewBox="0 0 320 120" className="mt-4 h-28 w-full" aria-hidden="true">
            <path d="M18 104 C82 104 89 24 160 24 C231 24 238 104 302 104 L302 110 L18 110 Z" fill="var(--color-emerald-50)" />
            <path d="M18 104 C82 104 89 24 160 24 C231 24 238 104 302 104" fill="none" stroke="var(--color-emerald-500)" strokeWidth="2" />
            <circle cx="238" cy="72" r="5" fill="var(--color-emerald-600)" />
          </svg>
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>Entry</span><span>Avg Candidate</span><span>Expert</span>
          </div>
        </PreviewCard>

        <PreviewCard title="Skill gap analysis" icon={<ScanSearch className="size-4 text-rose-600" />} rose>
          <div className="flex flex-wrap gap-2 py-4">
            {["GraphQL Architecture", "System Design"].map((skill) => (
              <span key={skill} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                {skill}
              </span>
            ))}
          </div>
          <p className="border-t border-slate-100 pt-4 text-xs font-medium text-rose-600">
            Missing requirements detected: 2
          </p>
        </PreviewCard>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <FileText className="size-4" /> Tailored rewrites
          </h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              Original resume bullet appears here.
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-slate-900">
              <span className="mb-2 inline-flex rounded bg-emerald-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-700">ATS optimized</span>
              <p>AI-tailored, impact-focused rewrite appears after analysis.</p>
            </div>
          </div>
        </div>
      </div>

      <SimulationSlider threshold={threshold} onThresholdChange={onThresholdChange} />
    </div>
  );
}

function PreviewCard({ title, icon, rose, children }: { title: string; icon: React.ReactNode; rose?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative min-h-64 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="pointer-events-none select-none blur-sm opacity-60">
        <h3 className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider ${rose ? "text-rose-600" : "text-slate-500"}`}>
          {icon} {title}
        </h3>
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-white/60 backdrop-blur-md">
        <div className="text-center">
          <div className="mx-auto size-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
          <p className="mt-3 text-xs font-semibold text-slate-600">Awaiting analysis</p>
        </div>
      </div>
    </div>
  );
}

export function SimulationSlider({ threshold, onThresholdChange }: { threshold: number; onThresholdChange: (value: number) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Interactive test simulation</p>
          <p className="mt-1 text-xs text-slate-500">Target ATS threshold</p>
        </div>
        <output className="text-lg font-semibold text-slate-900">{threshold}%</output>
      </div>
      <input
        type="range"
        min="50"
        max="100"
        value={threshold}
        onChange={(event) => onThresholdChange(Number(event.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer accent-emerald-600"
        aria-label="Target ATS threshold"
      />
    </div>
  );
}