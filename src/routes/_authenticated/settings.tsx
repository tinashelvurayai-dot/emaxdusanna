import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BookOpen, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getMyFullName } from "@/lib/profile.functions";
import { changeMyPassword } from "@/lib/account.functions";
import { Input } from "@/components/ui/input";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchName = useServerFn(getMyFullName);
  const changePassword = useServerFn(changeMyPassword);
  const [profile, setProfile] = useState<{ fullName: string; signupType: string; schoolName: string | null } | null>(null);
  const [unenrolling, setUnenrolling] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    setChanging(true);
    try {
      await changePassword({ data: { newPassword } });
      setNewPassword("");
      toast.success("Password updated. Other devices have been signed out.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setChanging(false);
    }
  };


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

          <div className="glass-card-light p-6 mb-6">
            <h2 className="text-lg font-bold text-blue-900 mb-1">Change password</h2>
            <p className="text-sm text-blue-600 mb-4">
              Changing your password signs you out of every other device immediately.
            </p>
            <div className="space-y-3">
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min. 8 characters)"
                autoComplete="new-password"
                className="min-h-11"
              />
              <Button
                onClick={handleChangePassword}
                disabled={changing || newPassword.length < 8}
                className="min-h-11"
              >
                {changing && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                Update password
              </Button>
            </div>
          </div>

        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
