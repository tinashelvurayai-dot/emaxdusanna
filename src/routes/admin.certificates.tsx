import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/certificates")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", search: { tab: "certificates" } });
  },
});