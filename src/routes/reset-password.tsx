import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. You're signed in.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <div className="mx-auto mt-24 w-full max-w-md px-6">
        <div className="glass rounded-2xl p-8 shadow-card">
          <h1 className="font-display text-2xl font-semibold">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              {loading ? "Saving…" : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
