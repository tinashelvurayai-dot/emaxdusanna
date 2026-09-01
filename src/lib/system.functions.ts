import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * System management data for the admin dashboard.
 *
 * Everything here is read-only telemetry: how big the platform is right now,
 * how much headroom the current (free-tier) infrastructure has, and which
 * upgrade is required next.
 */

export type Level = "ok" | "watch" | "warn" | "critical";

export interface Gauge {
  id: string;
  label: string;
  used: number;
  limit: number;
  unit: "count" | "bytes";
  level: Level;
  headroom: string;
  advice: string;
}

export interface Milestone {
  users: number;
  label: string;
  status: "done" | "next" | "future";
  actions: string[];
  requiresPaidPlan: boolean;
}

/** Free-tier ceilings we plan against (Lovable Cloud database + Vercel hosting). */
const LIMITS = {
  dbBytes: 500 * 1024 * 1024, // 500 MB database storage
  mau: 50_000, // monthly active authenticated users
  rowsSoft: 500_000, // per-table rows before admin lists need cursor paging
  auditRows: 250_000, // audit retention before archiving is required
};

function level(ratio: number): Level {
  if (ratio >= 0.9) return "critical";
  if (ratio >= 0.75) return "warn";
  if (ratio >= 0.5) return "watch";
  return "ok";
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

const MILESTONES: Array<Omit<Milestone, "status">> = [
  {
    users: 200,
    label: "First 200 learners",
    requiresPaidPlan: false,
    actions: [
      "Database indexes on profiles, progress, payments and audit tables (done)",
      "Admin lists paginated server-side instead of loading every row (done)",
      "Learner lookups scoped by school id rather than scanning all profiles (done)",
    ],
  },
  {
    users: 500,
    label: "500 learners",
    requiresPaidPlan: false,
    actions: [
      "Keep admin page size at 50–100 rows and rely on the smart search filters",
      "Run the daily cron endpoints (engagement sweep + retention purge) so tables stay lean",
      "Watch the audit log gauge; archive rows older than 12 months",
    ],
  },
  {
    users: 1_000,
    label: "1,000 learners",
    requiresPaidPlan: false,
    actions: [
      "Cache admin KPI cards for 60s instead of refetching on every tab switch (done)",
      "Batch Telegram notifications so a signup spike cannot exhaust request budget",
      "Move heavy CSV exports to a background download rather than in-request generation",
    ],
  },
  {
    users: 10_000,
    label: "10,000 learners",
    requiresPaidPlan: true,
    actions: [
      "Upgrade the database plan: 500 MB free storage becomes the binding limit",
      "Add a materialised view for revenue/KPI aggregates, refreshed on a schedule",
      "Move rate limiting to a shared store (Upstash Redis) — serverless memory is per-instance",
      "Upgrade hosting plan for bandwidth + longer function execution windows",
    ],
  },
  {
    users: 100_000,
    label: "100,000 learners",
    requiresPaidPlan: true,
    actions: [
      "Dedicated Postgres compute with read replicas for reporting queries",
      "Queue-based jobs (nudges, notifications, purges) instead of single cron requests",
      "CDN-cached public pages and course catalogue; keep dynamic calls user-scoped only",
      "Partition audit_logs and rate_limit_hits by month with automated archival",
    ],
  },
];

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("system_capacity_snapshot");
    if (error) throw error;

    const s = (data ?? {}) as Record<string, any>;
    const num = (k: string) => Number(s[k] ?? 0);

    const users = num("users");
    const dbBytes = num("db_bytes");
    const auditRows = num("audit_logs");
    const biggestRows = Math.max(num("progress_rows"), num("enrollments"), auditRows);

    const gauges: Gauge[] = [
      {
        id: "db",
        label: "Database storage",
        used: dbBytes,
        limit: LIMITS.dbBytes,
        unit: "bytes",
        level: level(dbBytes / LIMITS.dbBytes),
        headroom: `${fmtBytes(Math.max(0, LIMITS.dbBytes - dbBytes))} free of ${fmtBytes(LIMITS.dbBytes)}`,
        advice:
          "At 90% you must upgrade the database plan. Before that, purge expired retention rows and archive old audit logs.",
      },
      {
        id: "mau",
        label: "Monthly active learners",
        used: num("mau"),
        limit: LIMITS.mau,
        unit: "count",
        level: level(num("mau") / LIMITS.mau),
        headroom: `${(LIMITS.mau - num("mau")).toLocaleString()} of ${LIMITS.mau.toLocaleString()} remaining`,
        advice: "Free tier covers 50,000 monthly active users — comfortable well past 10,000 signups.",
      },
      {
        id: "rows",
        label: "Largest table (rows)",
        used: biggestRows,
        limit: LIMITS.rowsSoft,
        unit: "count",
        level: level(biggestRows / LIMITS.rowsSoft),
        headroom: `${biggestRows.toLocaleString()} rows tracked`,
        advice: "Past 500k rows in one table, admin reporting should move to materialised views.",
      },
      {
        id: "audit",
        label: "Audit log volume",
        used: auditRows,
        limit: LIMITS.auditRows,
        unit: "count",
        level: level(auditRows / LIMITS.auditRows),
        headroom: `${auditRows.toLocaleString()} entries (${num("audit_logs_24h").toLocaleString()} in last 24h)`,
        advice: "Archive entries older than 12 months to keep compliance queries fast and storage low.",
      },
    ];

    const milestones: Milestone[] = MILESTONES.map((m) => {
      const next = MILESTONES.find((x) => users < x.users);
      return {
        ...m,
        status: users >= m.users ? "done" : next && next.users === m.users ? "next" : "future",
      };
    });

    // Threshold warnings the page surfaces at the top.
    const warnings: Array<{ level: Level; title: string; detail: string }> = [];
    const nextMilestone = MILESTONES.find((m) => users < m.users);
    if (nextMilestone) {
      const pct = users / nextMilestone.users;
      if (pct >= 0.8) {
        warnings.push({
          level: nextMilestone.requiresPaidPlan ? "warn" : "watch",
          title: `Approaching ${nextMilestone.users.toLocaleString()} learners`,
          detail: `${users.toLocaleString()} learners registered (${Math.round(pct * 100)}% of the next threshold). ${
            nextMilestone.requiresPaidPlan
              ? "A paid database/hosting plan is required at this level."
              : "No plan upgrade needed — the listed tuning steps are enough."
          }`,
        });
      }
    }
    for (const g of gauges) {
      if (g.level === "warn" || g.level === "critical") {
        warnings.push({ level: g.level, title: `${g.label} at ${Math.round((g.used / g.limit) * 100)}%`, detail: g.advice });
      }
    }
    if (num("banned_ips") > 0) {
      warnings.push({
        level: "watch",
        title: `${num("banned_ips")} IP address(es) temporarily banned`,
        detail: "Automatic abuse protection is active. Review the audit log if this number keeps climbing.",
      });
    }
    if (num("alt_payments_pending") > 0) {
      warnings.push({
        level: "watch",
        title: `${num("alt_payments_pending")} payment request(s) awaiting review`,
        detail: "Learners are waiting on payment guidance — handle these in the Alt payments tab.",
      });
    }

    return {
      checkedAt: new Date().toISOString(),
      plan: { hosting: "Vercel free (Hobby)", database: "Lovable Cloud free tier" },
      metrics: {
        users,
        dau: num("dau"),
        mau: num("mau"),
        newUsers7d: num("new_users_7d"),
        churned: num("churned"),
        enrollments: num("enrollments"),
        progressRows: num("progress_rows"),
        payments: num("payments"),
        auditLogs: auditRows,
        anomaliesOpen: num("anomalies_open"),
        rateLimitHits24h: num("rate_limit_hits_24h"),
        schools: num("schools"),
        schoolAdmins: num("school_admins"),
        rosterRows: num("roster_rows"),
        dbBytes,
        dbLabel: fmtBytes(dbBytes),
      },
      gauges,
      milestones,
      warnings,
      tables: ((s.largest_tables ?? []) as Array<{ table_name: string; bytes: number }>).map((t) => ({
        name: t.table_name,
        bytes: Number(t.bytes),
        label: fmtBytes(Number(t.bytes)),
      })),
      freeTierNotes: [
        {
          title: "Hosting function timeout (10s)",
          detail:
            "Long jobs must stay short. The cron endpoints process in batches and return quickly; heavy exports stream from the client instead.",
        },
        {
          title: "In-memory rate limiting does not survive scale-out",
          detail:
            "Rate limits are stored in the database (rate_limit_hits + ip_reputation), so they work across every serverless instance on the free plan.",
        },
        {
          title: "No always-on scheduler on the free plan",
          detail:
            "The engagement sweep and retention purge run through the protected /api/public/cron/* endpoints — point any free scheduler at them daily with the secret header.",
        },
        {
          title: "500 MB database storage",
          detail:
            "This is the first hard free-tier ceiling you will hit — roughly around 10,000 active learners with full audit history.",
        },
        {
          title: "Bandwidth on the free hosting plan",
          detail:
            "Course images are served as WebP and the app is installable with offline caching, which keeps repeat visits off the network.",
        },
      ],
    };
  });
