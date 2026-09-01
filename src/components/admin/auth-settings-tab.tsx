import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getAuthSettings, saveAuthSettings } from "@/lib/admin.functions";

/** Admin settings: control what appears on the public sign-in page. */
export function AuthSettingsTab() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getAuthSettings);
  const saveSettings = useServerFn(saveAuthSettings);

  const { data, isLoading } = useQuery({ queryKey: ["auth-settings"], queryFn: () => fetchSettings() });
  const googleEnabled = data?.value.googleEnabled ?? true;

  const toggle = useMutation({
    mutationFn: (next: boolean) => saveSettings({ data: { googleEnabled: next } }),
    onSuccess: (_r, next) => {
      toast.success(next ? "Google sign-in is now visible" : "Google sign-in is now hidden");
      qc.invalidateQueries({ queryKey: ["auth-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update setting"),
  });

  if (isLoading) return <p className="text-blue-500 py-8">Loading settings…</p>;

  return (
    <div className="glass-card-light p-6 max-w-xl space-y-4">
      <div>
        <h3 className="font-bold text-blue-900">Sign-in page</h3>
        <p className="text-sm text-blue-600 mt-1">
          Show or hide the “Continue with Google” button on the log in page. Email and password sign-in is
          always available.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-white/60 px-4 py-3">
        <div>
          <p className="font-semibold text-blue-900 text-sm">Continue with Google</p>
          <p className="text-xs text-blue-500">
            Currently {googleEnabled ? "visible to visitors" : "hidden from visitors"}
          </p>
        </div>
        <Button
          onClick={() => toggle.mutate(!googleEnabled)}
          disabled={toggle.isPending}
          variant="outline"
          aria-pressed={googleEnabled}
          className="min-h-11 border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          {toggle.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
          ) : googleEnabled ? (
            <EyeOff className="w-4 h-4 mr-2" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
          )}
          {googleEnabled ? "Hide button" : "Reveal button"}
        </Button>
      </div>
    </div>
  );
}
