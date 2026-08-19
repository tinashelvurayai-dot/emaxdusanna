import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { specialCourseIds } from "@/lib/special-courses";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

/**
 * Everyone who has completed a Global AHEP special programme (English or
 * French), with their profile details, unique credential ID and whether their
 * diploma has already been handed over.
 */
export const listSpecialProgramCompletions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = [...specialCourseIds];

    const [progressRes, certRes, issuedRes] = await Promise.all([
      supabaseAdmin
        .from("course_progress")
        .select("user_id, course_id, level, is_completed, updated_at")
        .in("course_id", ids)
        .eq("is_completed", true),
      supabaseAdmin
        .from("enrollment_certificate_ids")
        .select("user_id, course_id, level, certificate_id, course_title")
        .in("course_id", ids),
      supabaseAdmin.from("special_program_diplomas").select("user_id, course_id, issued, issued_at"),
    ]);

    const rows = progressRes.data ?? [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const profilesRes = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email, country").in("id", userIds)
      : { data: [] as any[] };

    const profiles = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
    const certs = new Map(
      (certRes.data ?? []).map((c: any) => [`${c.user_id}|${c.course_id}`, c]),
    );
    const issued = new Map(
      (issuedRes.data ?? []).map((i: any) => [`${i.user_id}|${i.course_id}`, i]),
    );

    return {
      completions: rows.map((r) => {
        const key = `${r.user_id}|${r.course_id}`;
        const p: any = profiles.get(r.user_id);
        const c: any = certs.get(key);
        const i: any = issued.get(key);
        return {
          userId: r.user_id,
          courseId: r.course_id,
          level: r.level,
          fullName: p?.full_name ?? null,
          email: p?.email ?? null,
          country: p?.country ?? null,
          certificateId: c?.certificate_id ?? null,
          courseTitle: c?.course_title ?? null,
          completedAt: r.updated_at,
          diplomaIssued: Boolean(i?.issued),
          diplomaIssuedAt: i?.issued_at ?? null,
        };
      }),
    };
  });

/** Tick/untick that a learner has received their special programme diploma. */
export const setSpecialProgramDiplomaIssued = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; courseId: string; issued: boolean }) => {
    if (!input?.userId || !input?.courseId) throw new Error("Missing learner or programme");
    if (!(specialCourseIds as readonly string[]).includes(input.courseId)) {
      throw new Error("Not a special programme");
    }
    return { userId: input.userId, courseId: input.courseId, issued: Boolean(input.issued) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("special_program_diplomas").upsert(
      {
        user_id: data.userId,
        course_id: data.courseId,
        issued: data.issued,
        issued_at: data.issued ? new Date().toISOString() : null,
        issued_by: data.issued ? context.userId : null,
      },
      { onConflict: "user_id,course_id" },
    );
    if (error) throw error;
    return { success: true };
  });
