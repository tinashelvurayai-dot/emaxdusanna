import { useEffect, useRef } from "react";
import { reportUxFailure } from "@/lib/audit.functions";

/**
 * Detects rage clicks (5+ clicks on the same element within 10 seconds) and
 * flags them as UX failures so they surface in the admin engagement report.
 * Includes the PostHog session-replay URL when PostHog is present.
 */
export function useRageClicks(enabled = true) {
  const hits = useRef<{ key: string; times: number[] }>({ key: "", times: [] });
  const reported = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest("button, a, [role='button'], input, select") as HTMLElement | null;
      if (!el) return;

      const key =
        el.getAttribute("aria-label") ??
        el.getAttribute("name") ??
        (el.textContent ?? "").trim().slice(0, 60) ??
        el.tagName;

      const now = Date.now();
      if (hits.current.key !== key) hits.current = { key, times: [] };
      hits.current.times = [...hits.current.times.filter((t) => now - t < 10_000), now];

      if (hits.current.times.length >= 5 && !reported.current.has(key + window.location.pathname)) {
        reported.current.add(key + window.location.pathname);
        const replay = (window as unknown as { posthog?: { get_session_replay_url?: () => string } }).posthog
          ?.get_session_replay_url?.();
        void reportUxFailure({
          data: {
            route: window.location.pathname,
            elementLabel: key || el.tagName,
            clickCount: hits.current.times.length,
            ...(replay ? { replayUrl: replay } : {}),
          },
        }).catch(() => {});
      }
    };

    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [enabled]);
}
