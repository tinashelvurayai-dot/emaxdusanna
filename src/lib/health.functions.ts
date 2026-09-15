import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminServerDb, hasServiceRole } from "@/lib/db.server";

export type HealthState = "ok" | "warn" | "down";

export interface HealthCheck {
  id: string;
  label: string;
  state: HealthState;
  detail: string;
  ms?: number;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; result?: T; error?: string }> {
  const start = Date.now();
  try {
    const result = await fn();
    return { ms: Date.now() - start, result };
  } catch (err) {
    return { ms: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Backend health snapshot for the admin dashboard: database reachability,
 * per-table read checks, auth service, error monitoring wiring and payment
 * configuration. Admin-only.
 */
export const getBackendHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin access required");

    const supabaseAdmin = await adminServerDb(context);
    const privileged = hasServiceRole();
    const checks: HealthCheck[] = [];

    // --- Database + per-table reads -------------------------------------
    const tables = [
      "profiles",
      "enrollments",
      "course_progress",
      "certificate_payments",
      "alt_payment_requests",
      "user_roles",
      "enrollment_certificate_ids",
      "contracted_schools",
      "school_admins",
      "site_settings",
      "special_program_diplomas",
      "partnership_program_requests",
    ] as const;

    let dbWorst: HealthState = "ok";
    let dbMs = 0;
    for (const table of tables) {
      const r = await timed(async () => {
        const { error, count } = await supabaseAdmin
          .from(table)
          .select("*", { count: "exact", head: true });
        if (error) throw new Error(error.message);
        return count ?? 0;
      });
      dbMs = Math.max(dbMs, r.ms);
      const state: HealthState = r.error ? "down" : r.ms > 2000 ? "warn" : "ok";
      if (state === "down") dbWorst = "down";
      else if (state === "warn" && dbWorst === "ok") dbWorst = "warn";
      checks.push({
        id: `table:${table}`,
        label: `Table: ${table}`,
        state,
        ms: r.ms,
        detail: r.error ? r.error : `${r.result} rows readable`,
      });
    }

    checks.unshift({
      id: "database",
      label: "Database connection",
      state: dbWorst,
      ms: dbMs,
      detail:
        dbWorst === "ok"
          ? "All tables reachable"
          : dbWorst === "warn"
            ? "Reachable but slow responses detected"
            : "One or more tables are unreachable",
    });

    // --- Auth service ----------------------------------------------------
    const auth = privileged ? await timed(async () => {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error) throw new Error(error.message);
      return data.users.length;
    }) : { ms: 0, error: undefined as string | undefined };
    checks.push({
      id: "auth",
      label: "Authentication service",
      state: !privileged ? "warn" : auth.error ? "down" : auth.ms > 2500 ? "warn" : "ok",
      ms: privileged ? auth.ms : undefined,
      detail: !privileged
        ? "Skipped - private service key is not configured on this deployment"
        : (auth.error ?? "Auth admin API responding"),
    });

    // --- Enrollment trigger (certificate ID allocation) ------------------
    const trigger = await timed(async () => {
      const { count, error } = await supabaseAdmin
        .from("enrollment_certificate_ids")
        .select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      const { count: enrCount } = await supabaseAdmin
        .from("enrollments")
        .select("id", { count: "exact", head: true });
      return { ids: count ?? 0, enrollments: enrCount ?? 0 };
    });
    const ids = trigger.result?.ids ?? 0;
    const enrs = trigger.result?.enrollments ?? 0;
    checks.push({
      id: "credential-ids",
      label: "Credential ID allocation",
      state: trigger.error ? "down" : enrs > 0 && ids === 0 ? "warn" : "ok",
      ms: trigger.ms,
      detail:
        trigger.error ??
        `${ids} credential IDs for ${enrs} enrollments`,
    });

    // --- Configuration ---------------------------------------------------
    const cfg: Array<[string, string, string | undefined]> = [
      ["sentry", "Error monitoring (Sentry)", process.env['VITE_SENTRY_DSN']],
      ["paypal", "PayPal credentials", process.env['PAYPAL_CLIENT_ID']],
      ["telegram-token", "Telegram bot token", process.env['TELEGRAM_BOT_TOKEN']],
      ["telegram-chat", "Telegram chat ID", process.env['TELEGRAM_CHAT_ID']],
      ["service-role", "Service role key", process.env['SUPABASE_SERVICE_ROLE_KEY']],
    ];
    for (const [id, label, value] of cfg) {
      checks.push({
        id: `config:${id}`,
        label,
        state: value ? "ok" : "warn",
        detail: value ? "Configured" : "Not configured",
      });
    }

    const overall: HealthState = checks.some((c) => c.state === "down")
      ? "down"
      : checks.some((c) => c.state === "warn")
        ? "warn"
        : "ok";

    return { overall, checks, checkedAt: new Date().toISOString() };
  });