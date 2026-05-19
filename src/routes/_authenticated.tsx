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
    <div className="min-h-screen bg-background bg-mesh">
      <header className="border-b border-border/60 bg-background/40 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Sparkles className="size-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-semibold">ATS Lens</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 size-4" />
            Sign out
          </Button>
        </div>
      </header>
      <main className="container mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
