import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy/checkout-provider success URL. Forwards to the real confirmation page. */
export const Route = createFileRoute("/success")({
  validateSearch: (search: Record<string, unknown>) => search,
  beforeLoad: ({ search }) => {
    const s = search as Record<string, unknown>;
    throw redirect({
      to: "/certificate-success",
      search: {
        courseId: String(s['courseId'] ?? ""),
        level: s['level'] === "diploma" ? "diploma" : "certificate",
        ...(typeof s['token'] === "string" ? { token: s['token'] } : {}),
      },
    });
  },
});