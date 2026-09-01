import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public credential verification. Anyone (employer, certificate owner, etc.)
 * can look up a certificate or diploma by its verification ID without being
 * signed in.
 *
 * Two ID families exist:
 *  1. certificate_payments.certificate_id — normal / cash / academia credentials.
 *     Valid only when payment_status = "certificate_sent".
 *  2. enrollment_certificate_ids.certificate_id — the ID allocated at enrolment
 *     and printed on special-programme (AHEP) diplomas. Valid only when the
 *     matching special_program_diplomas row is marked issued.
 *
 * Returns only the minimal information needed to verify - never PII like
 * email or payment amounts.
 */
export const verifyCertificate = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ certificateId: z.string().trim().min(3).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = data.certificateId.trim().toUpperCase();

    // 1) Payment-backed credentials
    const payRes = await supabaseAdmin
      .from("certificate_payments")
      .select("certificate_id, certificate_type, student_name, course_name, payment_status, updated_at")
      .ilike("certificate_id", id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (payRes.error) return { valid: false as const, reason: "lookup_failed" as const };

    const pay = payRes.data?.[0];
    if (pay?.certificate_id) {
      if (pay.payment_status !== "certificate_sent") {
        return { valid: false as const, reason: "not_issued" as const };
      }
      return {
        valid: true as const,
        certificateId: pay.certificate_id,
        level: pay.certificate_type === "diploma" ? ("diploma" as const) : ("certificate" as const),
        studentName: pay.student_name ?? "",
        courseName: pay.course_name ?? "",
        issuedAt: pay.updated_at,
      };
    }

    // 2) Enrolment-allocated IDs (special programme diplomas)
    const enrolRes = await supabaseAdmin
      .from("enrollment_certificate_ids")
      .select("certificate_id, user_id, course_id, level, course_title, student_name, created_at")
      .ilike("certificate_id", id)
      .limit(1);

    if (enrolRes.error) return { valid: false as const, reason: "lookup_failed" as const };

    const enrol = enrolRes.data?.[0];
    if (!enrol?.certificate_id) return { valid: false as const, reason: "not_found" as const };

    const { data: diploma } = await supabaseAdmin
      .from("special_program_diplomas")
      .select("issued, issued_at")
      .eq("user_id", enrol.user_id)
      .eq("course_id", enrol.course_id)
      .maybeSingle();

    if (!diploma?.issued) return { valid: false as const, reason: "not_issued" as const };

    // Prefer the verified profile name if the enrolment snapshot is missing one.
    let studentName = enrol.student_name ?? "";
    if (!studentName) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", enrol.user_id)
        .maybeSingle();
      studentName = profile?.full_name ?? "";
    }

    return {
      valid: true as const,
      certificateId: enrol.certificate_id,
      level: enrol.level === "diploma" ? ("diploma" as const) : ("certificate" as const),
      studentName,
      courseName: enrol.course_title ?? enrol.course_id,
      issuedAt: diploma.issued_at ?? enrol.created_at,
    };
  });
