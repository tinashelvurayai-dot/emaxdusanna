import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getMyFullName } from "@/lib/profile.functions";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings | Edusanna" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchName = useServerFn(getMyFullName);
  const deleteAccount = useServerFn(deleteMyAccount);

  const [profile, setProfile] = useState<{ fullName: string; signupType: string; schoolName: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unenrolling, setUnenrolling] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchName({})
      .then((r) => {
        if (active) setProfile({ fullName: r.fullName, signupType: r.signupType, schoolName: r.schoolName });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [fetchName]);

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["settings-enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [enr, prog] = await Promise.all([
        supabase.from("enrollments").select("id,course_id,level,course_title").eq("user_id", user!.id),
        supabase.from("course_progress").select("course_id,level,is_completed").eq("user_id", user!.id),
      ]);
      const done = new Set((prog.data ?? []).filter((p) => p.is_completed).map((p) => `${p.course_id}|${p.level}`));
      return (enr.data ?? []).map((e) => ({
        ...e,
        completed: done.has(`${e.course_id}|${e.level}`),
      }));
    },
  });

  const handleUnenroll = async (row: { id: string; course_id: string; level: string }) => {
    if (!user) return;
    setUnenrolling(row.id);
    const { error } = await supabase.from("enrollments").delete().eq("id", row.id).eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      setUnenrolling(null);
      return;
    }
    await supabase
      .from("course_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("course_id", row.course_id)
      .eq("level", row.level)
      .eq("is_completed", false);
    toast.success("You have been unenrolled from this course.");
    queryClient.invalidateQueries({ queryKey: ["settings-enrollments", user.id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", user.id] });
    setUnenrolling(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount({ data: { confirm: "DELETE" } });
      toast.success("Your account and all its data have been deleted.");
      await signOut();
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete your account.");
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteNavbar />
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900 mb-4">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to dashboard
          </Link>
          <h1 className="text-3xl md:text-4xl font-black text-blue-900 mb-1">Account settings</h1>
          <p className="text-blue-600 mb-8">Manage your Edusanna account.</p>

          <div className="glass-card-light p-6 mb-6">
            <h2 className="text-lg font-bold text-blue-900 mb-1">Your courses</h2>
            <p className="text-sm text-blue-600 mb-4">
              Unenroll from any course you no longer want to complete. Completed courses are kept so your
              credential stays valid.
            </p>
            {coursesLoading ? (
              <p className="text-sm text-blue-500">Loading your courses…</p>
            ) : courses.length === 0 ? (
              <p className="text-sm text-blue-500">You are not enrolled in any course yet.</p>
            ) : (
              <ul className="space-y-2">
                {courses.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white/60 px-4 py-3"
                  >
                    <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-blue-900 text-sm truncate">{c.course_title ?? c.course_id}</p>
                      <p className="text-xs capitalize text-purple-600">{c.level}</p>
                    </div>
                    {c.completed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Completed
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => handleUnenroll(c)}
                        disabled={unenrolling === c.id}
                        className="min-h-11 border-red-300 text-red-700 hover:bg-red-50"
                      >
                        {unenrolling === c.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                        ) : (
                          <XCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                        )}
                        Unenroll
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-card-light p-6 mb-6">
            <h2 className="text-lg font-bold text-blue-900 mb-4">Your details</h2>
            <dl className="space-y-3 text-sm">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
                <dt className="text-blue-600">Full name</dt>
                <dd className="font-semibold text-blue-900 truncate">{profile?.fullName || "—"}</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
                <dt className="text-blue-600">Email</dt>
                <dd className="font-semibold text-blue-900 truncate">{user?.email ?? "—"}</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
                <dt className="text-blue-600">Account type</dt>
                <dd className="font-semibold capitalize text-blue-900">{profile?.signupType ?? "standard"}</dd>
              </div>
              {profile?.schoolName && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
                  <dt className="text-blue-600">School</dt>
                  <dd className="font-semibold text-blue-900 truncate">{profile.schoolName}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="glass-card-light p-6 border border-red-200">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-bold text-red-700">Delete my account</h2>
                <p className="text-sm text-blue-700 mt-1">
                  This permanently removes your profile, enrollments, course progress and credential
                  records. Credentials already issued can no longer be verified. This cannot be undone.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setOpen(true)}
              variant="outline"
              className="min-h-11 border-red-400 text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" /> Delete my account
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Everything tied to {user?.email} will be erased permanently. Press “Confirm & delete” to finish —
              this cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="min-h-11 bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              Confirm &amp; delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SiteFooter />
    </div>
  );
}