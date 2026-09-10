import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Records a UX failure (currently rage clicks) so repeated frustration on a
 * control surfaces in the admin engagement report. Called from the browser, so
 * it stays unauthenticated but writes a tightly validated row only.
 */
export const reportUxFailure = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      route?: string;
      elementLabel?: string;
      clickCount?: number;
      replayUrl?: string;
      failureType?: string;
    }) => {
      const clamp = (v: unknown, max: number) =>
        typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
      return {
        failureType: clamp(input?.failureType, 40) ?? "rage_click",
        route: clamp(input?.route, 300),
        elementLabel: clamp(input?.elementLabel, 200),
        clickCount: Math.min(Math.max(Number(input?.clickCount ?? 0) | 0, 0), 1000),
        replayUrl: clamp(input?.replayUrl, 500),
      };
    },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ux_failures").insert({
      failure_type: data.failureType,
      route: data.route,
      element_label: data.elementLabel,
      click_count: data.clickCount,
      replay_url: data.replayUrl,
    });
    return { success: true };
  });

/** Admin-only: recent UX failures, newest first. */
export const listUxFailures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin access required");
    const { data, error } = await context.supabase
      .from("ux_failures")
      .select("id, failure_type, route, element_label, click_count, replay_url, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { failures: data ?? [] };
  });
