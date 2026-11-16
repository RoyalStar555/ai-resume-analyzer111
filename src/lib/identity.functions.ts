import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getRequest, setCookie, setResponseHeader } from "@tanstack/react-start/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type ServerIdentity = {
  user: { id: string; email: string | null };
  role: string;
  orgId: string | null;
};

function parseRequestCookies(cookieHeader: string | null) {
  if (!cookieHeader) return [];
  return cookieHeader.split(";").flatMap((cookie) => {
    const separator = cookie.indexOf("=");
    if (separator < 0) return [];
    const name = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();
    if (!name) return [];
    try {
      return [{ name, value: decodeURIComponent(value) }];
    } catch {
      return [{ name, value }];
    }
  });
}

function createRequestSupabase(url: string, key: string) {
  const request = getRequest();
  setResponseHeader("Cache-Control", "private, no-store");
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => parseRequestCookies(request.headers.get("cookie")),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          setCookie(name, value, {
            ...options,
            httpOnly: true,
            secure: new URL(request.url).protocol === "https:",
            sameSite: "lax",
            path: "/",
          });
        }
      },
    },
  });
}

function resolveCloudConfig() {
  const url =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Supabase Auth Error:", `Missing config (url: ${Boolean(url)}, key: ${Boolean(key)})`);
    throw new Error("Cloud authentication is not configured.");
  }
  return { url: url as string, key: key as string };
}

async function resolveIdentity(supabase: SupabaseClient<Database>): Promise<ServerIdentity | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) console.error("Supabase Auth Error:", error.message);
  if (error || !data.user) return null;

  const user = data.user;
  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role, org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) throw new Error("Unable to verify your account permissions.");

  if (!roleRow) {
    const { data: insertedRole, error: insertError } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "candidate" })
      .select("role, org_id")
      .single();
    if (insertError || !insertedRole) {
      // Concurrent requests can both observe no row; read the row created by the winner.
      const { data: recoveredRole, error: recoveryError } = await supabase
        .from("user_roles")
        .select("role, org_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (recoveryError || !recoveredRole) {
        throw new Error("Unable to initialize your account permissions.");
      }
      return {
        user: { id: user.id, email: user.email ?? null },
        role: recoveredRole.role,
        orgId: recoveredRole.org_id,
      };
    }
    return {
      user: { id: user.id, email: user.email ?? null },
      role: insertedRole.role,
      orgId: insertedRole.org_id,
    };
  }

  return {
    user: { id: user.id, email: user.email ?? null },
    role: roleRow.role,
    orgId: roleRow.org_id,
  };
}

export const getServerIdentity = createServerFn({ method: "GET" }).handler(async () => {
  const { url, key } = resolveCloudConfig();
  return resolveIdentity(createRequestSupabase(url, key));
});

export const establishServerSession = createServerFn({ method: "POST" })
  .validator(
    z.object({
      accessToken: z.string().min(1),
      refreshToken: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { url, key } = resolveCloudConfig();
    const supabase = createRequestSupabase(url, key);
    const { error } = await supabase.auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    });
    if (error) console.error("Supabase Auth Error:", error.message);
    if (error) throw new Error("Unable to establish a secure sign-in session.");
    const identity = await resolveIdentity(supabase);
    if (!identity) throw new Error("Unable to verify the signed-in account.");
    return identity;
  });

export const clearServerSession = createServerFn({ method: "POST" }).handler(async () => {
  const { url, key } = resolveCloudConfig();
  const request = getRequest();
  const supabase = createRequestSupabase(url, key);
  await supabase.auth.signOut();
  for (const { name } of parseRequestCookies(request.headers.get("cookie"))) {
    if (name.startsWith("sb-") && name.includes("auth-token")) {
      deleteCookie(name, { path: "/", sameSite: "lax" });
    }
  }
  return { ok: true };
});