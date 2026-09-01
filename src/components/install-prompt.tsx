import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "edusanna-install-dismissed";

/**
 * Dismissible bottom banner that invites users to install Edusanna as an app.
 * Chrome/Edge/Android use the native `beforeinstallprompt` flow; iOS Safari
 * gets a short share-sheet hint instead.
 */
export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const inStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (inStandalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setHidden(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (/iPhone|iPad|iPod/.test(window.navigator.userAgent)) {
      setIosHint(true);
      setHidden(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || (!promptEvent && !iosHint)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <div className="fixed inset-x-3 bottom-20 z-[70] sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm">
      <div className="rounded-2xl border border-white/15 bg-background/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <img
            src="/logo.webp"
            alt="Edusanna app icon"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Install the Edusanna app</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {iosHint
                ? "Tap Share, then Add to Home Screen to study offline."
                : "Add Edusanna to your device and keep studying, even offline."}
            </p>
            {promptEvent && (
              <Button
                size="sm"
                className="mt-3 gap-2"
                onClick={async () => {
                  await promptEvent.prompt();
                  const choice = await promptEvent.userChoice;
                  if (choice.outcome !== "accepted") localStorage.setItem(DISMISS_KEY, "1");
                  setPromptEvent(null);
                  setHidden(true);
                }}
              >
                <Download className="h-4 w-4" /> Install app
              </Button>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss install prompt"
            onClick={dismiss}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
