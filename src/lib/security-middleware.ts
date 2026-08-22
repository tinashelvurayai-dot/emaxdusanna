import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit, recordAnomaly, requestMeta, riskScore, writeAudit } from "@/lib/audit.server";

const CHALLENGE_THRESHOLD = 20;
const TERMINATE_THRESHOLD = 50;

/**
 * Runs on every authenticated request that opts in: adaptive rate limiting,
 * privilege-escalation and impossible-travel detection, and continuous risk
 * scoring. Score > 20 asks for re-authentication, score > 50 kills the session.
 *
 * Usage: `.middleware([requireSupabaseAuth, riskGuard])`
 */
export const riskGuard = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const userId = context.userId as string;
    const meta = requestMeta();
    const sessionId = (context.claims as { session_id?: string })?.session_id ?? null;

    const limit = await enforceRateLimit({ key: "server-fn", method: "POST" });
    if (!limit.allowed) {
      throw new Error("Too many requests. Please slow down and try again shortly.");
    }

    let score = await riskScore(userId, sessionId);

    // Impossible travel: same user, different IP within 5 minutes.
    if (meta.ip) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: recent } = await supabaseAdmin
        .from("audit_logs")
        .select("ip_address, created_at")
        .eq("user_id", userId)
        .not("ip_address", "is", null)
        .gt("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      const otherIp = (recent ?? []).find((r) => r.ip_address && r.ip_address !== meta.ip);
      if (otherIp) {
        score = await recordAnomaly({
          userId,
          sessionId,
          anomalyType: "impossible_travel",
          severity: "high",
          points: 25,
          details: { from: otherIp.ip_address, to: meta.ip, withinMinutes: 5 },
        });
      }
    }

    if (score > TERMINATE_THRESHOLD) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.signOut(userId, "global").catch(() => {});
      await writeAudit({
        userId,
        eventType: "session_terminated",
        severity: "critical",
        details: { score },
      });
      throw new Error("Your session was ended for security reasons. Please sign in again.");
    }

    return next({
      context: {
        riskScore: score,
        requiresChallenge: score > CHALLENGE_THRESHOLD,
      },
    });
  });

/** Guard for admin-only server functions; logs every escalation attempt. */
export async function assertAdminAudited(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) {
    await recordAnomaly({
      userId: context.userId,
      anomalyType: "privilege_escalation_attempt",
      severity: "high",
      points: 30,
      details: { route: requestMeta().route },
    });
    throw new Error("Forbidden: admin access required");
  }
  await writeAudit({ userId: context.userId, eventType: "admin_access", category: "security" });
}
