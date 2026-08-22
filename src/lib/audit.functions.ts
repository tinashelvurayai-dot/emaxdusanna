import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminAudited } from "@/lib/security-middleware";
import { recordAnomaly, writeAudit } from "@/lib/audit.server";
import { validate, auditQuerySchema, sanitizeText } from "@/lib/validation";
import { withErrorHandling } from "@/lib/errors";

/* ------------------------------------------------------------------ *
 * Learner-facing
 * ------------------------------------------------------------------ */

/** Records login / logout for the audit trail and refreshes activity. */
export const recordAuthEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event: string; success?: boolean }) => ({
    event: ["login", "logout", "session_refresh"].includes(input?.event) ? input.event : "login",
    success: input?.success !== false,
  }))
  .handler(async ({ data, context }) =>
    withErrorHandling("recordAuthEvent", context.userId, async () => {
      await writeAudit({
        userId: context.userId,
        eventType: data.success ? data.event : `${data.event}_failed`,
        category: "security",
        severity: data.success ? "info" : "warning",
      });
      if (!data.success) {
        await recordAnomaly({
          userId: context.userId,
          anomalyType: "failed_authentication",
          points: 10,
          severity: "medium",
        });
      }
      await context.supabase.rpc("touch_last_active");
      return { logged: true };
    }),
  );

/** In-app engagement nudges for the signed-in learner. */
export const getMyNudges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_engagement")
      .select("id, nudge_type, message, created_at, read_at")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5);
    return { nudges: data ?? [] };
  });

export const dismissNudge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("user_engagement")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    return { dismissed: true };
  });

/** Client-side rage-click detector reports UX failures here. */
export const reportUxFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { route: string; elementLabel: string; clickCount: number; replayUrl?: string }) => ({
    route: sanitizeText(String(input?.route ?? "")).slice(0, 200),
    elementLabel: sanitizeText(String(input?.elementLabel ?? "")).slice(0, 160),
    clickCount: Math.min(Math.max(Number(input?.clickCount) || 0, 0), 1000),
    replayUrl: input?.replayUrl ? sanitizeText(input.replayUrl).slice(0, 500) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ux_failures").insert({
      user_id: context.userId,
      failure_type: "rage_click",
      route: data.route,
      element_label: data.elementLabel,
      click_count: data.clickCount,
      replay_url: data.replayUrl,
    });
    return { recorded: true };
  });

/* ------------------------------------------------------------------ *
 * Admin-facing
 * ------------------------------------------------------------------ */

export const queryAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(auditQuerySchema))
  .handler(async ({ data, context }) =>
    withErrorHandling("queryAuditLogs", context.userId, async () => {
      await assertAdminAudited(context as never);
      let query = context.supabase
        .from("audit_logs")
        .select("id, user_id, event_type, event_category, event_details, ip_address, user_agent, severity, created_at")
        .order("created_at", { ascending: false })
        .limit(data.limit);
      if (data.eventType) query = query.eq("event_type", data.eventType);
      if (data.userId) query = query.eq("user_id", data.userId);
      const { data: rows, error } = await query;
      if (error) throw new Error(error.message);
      return { rows: rows ?? [] };
    }),
  );

export const listSessionAnomalies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    withErrorHandling("listSessionAnomalies", context.userId, async () => {
      await assertAdminAudited(context as never);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [anomalies, ips] = await Promise.all([
        supabaseAdmin
          .from("session_anomalies")
          .select("id, user_id, anomaly_type, details, severity, points, ip_address, resolved, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("ip_reputation")
          .select("ip_address, anomaly_count, failed_logins, banned_until, last_seen_at, notes")
          .order("last_seen_at", { ascending: false })
          .limit(100),
      ]);
      return { anomalies: anomalies.data ?? [], ips: ips.data ?? [] };
    }),
  );

export const resolveAnomaly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) =>
    withErrorHandling("resolveAnomaly", context.userId, async () => {
      await assertAdminAudited(context as never);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("session_anomalies")
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: context.userId })
        .eq("id", data.id);
      await writeAudit({ userId: context.userId, eventType: "anomaly_resolved", details: { id: data.id } });
      return { resolved: true };
    }),
  );

/** Engagement view: churned learners, nudges sent, rage clicks. */
export const getEngagementOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    withErrorHandling("getEngagementOverview", context.userId, async () => {
      await assertAdminAudited(context as never);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [flagged, nudges, rage] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, last_active_at, engagement_segment, signup_type")
          .in("engagement_segment", ["churned", "reactivated"])
          .order("last_active_at", { ascending: true })
          .limit(200),
        supabaseAdmin
          .from("user_engagement")
          .select("id, user_id, nudge_type, message, created_at, read_at")
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("ux_failures")
          .select("id, user_id, route, element_label, click_count, replay_url, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      return { flagged: flagged.data ?? [], nudges: nudges.data ?? [], rageClicks: rage.data ?? [] };
    }),
  );

/**
 * Compliance report: for every closed account, what was anonymised, what was
 * retained, when the retention clock started and when it expires.
 */
export const getRetentionReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    withErrorHandling("getRetentionReport", context.userId, async () => {
      await assertAdminAudited(context as never);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [profiles, archive] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, deletion_status, deleted_at, anonymized_at")
          .neq("deletion_status", "active")
          .order("deleted_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("retention_archive")
          .select("original_user_id, kind, retain_until, created_at")
          .limit(2000),
      ]);

      const byUser = new Map<string, { kinds: Record<string, number>; retainUntil: string | null; clockStart: string | null }>();
      for (const row of archive.data ?? []) {
        const entry = byUser.get(row.original_user_id) ?? { kinds: {}, retainUntil: null, clockStart: null };
        entry.kinds[row.kind] = (entry.kinds[row.kind] ?? 0) + 1;
        if (!entry.retainUntil || row.retain_until > entry.retainUntil) entry.retainUntil = row.retain_until;
        if (!entry.clockStart || row.created_at < entry.clockStart) entry.clockStart = row.created_at;
        byUser.set(row.original_user_id, entry);
      }

      return {
        rows: (profiles.data ?? []).map((p) => {
          const a = byUser.get(p.id);
          return {
            userId: p.id,
            status: p.deletion_status,
            anonymizedIdentity: p.email,
            anonymizedFields: ["full_name", "email", "country", "city", "mobile_number", "school_name"],
            deletedAt: p.deleted_at,
            anonymizedAt: p.anonymized_at,
            retainedRecords: a?.kinds ?? {},
            retentionClockStart: a?.clockStart ?? p.deleted_at,
            retentionExpires: a?.retainUntil ?? null,
          };
        }),
      };
    }),
  );
