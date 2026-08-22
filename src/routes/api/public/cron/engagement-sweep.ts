import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: nudges learners idle for 24h and flags those gone 48h as
 * churned. Call once an hour:
 *
 *   curl -X POST https://project--<id>.lovable.app/api/public/cron/engagement-sweep \
 *     -H "x-cron-secret: $RETENTION_CRON_SECRET"
 */
export const Route = createFileRoute("/api/public/cron/engagement-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RETENTION_CRON_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (provided.length !== secret.length || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("run_engagement_sweep");
        if (error) {
          console.error(JSON.stringify({ level: "error", operation: "engagement-sweep", message: error.message }));
          return new Response("Sweep failed", { status: 500 });
        }
        return Response.json({ ok: true, ...(data as Record<string, unknown>) });
      },
    },
  },
});
