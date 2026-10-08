import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BarChart3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { establishServerSession, getServerIdentity } from "@/lib/identity.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async () => {
    const identity = await getServerIdentity();
    if (identity) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — ATS Lens" },
      { name: "description", content: "Sign in securely to your ATS Lens resume intelligence workspace." },
      { property: "og:title", content: "Sign in — ATS Lens" },
      { property: "og:description", content: "Access your secure ATS Lens workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectPath } = Route.useSearch();
  const establishSessionFn = useServerFn(establishServerSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session || cancelled) return;
      try {
        await establishSessionFn({
          data: { accessToken: session.access_token, refreshToken: session.refresh_token },
        });
        if (!cancelled) await navigate({ to: "/dashboard" });
      } catch {
        // Keep the sign-in form available if an old browser session cannot be renewed.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [establishSessionFn, navigate]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (isCreatingAccount) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account, then sign in.");
          setIsCreatingAccount(false);
          return;
        }
        await establishSessionFn({
          data: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token },
        });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("Sign-in did not create a session.");
        await establishSessionFn({
          data: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token },
        });
      }
      toast.dismiss();
      toast.success(isCreatingAccount ? "Account created." : "Welcome back.");
      await navigate({ to: safeDestination(redirectPath) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-slate-900 p-12 text-white lg:flex xl:p-16">
        <Link to="/" className="inline-flex w-fit items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-white/10"><BarChart3 className="size-5" /></span>
          <span className="font-display text-lg font-semibold">ATS Lens</span>
        </Link>
        <div className="max-w-xl py-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Resume intelligence</p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight">Make every application count.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">A clear, consistent view of how your experience maps to the role ahead.</p>
          <div className="mt-10 flex items-center gap-3 border-t border-white/15 pt-5 text-sm text-slate-200">
            <ShieldCheck className="size-5 text-emerald-300" /> Private workspace with account-scoped access
          </div>
        </div>
        <p className="text-xs text-slate-400">ATS Lens · Enterprise workspace</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 inline-flex items-center gap-2 lg:hidden">
            <BarChart3 className="size-5 text-primary" /><span className="font-display font-semibold">ATS Lens</span>
          </Link>
          <div className="rounded-lg border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Secure access</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">{isCreatingAccount ? "Create your account" : "Welcome back"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{isCreatingAccount ? "Start with your email and password." : "Sign in to continue to your workspace."}</p>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete={isCreatingAccount ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
                {!isCreatingAccount && (
                  <button
                    type="button"
                    className="mt-1 self-end text-xs font-medium text-primary underline-offset-4 hover:underline"
                    onClick={async () => {
                      if (!email) {
                        toast.error("Enter your email first.");
                        return;
                      }
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) toast.error(error.message);
                      else toast.success("Password reset link sent. Check your email.");
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Button type="submit" disabled={loading} className="mt-1 w-full">
                {loading ? "Please wait…" : isCreatingAccount ? "Create account" : "Sign in"}
                {!loading && <ArrowRight className="ml-2 size-4" />}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isCreatingAccount ? "Already have an account?" : "New to ATS Lens?"}{" "}
              <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setIsCreatingAccount((value) => !value)}>
                {isCreatingAccount ? "Sign in" : "Create account"}
              </button>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function safeDestination(value: string | undefined): "/dashboard" {
  if (value?.startsWith("/dashboard") && !value.startsWith("//")) return "/dashboard";
  return "/dashboard";
}