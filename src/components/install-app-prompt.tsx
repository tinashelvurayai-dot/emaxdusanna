import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "edusanna-install-dismissed";

/**
 * Floating "Install app" pop-up. Shows only when the browser says the app can
 * be installed (Chrome / Edge / Android) or on iOS Safari with the share-sheet
 * hint. Dismissal is remembered so it never nags the same visitor twice.
 */
export function InstallAppPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const inStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (inStandalone) return;

    setHidden(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setHidden(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (/iPhone|iPad|iPod/.test(window.navigator.userAgent)) setShowIosHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  if (hidden || (!promptEvent && !showIosHint)) return null;

  return (
    <div
      role="dialog"
      aria-label="Install the Edusanna app"
      className="fixed z-50 bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm rounded-2xl border border-blue-200 bg-white/95 backdrop-blur p-4 shadow-xl"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute top-2 right-2 p-2 rounded-full text-blue-500 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
      <p className="font-bold text-blue-900 pr-8">Install Edusanna</p>
      <p className="text-sm text-blue-600 mt-1">
        {promptEvent
          ? "Add Edusanna to your device for faster access and offline course notes."
          : "Tap Share, then Add to Home Screen to install Edusanna."}
      </p>
      {promptEvent && (
        <Button
          className="premium-button gap-2 mt-3 min-h-11 w-full"
          onClick={async () => {
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            setPromptEvent(null);
            if (choice.outcome === "accepted") setHidden(true);
            else dismiss();
          }}
        >
          <Download className="w-4 h-4" aria-hidden="true" /> Install app
        </Button>
      )}
    </div>
  );
}
