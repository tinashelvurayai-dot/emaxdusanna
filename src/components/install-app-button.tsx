import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Floating "Install app" button. Appears on browsers that fire
 * `beforeinstallprompt` (Chrome / Edge / Android). On iOS Safari, where the
 * event never fires, we show a one-line hint instead so users know they can
 * add the app from the share sheet.
 */
export function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const inStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS-specific flag
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (inStandalone) setInstalled(true);
    else if (isIos) setShowIosHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (promptEvent) {
    return (
      <Button
        onClick={async () => {
          await promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice.outcome === "accepted") setInstalled(true);
          setPromptEvent(null);
        }}
        className="premium-button gap-2"
      >
        <Download className="w-4 h-4" /> Install Edusanna app
      </Button>
    );
  }

  if (showIosHint) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="gap-2" onClick={() => setShowIosHint(false)}>
          <Download className="h-4 w-4" /> Install app
        </Button>
        <p className="text-sm text-blue-700">Use Share, then Add to Home Screen.</p>
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" className="gap-2" onClick={() => window.location.reload()}>
      <Download className="h-4 w-4" /> Install app
    </Button>
  );
}
