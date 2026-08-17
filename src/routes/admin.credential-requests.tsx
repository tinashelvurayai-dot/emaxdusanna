import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/credential-requests")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", search: { tab: "altPayments" } });
  },
});