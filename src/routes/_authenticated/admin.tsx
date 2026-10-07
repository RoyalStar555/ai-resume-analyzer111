import { createFileRoute, redirect } from "@tanstack/react-router";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if (context.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Administration — ATS Lens" },
      { name: "description", content: "Administration workspace for ATS Lens." },
      { property: "og:title", content: "Administration — ATS Lens" },
      { property: "og:description", content: "Administration workspace for ATS Lens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <section className="mx-auto max-w-5xl py-8">
      <div className="flex items-center gap-3">
        <Shield className="size-6 text-primary" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enterprise controls</p>
          <h1 className="font-display text-2xl font-semibold">Administration</h1>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Administration tools will be available here.</p>
    </section>
  );
}