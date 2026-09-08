import { FileText, GitCompareArrows, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  primaryFile: File | null;
  secondaryFile: File | null;
  onSecondaryFileChange: (file: File | null) => void;
  onCompare: () => void;
  disabled?: boolean;
  jdValid?: boolean;
};

export function AbTestInput({
  primaryFile,
  secondaryFile,
  onSecondaryFileChange,
  onCompare,
  disabled,
  jdValid,
}: Props) {
  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <GitCompareArrows className="size-4" />
        </div>
        <div>
          <h2 className="font-display text-base font-semibold">Resume A/B test</h2>
          <p className="text-xs text-muted-foreground">
            Compare two versions against the same role.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-input/20 p-3 text-xs text-muted-foreground">
          <FileText className="mb-2 size-4 text-primary" />
          Variant A: {primaryFile?.name ?? "Choose a primary resume above"}
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-input/20 p-3 text-xs text-muted-foreground hover:border-primary/60">
          <Upload className="size-4 text-primary" />
          <span className="min-w-0 flex-1 truncate">
            {secondaryFile?.name ?? "Upload variant B"}
          </span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(event) => onSecondaryFileChange(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <Button
        className="mt-4 w-full"
        variant="outline"
        disabled={disabled || !primaryFile || !secondaryFile}
        onClick={onCompare}
      >
        <GitCompareArrows /> Compare variants
      </Button>
    </div>
  );
}
