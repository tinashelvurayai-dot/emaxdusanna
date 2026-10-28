import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validatePartnershipInput } from "./school-partnership";
async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Admin access required.");
}
export const listSchoolPartnerships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await (context.supabase as any).from("school_partnership_onboarding").select("*");
    if (error) throw new Error("School partnership tracking is unavailable. Apply the school onboarding setup first.");
    return { partnerships: data ?? [] };
  });
export const updateSchoolPartnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validatePartnershipInput)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const now = new Date().toISOString();
    const values = { school_id: data.schoolId, [data.field]: data.checked, recorded_by: context.userId, updated_at: now,
      ...(data.field === "terms_accepted" ? { terms_accepted_at: data.checked ? now : null } : {}) };
    const { error } = await (context.supabase as any).from("school_partnership_onboarding").upsert(values, { onConflict: "school_id", defaultToNull: false });
    if (error) throw new Error("The partnership update was not saved. Please try again.");
    return { success: true };
  });