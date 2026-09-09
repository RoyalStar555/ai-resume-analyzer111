import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };
  return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
          <div className="container mx-auto flex items-center justify-between gap-4 px-6 py-3">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-md bg-primary">
                <Sparkles className="size-5 text-primary-foreground" />
              </div>
              <span className="font-display text-base font-semibold text-slate-900">ATS Lens</span>
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="mr-2 size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 sm:px-6 lg:py-10">
          <Outlet />
        </main>
      </div>
  );
}
