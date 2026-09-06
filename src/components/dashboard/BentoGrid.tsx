import type { ReactNode } from "react";

export function BentoGrid({ children }: { children: ReactNode }) {
  return <div className="bento-grid">{children}</div>;
}

export function BentoArea({ area, children }: { area: string; children: ReactNode }) {
  return <section className={`bento-area bento-area-${area}`}>{children}</section>;
}
