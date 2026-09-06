import { useState } from "react";
import { ArrowLeft, ArrowRight, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SkillFlashcardDeck({ skills }: { skills: string[] }) {
  const [index, setIndex] = useState(0);
  if (!skills.length) return null;
  const current = skills[index % skills.length];

  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <BrainCircuit className="size-4 text-primary" /> Skill flashcards
        </h3>
        <span className="font-mono text-xs text-muted-foreground">
          {(index % skills.length) + 1}/{skills.length}
        </span>
      </div>
      <div className="mt-5 min-h-28 rounded-xl border border-primary/30 bg-primary/10 p-5">
        <p className="text-xs uppercase tracking-wider text-primary">Focus next</p>
        <p className="mt-2 break-words font-display text-xl font-semibold">{current}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Add proof, outcomes, or a project example for this skill.
        </p>
      </div>
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
