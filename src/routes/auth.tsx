import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — ATS Lens" },
      { name: "description", content: "Continue to the ATS Lens sign-in page." },
      { property: "og:title", content: "Sign in — ATS Lens" },
      { property: "og:description", content: "Continue to the ATS Lens sign-in page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => null,
});
