import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Compliance data (payments, credential IDs) is kept for 7 tax years. */
const RETENTION_YEARS = 7;

/**
 * Change the signed-in learner's password and invalidate every other active
 * session. `last_password_change` is stamped so any token minted before the
 * change is rejected by `requireFreshSession`.
 */
export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { newPassword: string }) => {
    const newPassword = (input?.newPassword ?? "").trim();
    if (newPassword.length < 8) throw new Error("Use at least 8 characters.");
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw new Error("Include at least one letter and one number.");
    }
    return { newPassword };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);

    // Revoke every refresh token so other devices are logged out immediately.
    await supabaseAdmin.auth.admin.signOut(context.userId, "global").catch(() => {});
    await supabaseAdmin.rpc("touch_last_password_change", { _user_id: context.userId });

    return { changed: true };
  });

/**
 * GDPR account closure: anonymise the learner's personal data, archive the
 * records we must keep for compliance, and lock the login out permanently.
 * Available to every signed-in learner from their dashboard settings.
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

    const retainUntil = new Date();
    retainUntil.setFullYear(retainUntil.getFullYear() + RETENTION_YEARS);

    await supabaseAdmin
      .from("profiles")
      .update({ deletion_status: "pending_deletion", deleted_at: new Date().toISOString() })
      .eq("id", userId);

    // 1. Archive compliance-required records before anything is removed.
    const [payments, altPayments, credentialIds] = await Promise.all([
      supabaseAdmin.from("certificate_payments").select("*").eq("user_id", userId),
      supabaseAdmin.from("alt_payment_requests").select("*").eq("user_id", userId),
      supabaseAdmin.from("enrollment_certificate_ids").select("*").eq("user_id", userId),
    ]);

    const archive = [
      ...(payments.data ?? []).map((row) => ({ kind: "certificate_payment", payload: row })),
      ...(altPayments.data ?? []).map((row) => ({ kind: "alt_payment_request", payload: row })),
      ...(credentialIds.data ?? []).map((row) => ({ kind: "credential_id", payload: row })),
    ].map((entry) => ({
      original_user_id: userId,
      kind: entry.kind,
      payload: entry.payload as unknown as Record<string, unknown>,
      retain_until: retainUntil.toISOString(),
    }));

    if (archive.length > 0) {
      await supabaseAdmin.from("retention_archive").insert(archive);
    }

    // 2. Remove learning data that carries no compliance obligation.
    await supabaseAdmin.from("course_progress").delete().eq("user_id", userId);
    await supabaseAdmin.from("enrollments").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("alt_payment_requests").delete().eq("user_id", userId);

    // 3. Anonymise personal data on records we keep for verification/audit.
    const anonEmail = `deleted-user-${userId}@example.com`;
    await supabaseAdmin
      .from("certificate_payments")
      .update({ student_name: "Deleted user", email: anonEmail })
      .eq("user_id", userId);
    await supabaseAdmin
      .from("enrollment_certificate_ids")
      .update({ student_name: "Deleted user" })
      .eq("user_id", userId);

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: "Deleted user",
        email: anonEmail,
        country: null,
        city: null,
        mobile_number: null,
        school_name: null,
        deletion_status: archive.length > 0 ? "retained" : "anonymized",
        anonymized_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // 4. Lock the login: anonymise the auth identity and revoke all sessions.
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: anonEmail,
      user_metadata: {},
      ban_duration: "876000h",
    });
    await supabaseAdmin.auth.admin.signOut(userId, "global").catch(() => {});

    return { deleted: true, archivedRecords: archive.length, retainUntil: retainUntil.toISOString() };
  });
