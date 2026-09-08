import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Return the current authenticated user's full name + signup type (for the
 *  cert verification / academia flow). */
export const getMyFullName = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("full_name, signup_type, school_name, country")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      fullName: data?.full_name ?? "",
      signupType: (data?.signup_type as string | null) ?? "standard",
      schoolName: (data?.school_name as string | null) ?? null,
      country: (data?.country as string | null) ?? null,
    };

  });

/** Verify / update the authenticated user's full name. Used right before the
 *  student is issued a certificate so the name printed on the credential is
 *  the one they actually want. */
export const verifyFullName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string }) => {
    const name = (input?.fullName ?? "").trim();
    if (name.length < 2) throw new Error("Please enter your full name.");
    if (name.length > 120) throw new Error("Name is too long.");
    if (!/\s/.test(name)) throw new Error("Please enter both first and last name.");
    return { fullName: name };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { fullName: data.fullName };
  });

import { getCoursePrice, type PriceLevel } from "@/lib/pricing";

/**
 * Academia (contracted-school) submission. Academia learners do NOT pay via
 * PayPal — their school covers the credential as a cash arrangement. After
 * verifying their full name they call this fn, which records a payment row
 * with status "noted" so the admin sees them in the dashboard and can issue
 * the credential.
 *
 * Server-side guards: caller must actually be an academia profile, name must
 * be on file, and we de-duplicate per (user, course, level) like PayPal.
 */
export const submitAcademiaCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; courseName: string; level: string }) => {
    if (!input?.courseId) throw new Error("Missing course");
    if (!input?.courseName?.trim()) throw new Error("Missing course name");
    if (input.level !== "certificate" && input.level !== "diploma")
      throw new Error("Invalid level");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, signup_type, school_name")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) throw new Error("Profile not found.");
    if ((profile.signup_type ?? "standard") !== "academia") {
      throw new Error("Only academia learners can use this submission path.");
    }
    if (!profile.full_name || profile.full_name.trim().length < 2) {
      throw new Error("Please verify your full name first.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("certificate_payments")
      .select("id, certificate_id")
      .eq("user_id", userId)
      .eq("course_id", data.courseId)
      .eq("certificate_type", data.level)
      .in("payment_status", ["paid_pending_admin", "noted", "certificate_sent"]);
    if (existing && existing.length > 0) {
      return {
        success: true,
        alreadySubmitted: true,
        certificateId: existing[0].certificate_id ?? "",
      };
    }

    const certificateId = `EDU-ACAD-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabaseAdmin.from("certificate_payments").insert({
      user_id: userId,
      student_name: profile.full_name,
      email: profile.email ?? null,
      course_id: data.courseId,
      course_name: data.courseName,
      certificate_type: data.level,
      amount: getCoursePrice(data.courseId, data.level as PriceLevel),
      payment_status: "noted",
      certificate_id: certificateId,
    });
    if (error) throw new Error(error.message);

    // Notify admin (non-blocking)
    try {
      const { notifyAdminWhatsApp } = await import("@/lib/notify.server");
      const label = data.level === "diploma" ? "Diploma" : "Certificate";
      await notifyAdminWhatsApp(
        `Academia request: ${label} for "${data.courseName}" by ${profile.full_name} (${profile.school_name ?? "school n/a"}). Cert ID: ${certificateId}`,
      );
    } catch {
      /* notification must never block submission */
    }

    return { success: true, alreadySubmitted: false, certificateId };
  });

/** Ensure the signed-in user has a public profile row (self-healing if the
 *  auth trigger did not run) and return their roles. */
export const ensureMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", context.userId)
      .maybeSingle();

    if (!existing) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const meta = (authUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const email = authUser?.user?.email ?? null;
      const str = (k: string) => {
        const v = meta[k];
        return typeof v === "string" && v.trim() ? v.trim() : null;
      };
      await supabaseAdmin.from("profiles").insert({
        id: context.userId,
        full_name: str("full_name") ?? (email ? email.split("@")[0] : null),
        email,
        country: str("country"),
        mobile_number: str("mobile_number"),
        signup_type: str("signup_type") ?? "standard",
        school_name: str("school_name"),
        class_name: str("class_name"),
      });
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    return { roles: (roles ?? []).map((r) => r.role as string) };
  });
