import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: permanently deletes archived compliance records whose
 * retention period has expired. Call it once a day with the shared secret:
 *
 *   curl -X POST https://your-domain.example/api/public/cron/purge-retention \
 *     -H "x-cron-secret: $RETENTION_CRON_SECRET"
 */
export const Route = createFileRoute("/api/public/cron/purge-retention")({
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
        const { data, error } = await supabaseAdmin.rpc("purge_expired_retention_archive");
        if (error) return new Response(error.message, { status: 500 });

        return Response.json({ purged: data ?? 0 });
      },
    },
  },
});
