import { useState } from "react";
import { ArrowLeft, ArrowRight, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SkillFlashcardDeck({ skills }: { skills: string[] }) {
  const [index, setIndex] = useState(0);
  if (!skills.length) return null;
  const current = skills[index % skills.length];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-rose-600">
          <BrainCircuit className="size-4 text-primary" /> Skill flashcards
        </h3>
        <span className="font-mono text-xs text-muted-foreground">
          {(index % skills.length) + 1}/{skills.length}
        </span>
      </div>
      <div className="mt-5 min-h-28 rounded-lg border border-rose-200 bg-rose-50 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">Focus next</p>
        <p className="mt-2 break-words font-display text-xl font-semibold">{current}</p>
        <p className="mt-2 text-xs text-slate-600">
          Add proof, outcomes, or a project example for this skill.
        </p>
      </div>
      <p className="mt-3 text-xs font-medium text-rose-600">Missing requirements detected: {skills.length}</p>
      <div className="mt-4 flex justify-between">
        <Button
          size="icon"
          variant="outline"
          onClick={() => setIndex((value) => (value - 1 + skills.length) % skills.length)}
          aria-label="Previous skill"
        >
          <ArrowLeft />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setIndex((value) => (value + 1) % skills.length)}
          aria-label="Next skill"
        >
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
