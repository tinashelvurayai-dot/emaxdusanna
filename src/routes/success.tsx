import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/success")({
  beforeLoad: () => {
    throw redirect({ to: "/certificate-success", search: {} as never });
  },
});