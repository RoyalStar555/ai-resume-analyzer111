export function ComparisonMetric({ label, a, b }: { label: string; a: number; b: number }) {
  const winner = a === b ? "tie" : a > b ? "a" : "b";
  return (
    <div className="rounded-xl border border-border bg-input/20 p-4">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">A / B</span>
      </div>
      <div className="mt-3 flex items-end gap-3 font-display text-2xl font-bold">
        <span className={winner === "a" ? "text-success" : ""}>{a}%</span>
        <span className="text-muted-foreground/50">/</span>
        <span className={winner === "b" ? "text-success" : ""}>{b}%</span>
      </div>
    </div>
  );
}
