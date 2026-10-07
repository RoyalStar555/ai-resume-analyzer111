import { createFileRoute, redirect } from "@tanstack/react-router";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recruiter")({
  beforeLoad: ({ context }) => {
    if (context.role !== "recruiter" && context.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Recruiter workspace — ATS Lens" },
      { name: "description", content: "Enterprise recruiter workspace for ATS Lens." },
      { property: "og:title", content: "Recruiter workspace — ATS Lens" },
      { property: "og:description", content: "Enterprise recruiter workspace for ATS Lens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecruiterPage,
});

function RecruiterPage() {
  return (
    <section className="mx-auto max-w-5xl py-8">
      <div className="flex items-center gap-3">
        <Users className="size-6 text-primary" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enterprise workspace</p>
          <h1 className="font-display text-2xl font-semibold">Recruiter workspace</h1>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Recruiter tools will be available here.</p>
    </section>
  );
}