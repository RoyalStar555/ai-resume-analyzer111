import { Activity, FileText, ScanSearch } from "lucide-react";

export type AnalysisPreviewData = {
  matchScore: number;
  missingSkills: string[];
  originalBullet?: string;
  bulletRewrites: string[];
};

export function AwaitingAnalysis({
  threshold,
  onThresholdChange,
  isAnalyzing,
  showMockData,
  loadingMessage,
  analysisData,
}: {
  threshold: number;
  onThresholdChange: (value: number) => void;
  isAnalyzing: boolean;
  showMockData: boolean;
  loadingMessage: string;
  analysisData?: AnalysisPreviewData;
}) {
  const curveX = 18 + Math.max(0, Math.min(100, threshold)) * 2.84;
  const curveY = 104 - 80 * Math.exp(-0.5 * ((threshold - 50) / 23) ** 2);

  return (
    <div className="space-y-4" aria-label="Analysis preview">
      <div className="grid gap-4 md:grid-cols-2">
        <PreviewCard title="ATS match profile" icon={<Activity className="size-4" />} isAnalyzing={isAnalyzing} showMockData={showMockData} loadingMessage={loadingMessage}>
          <div className="flex items-end justify-between border-b border-slate-100 pb-4">
            <div className="h-3 w-24 rounded bg-slate-100" />
            <span className="text-4xl font-medium text-emerald-600">{threshold}</span>
          </div>
          <svg viewBox="0 0 320 120" className="mt-4 h-28 w-full" aria-hidden="true">
            <path d="M18 104 C82 104 89 24 160 24 C231 24 238 104 302 104 L302 110 L18 110 Z" fill="var(--color-emerald-50)" />
            <path d="M18 104 C82 104 89 24 160 24 C231 24 238 104 302 104" fill="none" stroke="var(--color-emerald-500)" strokeWidth="2" />
            <circle cx={curveX} cy={curveY} r="5" fill="var(--color-emerald-600)" />
          </svg>
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>Entry</span><span>Avg Candidate</span><span>Expert</span>
          </div>
        </PreviewCard>

        <PreviewCard title="Skill gap analysis" icon={<ScanSearch className="size-4 text-rose-600" />} rose isAnalyzing={isAnalyzing} showMockData={showMockData} loadingMessage={loadingMessage}>
          <div className="flex flex-wrap gap-2 py-4">
            {(analysisData?.missingSkills.length ? analysisData.missingSkills : ["GraphQL Architecture", "Docker Optimization"]).map((skill) => (
              <span key={skill} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                {skill}
              </span>
            ))}
          </div>
          <p className="border-t border-slate-100 pt-4 text-xs font-medium text-rose-600">
            Missing requirements detected: {analysisData?.missingSkills.length ?? 2}
          </p>
        </PreviewCard>

        <PreviewCard title="Tailored rewrites" icon={<FileText className="size-4" />} isAnalyzing={isAnalyzing} showMockData={showMockData} loadingMessage={loadingMessage} className="md:col-span-2">
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              {showMockData ? analysisData?.originalBullet ?? "Built reusable React components for customer-facing product features." : "Original resume bullet appears here."}
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-slate-900">
              <span className="mb-2 inline-flex rounded bg-emerald-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-700">ATS optimized</span>
              <p>{showMockData ? analysisData?.bulletRewrites[0] ?? "Architected reusable React components that accelerated feature delivery by 30% across customer-facing workflows." : "AI-tailored, impact-focused rewrite appears after analysis."}</p>
            </div>
          </div>
        </PreviewCard>
      </div>

      <SimulationSlider threshold={threshold} onThresholdChange={onThresholdChange} />
    </div>
  );
}

function PreviewCard({ title, icon, rose, children, isAnalyzing, showMockData, loadingMessage, className }: {
  title: string;
  icon: React.ReactNode;
  rose?: boolean;
  children: React.ReactNode;
  isAnalyzing: boolean;
  showMockData: boolean;
  loadingMessage: string;
  className?: string;
}) {
  return (
    <div className={`relative min-h-64 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className ?? ""}`}>
      <div className={`pointer-events-none select-none ${showMockData ? "" : "blur-sm opacity-60"}`}>
        <h3 className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider ${rose ? "text-rose-600" : "text-slate-500"}`}>
          {icon} {title}
        </h3>
        {children}
      </div>
      {!showMockData && (
        <div className="absolute inset-0 grid place-items-center bg-white/60 px-5 backdrop-blur-md">
          <div className="w-full max-w-64 text-center" aria-live="polite">
            <p className="min-h-5 text-xs font-semibold text-slate-600">{isAnalyzing ? loadingMessage : "Awaiting analysis"}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full bg-emerald-500 ${isAnalyzing ? "w-2/3 animate-pulse" : "w-1/4"}`} />
            </div>
          </div>
        </div>
      )}
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
        min="0"
        max="100"
        value={threshold}
        onChange={(event) => onThresholdChange(Number(event.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer accent-emerald-600"
        aria-label="Target ATS threshold"
      />
    </div>
  );
}