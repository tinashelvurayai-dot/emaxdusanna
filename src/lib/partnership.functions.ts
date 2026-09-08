import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statuses = ["new", "reviewing", "contacted", "approved", "declined"] as const;
type RequestStatus = (typeof statuses)[number];

async function assertAdmin(context: { userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

export const listPartnershipRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("partnership_program_requests").select("id, partner_name, email, phone, organization_name, organization_type, website, program_title, program_description, audience, expected_reach, message, status, created_at, updated_at").order("created_at", { ascending: false });
    if (error) throw error;
    return { requests: data ?? [] };
  });

export const updatePartnershipRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: RequestStatus }) => {
    if (!input?.id || !statuses.includes(input.status)) throw new Error("Invalid request status");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("partnership_program_requests").update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });
