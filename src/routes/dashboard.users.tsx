import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/users")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", search: { tab: "userManagement" } });
  },
});