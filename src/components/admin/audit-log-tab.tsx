import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, FileClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccessibleButton } from "@/components/accessible-button";
import { queryAuditLogs, getRetentionReport } from "@/lib/audit.functions";

const severityStyle: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

export function AuditLogTab() {
  const runQuery = useServerFn(queryAuditLogs);
  const fetchReport = useServerFn(getRetentionReport);
  const [eventType, setEventType] = useState("");
  const [applied, setApplied] = useState("");

  const logs = useQuery({
    queryKey: ["audit-logs", applied],
    queryFn: () => runQuery({ data: { limit: 200, ...(applied ? { eventType: applied } : {}) } }),
  });
  const report = useQuery({ queryKey: ["retention-report"], queryFn: () => fetchReport() });

  return (
    <div className="space-y-10">
      <section aria-labelledby="audit-trail-heading">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <Label htmlFor="audit-event-filter">Filter by event type</Label>
            <Input
              id="audit-event-filter"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. password_change"
              className="w-64"
            />
          </div>
          <AccessibleButton onClick={() => setApplied(eventType.trim())} className="premium-button">
            Apply filter
          </AccessibleButton>
          {applied && (
            <AccessibleButton variant="outline" onClick={() => { setEventType(""); setApplied(""); }}>
              Clear
            </AccessibleButton>
          )}
        </div>

        <h3 id="audit-trail-heading" className="flex items-center gap-2 text-lg font-bold text-blue-900 mb-3">
          <ShieldCheck className="w-5 h-5" aria-hidden="true" /> Security audit trail
        </h3>

        {logs.isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-blue-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs.data?.rows ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">{row.event_type}</TableCell>
                    <TableCell>{row.event_category}</TableCell>
                    <TableCell className="font-mono text-xs">{row.user_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.ip_address ?? "—"}</TableCell>
                    <TableCell className="max-w-[22rem] truncate text-xs">
                      {JSON.stringify(row.event_details)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-0 ${severityStyle[row.severity] ?? "bg-gray-100 text-gray-700"}`}>
                        {row.severity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {logs.data?.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-blue-600 py-8">
                      No audit entries yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="retention-heading">
        <h3 id="retention-heading" className="flex items-center gap-2 text-lg font-bold text-blue-900 mb-3">
          <FileClock className="w-5 h-5" aria-hidden="true" /> Data retention report
        </h3>
        <p className="text-sm text-blue-600 mb-4">
          For every closed account: what was anonymised, what compliance data was retained, when the
          7-year retention clock started and when it expires.
        </p>
        {report.isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-blue-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Anonymised</TableHead>
                  <TableHead>Retained records</TableHead>
                  <TableHead>Clock started</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report.data?.rows ?? []).map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className="text-xs">{row.anonymizedIdentity}</TableCell>
                    <TableCell><Badge className="border-0 bg-blue-100 text-blue-700">{row.status}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {row.anonymizedAt ? new Date(row.anonymizedAt).toLocaleDateString() : "—"}
                      <div className="text-blue-500">{row.anonymizedFields.join(", ")}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {Object.entries(row.retainedRecords).length === 0
                        ? "none"
                        : Object.entries(row.retainedRecords).map(([k, v]) => `${k} × ${v}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.retentionClockStart ? new Date(row.retentionClockStart).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.retentionExpires ? new Date(row.retentionExpires).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {report.data?.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-blue-600 py-8">
                      No closed accounts yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
