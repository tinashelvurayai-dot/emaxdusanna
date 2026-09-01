import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, CheckCircle2, Database, Gauge as GaugeIcon, Loader2,
  RefreshCw, Server, TrendingUp, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSystemStatus, type Level } from "@/lib/system.functions";

const LEVEL_STYLES: Record<Level, { bar: string; chip: string; label: string }> = {
  ok: { bar: "bg-green-500", chip: "bg-green-100 text-green-700", label: "Healthy" },
  watch: { bar: "bg-blue-500", chip: "bg-blue-100 text-blue-700", label: "Watch" },
  warn: { bar: "bg-amber-500", chip: "bg-amber-100 text-amber-700", label: "Warning" },
  critical: { bar: "bg-red-500", chip: "bg-red-100 text-red-700", label: "Critical" },
};

export function SystemTab() {
  const fetchStatus = useServerFn(getSystemStatus);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["system-status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="glass-card-light p-10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!data) return <div className="glass-card-light p-6 text-blue-600">Could not load system status.</div>;

  const worst: Level = data.warnings.some((w) => w.level === "critical")
    ? "critical"
    : data.warnings.some((w) => w.level === "warn")
      ? "warn"
      : data.warnings.length
        ? "watch"
        : "ok";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card-light p-5 sm:p-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-500">System management</p>
          <h2 className="text-2xl font-black text-blue-900 mt-1">Capacity &amp; scaling monitor</h2>
          <p className="text-sm text-blue-600 mt-1">
            {data.plan.database} · {data.plan.hosting} · checked{" "}
            {new Date(data.checkedAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`border-0 ${LEVEL_STYLES[worst].chip}`}>{LEVEL_STYLES[worst].label}</Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="space-y-3">
          {data.warnings.map((w, i) => (
            <div
              key={i}
              className={`glass-card-light p-4 flex gap-3 border-l-4 ${
                w.level === "critical"
                  ? "border-l-red-500"
                  : w.level === "warn"
                    ? "border-l-amber-500"
                    : "border-l-blue-500"
              }`}
            >
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <p className="font-bold text-blue-900 text-sm">{w.title}</p>
                <p className="text-sm text-blue-600">{w.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric icon={<Users className="w-4 h-4" />} label="Learners" value={data.metrics.users.toLocaleString()} sub={`+${data.metrics.newUsers7d} this week`} />
        <Metric icon={<Activity className="w-4 h-4" />} label="Active (24h)" value={data.metrics.dau.toLocaleString()} sub={`${data.metrics.mau.toLocaleString()} in 30 days`} />
        <Metric icon={<Database className="w-4 h-4" />} label="Database used" value={data.metrics.dbLabel} sub="of 500 MB free tier" />
        <Metric icon={<TrendingUp className="w-4 h-4" />} label="Enrollments" value={data.metrics.enrollments.toLocaleString()} sub={`${data.metrics.payments.toLocaleString()} payments`} />
      </div>

      {/* Gauges */}
      <div className="glass-card-light p-5 sm:p-6">
        <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-4">
          <GaugeIcon className="w-4 h-4" /> Free-tier headroom
        </h3>
        <div className="space-y-5">
          {data.gauges.map((g) => {
            const pct = Math.min(100, Math.round((g.used / g.limit) * 100));
            return (
              <div key={g.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-blue-900">{g.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-500">{g.headroom}</span>
                    <Badge className={`border-0 ${LEVEL_STYLES[g.level].chip}`}>{pct}%</Badge>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                  <div className={`h-full rounded-full ${LEVEL_STYLES[g.level].bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
                <p className="text-xs text-blue-500 mt-1">{g.advice}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scaling roadmap */}
      <div className="glass-card-light p-5 sm:p-6">
        <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-4">
          <Server className="w-4 h-4" /> Scaling roadmap
        </h3>
        <div className="space-y-4">
          {data.milestones.map((m) => (
            <div
              key={m.users}
              className={`rounded-xl border p-4 ${
                m.status === "next" ? "border-blue-300 bg-blue-50/60" : "border-blue-100 bg-white/60"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {m.status === "done" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <GaugeIcon className="w-4 h-4 text-blue-500" />
                )}
                <p className="font-bold text-blue-900 text-sm">{m.label}</p>
                {m.status === "next" && <Badge className="border-0 bg-blue-100 text-blue-700">Next threshold</Badge>}
                {m.status === "done" && <Badge className="border-0 bg-green-100 text-green-700">Reached</Badge>}
                {m.requiresPaidPlan && (
                  <Badge className="border-0 bg-amber-100 text-amber-700">Paid plan required</Badge>
                )}
              </div>
              <ul className="text-sm text-blue-600 space-y-1 pl-5 list-disc">
                {m.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Storage breakdown + free tier notes */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card-light p-5 sm:p-6">
          <h3 className="font-bold text-blue-900 mb-4">Largest tables</h3>
          <div className="space-y-2">
            {data.tables.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <span className="text-blue-700 font-mono text-xs">{t.name}</span>
                <span className="text-blue-500">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card-light p-5 sm:p-6">
          <h3 className="font-bold text-blue-900 mb-4">Free-tier limits &amp; how they are handled</h3>
          <div className="space-y-3">
            {data.freeTierNotes.map((n) => (
              <div key={n.title}>
                <p className="text-sm font-semibold text-blue-900">{n.title}</p>
                <p className="text-xs text-blue-600">{n.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security posture */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric icon={<Activity className="w-4 h-4" />} label="Open anomalies" value={data.metrics.anomaliesOpen.toLocaleString()} sub="unresolved security flags" />
        <Metric icon={<Activity className="w-4 h-4" />} label="Rate-limit hits (24h)" value={data.metrics.rateLimitHits24h.toLocaleString()} sub="requests counted" />
        <Metric icon={<Users className="w-4 h-4" />} label="Churned" value={data.metrics.churned.toLocaleString()} sub="inactive 48h+" />
        <Metric icon={<Database className="w-4 h-4" />} label="Audit entries" value={data.metrics.auditLogs.toLocaleString()} sub="compliance trail" />
      </div>
    </div>
  );
}

function Metric({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="glass-card-light p-4">
      <div className="flex items-center gap-2 text-blue-500 text-xs font-bold uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-black text-blue-900 mt-1">{value}</p>
      <p className="text-xs text-blue-500">{sub}</p>
    </div>
  );
}
