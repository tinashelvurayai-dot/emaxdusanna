import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Session-freshness gate.
 *
 * Rejects any access token that was issued BEFORE the learner's last password
 * change (or before their account was marked for deletion). Supabase access
 * tokens live for the configured JWT lifetime, so a stolen token would keep
 * working after a password reset — this closes that window server-side.
 *
 * Chain it after `requireSupabaseAuth` on every server function that reads or
 * writes learner data:
 *
 *   .middleware([requireFreshSession])
 */
export const requireFreshSession = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const issuedAtSeconds = Number((context.claims as { iat?: number }).iat ?? 0);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("last_password_change, deletion_status")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) throw new Error("Could not verify your session. Please sign in again.");

    if (data?.deletion_status && data.deletion_status !== "active") {
      throw new Error("This account has been closed.");
    }

    if (data?.last_password_change) {
      const changedAtSeconds = Math.floor(new Date(data.last_password_change).getTime() / 1000);
      // 5s grace: the token minted by the password update can share the second.
      if (issuedAtSeconds > 0 && issuedAtSeconds + 5 < changedAtSeconds) {
        throw new Error("Your password changed. Please sign in again.");
      }
    }

    return next({ context });
  });
