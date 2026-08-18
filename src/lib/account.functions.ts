import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently delete the signed-in user's own account: learning data, profile
 * and the auth identity itself. Available to every signed-in learner
 * (standard and academia) from their dashboard settings.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirm: string }) => {
    if ((input?.confirm ?? "").trim().toUpperCase() !== "DELETE") {
      throw new Error('Please type DELETE to confirm.');
    }
    return { confirm: "DELETE" as const };
  })
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove app data first so nothing is orphaned if auth deletion fails.
    await supabaseAdmin.from("course_progress").delete().eq("user_id", userId);
    await supabaseAdmin.from("enrollments").delete().eq("user_id", userId);
    await supabaseAdmin.from("enrollment_certificate_ids").delete().eq("user_id", userId);
    await supabaseAdmin.from("alt_payment_requests").delete().eq("user_id", userId);
    await supabaseAdmin.from("certificate_payments").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { deleted: true };
  });