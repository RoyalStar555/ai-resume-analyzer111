import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getServerIdentity } from "@/lib/identity.functions";
import { clearServerSession } from "@/lib/identity.functions";
import { BarChart3, LogOut, Shield, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const identity = await getServerIdentity();
    if (!identity) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return identity;
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const clearServerSessionFn = useServerFn(clearServerSession);
  const signOut = async () => {
    try {
      await clearServerSessionFn();
    } catch {
      toast.error("Could not securely sign out. Please try again.");
      return;
    }
    await supabase.auth.signOut();
    toast.dismiss();
    toast.success("Signed out");
    navigate({ to: "/login", search: { redirect: undefined }, replace: true });
  };
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-md bg-primary">
              <BarChart3 className="size-5 text-primary-foreground" />
            </div>
            <span className="font-display text-base font-semibold text-slate-900">ATS Lens</span>
          </Link>
          <nav aria-label="Main navigation" className="order-3 flex w-full items-center gap-1 sm:order-2 sm:w-auto">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><BarChart3 className="mr-2 size-4" />Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/recruiter"><Users className="mr-2 size-4" />Recruiter</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin"><Shield className="mr-2 size-4" />Admin</Link>
            </Button>
          </nav>
          <div className="order-2 flex items-center gap-3 sm:order-3">
            <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:block">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 size-4" />Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:py-10"><Outlet /></main>
    </div>
  );
}
