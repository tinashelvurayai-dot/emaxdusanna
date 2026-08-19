import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  listSpecialProgramCompletions, setSpecialProgramDiplomaIssued,
} from "@/lib/special-program.functions";
import { specialCourseLanguage } from "@/lib/special-courses";

/** Global AHEP completions with a diploma-handover checkbox per learner. */
export function SpecialProgramTab() {
  const qc = useQueryClient();
  const fetchCompletions = useServerFn(listSpecialProgramCompletions);
  const setIssued = useServerFn(setSpecialProgramDiplomaIssued);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-special-program"],
    queryFn: () => fetchCompletions(),
  });

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; courseId: string; issued: boolean }) =>
      setIssued({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-special-program"] });
      toast.success("Diploma status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.completions ?? [];

  if (isLoading) {
    return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" /></div>;
  }

  return (
    <div className="glass-card-light p-4 sm:p-6 overflow-x-auto">
      <h2 className="text-lg font-bold text-blue-900 mb-1">Global AHEP special programme</h2>
      <p className="text-sm text-blue-600 mb-4">
        Learners who completed the plastic pollution leadership programme (English or French). Tick the box
        once their diploma has been issued.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-blue-500">No completions yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Credential ID</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Diploma issued</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.userId}|${r.courseId}`}>
                <TableCell className="font-semibold text-blue-900">{r.fullName ?? "—"}</TableCell>
                <TableCell>{r.email ?? "—"}</TableCell>
                <TableCell>{specialCourseLanguage[r.courseId] ?? r.courseId}</TableCell>
                <TableCell className="font-mono text-xs">{r.certificateId ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={r.diplomaIssued}
                    aria-label={`Diploma issued to ${r.fullName ?? r.email ?? "learner"}`}
                    disabled={mutation.isPending}
                    onCheckedChange={(v) =>
                      mutation.mutate({ userId: r.userId, courseId: r.courseId, issued: v === true })
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
