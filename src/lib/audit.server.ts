import { getRequest, getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export type AuditCategory = "security" | "account" | "compliance" | "engagement" | "api" | "validation";
export type AuditSeverity = "info" | "warning" | "critical";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  route: string | null;
}

/** Best-effort request fingerprint for audit rows. Never throws. */
export function requestMeta(): RequestMeta {
  try {
    const request = getRequest();
    return {
      ip: getRequestIP({ xForwardedFor: true }) ?? null,
      userAgent: getRequestHeader("user-agent") ?? null,
      route: request ? new URL(request.url).pathname : null,
    };
  } catch {
    return { ip: null, userAgent: null, route: null };
  }
}

/**
 * Append a row to the immutable audit trail. Writes go through the service
 * role, so no client can forge or delete entries. Failures are swallowed —
 * auditing must never break a user action, but it is logged for Vercel.
 */
export async function writeAudit(entry: {
  userId?: string | null;
  eventType: string;
  category?: AuditCategory;
  details?: Record<string, unknown>;
  severity?: AuditSeverity;
}): Promise<void> {
  try {
    const meta = requestMeta();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      user_id: entry.userId ?? null,
      event_type: entry.eventType,
      event_category: entry.category ?? "security",
      event_details: { route: meta.route, ...(entry.details ?? {}) } as never,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      severity: entry.severity ?? "info",
    });
  } catch (error) {
    console.error("[audit] failed to write entry", entry.eventType, error);
  }
}

/** Record a session anomaly and return the caller's new rolling risk score. */
export async function recordAnomaly(entry: {
  userId: string;
  sessionId?: string | null;
  anomalyType: string;
  details?: Record<string, unknown>;
  severity?: "low" | "medium" | "high";
  points: number;
}): Promise<number> {
  const meta = requestMeta();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("session_anomalies").insert({
    user_id: entry.userId,
    session_id: entry.sessionId ?? null,
    anomaly_type: entry.anomalyType,
    details: (entry.details ?? {}) as never,
    severity: entry.severity ?? "low",
    points: entry.points,
    ip_address: meta.ip,
  });
  await writeAudit({
    userId: entry.userId,
    eventType: `anomaly:${entry.anomalyType}`,
    category: "security",
    details: entry.details,
    severity: entry.severity === "high" ? "critical" : "warning",
  });
  return await riskScore(entry.userId, entry.sessionId ?? null);
}

export async function riskScore(userId: string, sessionId: string | null = null): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("session_risk_score", {
    _user_id: userId,
    _session_id: sessionId,
  });
  return typeof data === "number" ? data : 0;
}

/**
 * Adaptive rate limit: 100 GET/min, 20 write/min per IP. Escalates to a
 * 10-minute throttle, then a 24-hour ban after 5 offences.
 */
export async function enforceRateLimit(opts: {
  key: string;
  method?: string;
}): Promise<{ allowed: boolean; reason?: string }> {
  const meta = requestMeta();
  const ip = meta.ip ?? "unknown";
  const method = (opts.method ?? "GET").toUpperCase();
  const isWrite = method !== "GET" && method !== "HEAD";
  const limit = isWrite ? 20 : 100;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("register_rate_limit_hit", {
      _bucket_key: `${ip}|${opts.key}|${isWrite ? "write" : "read"}`,
      _ip: ip,
      _method: method,
      _limit: limit,
      _window_seconds: 60,
    });
    const result = (data ?? {}) as { allowed?: boolean; reason?: string };
    if (result.allowed === false) {
      await writeAudit({
        eventType: "rate_limit_block",
        category: "api",
        severity: "warning",
        details: { ip, key: opts.key, method, reason: result.reason },
      });
      return { allowed: false, reason: result.reason ?? "rate_limited" };
    }
    return { allowed: true };
  } catch (error) {
    console.error("[rate-limit] check failed, allowing request", error);
    return { allowed: true };
  }
}
