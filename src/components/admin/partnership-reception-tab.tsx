import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listPartnershipRequests, updatePartnershipRequestStatus } from "@/lib/partnership.functions";

const statuses = ["new", "reviewing", "contacted", "approved", "declined"] as const;
const statusLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function PartnershipReceptionTab() {
  const qc = useQueryClient();
  const fetchRequests = useServerFn(listPartnershipRequests);
  const updateStatus = useServerFn(updatePartnershipRequestStatus);
  const { data, isLoading } = useQuery({ queryKey: ["admin-partnership-requests"], queryFn: () => fetchRequests() });
  const [query, setQuery] = useState("");
  const mutation = useMutation({ mutationFn: (data: { id: string; status: (typeof statuses)[number] }) => updateStatus({ data }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-partnership-requests"] }); toast.success("Request status updated"); }, onError: () => toast.error("Could not update request status") });
  const requests = useMemo(() => (data?.requests ?? []).filter((r: any) => [r.partner_name, r.email, r.organization_name, r.program_title, r.status].join(" ").toLowerCase().includes(query.toLowerCase())), [data?.requests, query]);
  if (isLoading) return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" /></div>;
  return <div className="glass-card-light p-4 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4 mb-5"><div><h2 className="text-lg font-bold text-blue-900">Partnership &amp; Program Reception</h2><p className="text-sm text-blue-600">Review proposals, contact partners, and track program decisions.</p></div><div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requests" aria-label="Search partnership requests" className="pl-9" /></div></div>{requests.length === 0 ? <p className="py-10 text-center text-sm text-blue-600">No partnership requests found.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>Organization</TableHead><TableHead>Program proposal</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{requests.map((r: any) => <TableRow key={r.id}><TableCell><div className="font-semibold text-blue-900">{r.partner_name}</div><div className="text-xs text-blue-500">{r.email}</div></TableCell><TableCell><div>{r.organization_name}</div><div className="text-xs text-blue-500">{r.organization_type}</div></TableCell><TableCell className="min-w-[260px]"><div className="font-medium text-blue-900">{r.program_title}</div><p className="mt-1 text-xs text-blue-600 line-clamp-2">{r.program_description}</p></TableCell><TableCell className="text-xs text-blue-500">{new Date(r.created_at).toLocaleDateString()}</TableCell><TableCell><div className="flex items-center gap-2"><Badge variant="secondary">{statusLabel(r.status)}</Badge><Select value={r.status} onValueChange={(status) => mutation.mutate({ id: r.id, status: status as (typeof statuses)[number] })}><SelectTrigger className="w-[125px] h-8"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}</SelectContent></Select></div></TableCell></TableRow>)}</TableBody></Table></div>}</div>;
}
