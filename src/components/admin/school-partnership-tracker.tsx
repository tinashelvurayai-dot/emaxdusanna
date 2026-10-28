import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listContractedSchools } from "@/lib/admin.functions";
import { listSchoolPartnerships, updateSchoolPartnership } from "@/lib/school-partnership.functions";
import { PARTNERSHIP_STEPS, type PartnershipInput } from "@/lib/school-partnership";
export function SchoolPartnershipTracker() {
  const qc = useQueryClient();
  const fetchSchools = useServerFn(listContractedSchools);
  const fetchPartnerships = useServerFn(listSchoolPartnerships);
  const updatePartnership = useServerFn(updateSchoolPartnership);
  const [filter, setFilter] = useState("all");
  const schoolsQuery = useQuery({ queryKey: ["admin-schools"], queryFn: () => fetchSchools() });
  const partnershipsQuery = useQuery({ queryKey: ["school-partnerships"], queryFn: () => fetchPartnerships(), retry: false });
  const mutation = useMutation({
    mutationFn: (data: PartnershipInput) => updatePartnership({ data }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["school-partnerships"] }); toast.success("School partnership updated"); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update was not saved"),
  });
  const rows = schoolsQuery.data?.schools ?? [];
  const states = new Map<string, any>((partnershipsQuery.data?.partnerships ?? []).map((row: any) => [row.school_id, row]));
  const visibleRows = rows.filter((school: any) => filter === "all" || Boolean(states.get(school.id)?.terms_accepted) === (filter === "accepted"));
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-xl font-bold text-foreground">School partnership handover</h2>
      <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-52" aria-label="Filter school acceptance"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All schools</SelectItem><SelectItem value="accepted">Terms accepted</SelectItem><SelectItem value="not-accepted">Terms not accepted</SelectItem></SelectContent></Select>
    </div>
    {schoolsQuery.isLoading || partnershipsQuery.isLoading ? <p className="text-muted-foreground">Loading school partnerships…</p> :
      schoolsQuery.error || partnershipsQuery.error ? <p role="alert" className="text-destructive">{partnershipsQuery.error instanceof Error ? partnershipsQuery.error.message : "Unable to load schools."}</p> :
      visibleRows.length === 0 ? <p className="text-muted-foreground">No schools in this group.</p> :
      <div className="divide-y divide-border border-y border-border">{visibleRows.map((school: any) => {
        const state = states.get(school.id);
        return <div key={school.id} className="py-5"><div className="mb-4 flex flex-wrap items-center gap-3"><h3 className="font-semibold text-foreground">{school.name ?? school.school_name}</h3><Badge variant={state?.terms_accepted ? "default" : "secondary"}>{state?.terms_accepted ? "Terms accepted" : "Terms not accepted"}</Badge>{state?.terms_accepted_at && <span className="text-sm text-muted-foreground">Signed {new Date(state.terms_accepted_at).toLocaleDateString()}</span>}</div>
          <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">{PARTNERSHIP_STEPS.map((step) => <Label key={step.key} htmlFor={`${school.id}-${step.key}`} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-relaxed"><Checkbox id={`${school.id}-${step.key}`} checked={Boolean(state?.[step.key])} disabled={mutation.isPending} onCheckedChange={(checked) => mutation.mutate({ schoolId: school.id, field: step.key, checked: checked === true })} /><span>{step.label}</span></Label>)}</div>
        </div>;
      })}</div>}
  </section>;
}