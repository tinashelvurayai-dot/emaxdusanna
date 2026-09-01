import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_STATUSES = ["paid_pending_admin", "noted", "certificate_sent"] as const;
type PaymentStatus = (typeof ALLOWED_STATUSES)[number];

/**
 * Public check for the hidden admin gate (footer logo tapped 7 times).
 * Returns whether an admin account already exists so the gate can show the
 * correct screen: sign up (no admin yet) or sign in (admin exists).
 */
export const adminGateState = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { adminExists: (count ?? 0) > 0 };
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

/** Lightweight check used by the UI to decide whether to show admin controls. */
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

/** Aggregate counts for the admin overview cards. */
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [users, payments, paid] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("certificate_payments").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("certificate_payments").select("amount,certificate_type,payment_status"),
    ]);

    const rows = paid.data ?? [];
    const totalRevenue = rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
    const certificatesSent = rows.filter((r) => r.payment_status === "certificate_sent").length;
    const pending = rows.filter((r) => r.payment_status === "paid_pending_admin").length;

    return {
      totalUsers: users.count ?? 0,
      totalPayments: payments.count ?? 0,
      totalRevenue,
      certificatesSent,
      pending,
    };
  });

/** Full list of certificate/diploma payments for the admin payments table. */
export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("certificate_payments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { payments: data ?? [] };
  });

/** Update the workflow status of a payment (e.g. mark certificate as sent). */
export const updatePaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: PaymentStatus }) => {
    if (!input?.id) throw new Error("Missing payment id");
    if (!ALLOWED_STATUSES.includes(input.status)) throw new Error("Invalid status");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("certificate_payments")
      .update({ payment_status: data.status })
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

/**
 * Paginated list of registered users for the admin users table.
 * Server-side paging + text search keeps this fast at 10k+ learners
 * (never loads the whole profiles table into the browser).
 */
export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { page?: number; pageSize?: number; search?: string; sort?: string }) => {
    const page = Math.max(1, Math.floor(Number(input?.page ?? 1)) || 1);
    const pageSize = Math.min(200, Math.max(10, Math.floor(Number(input?.pageSize ?? 50)) || 50));
    return {
      page,
      pageSize,
      search: (input?.search ?? "").trim().slice(0, 120),
      sort: input?.sort ?? "newest",
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, country, city, signup_type, school_name, school_id, created_at", {
        count: "exact",
      });

    // Free-text words (tokens like "type:academia" are applied client-side).
    const words = data.search
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !w.includes(":"))
      .slice(0, 3);
    for (const w of words) {
      const safe = w.replace(/[%,()]/g, "");
      q = q.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,school_name.ilike.%${safe}%`);
    }

    if (data.sort === "name") q = q.order("full_name", { ascending: true });
    else if (data.sort === "school") q = q.order("school_name", { ascending: true });
    else q = q.order("created_at", { ascending: data.sort === "oldest" });

    const from = (data.page - 1) * data.pageSize;
    const { data: rows, error, count } = await q.range(from, from + data.pageSize - 1);
    if (error) throw error;
    return {
      users: rows ?? [],
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / data.pageSize)),
    };
  });


import { getCoursePrice, type PriceLevel } from "@/lib/pricing";

/**
 * Record a manual / cash payment for a learner who paid offline.
 * Admin-only. Creates a certificate_payments row via the service role so the
 * learner shows up in the payments table and can be issued a credential.
 */
export const createManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      courseId: string;
      courseName: string;
      level: "certificate" | "diploma";
      comp?: boolean;
      notes?: string;
    }) => {
      if (!input?.userId) throw new Error("Select a learner");
      if (!input?.courseName?.trim()) throw new Error("Course name is required");
      if (input.level !== "certificate" && input.level !== "diploma")
        throw new Error("Invalid level");
      return {
        ...input,
        comp: Boolean(input.comp),
        notes: (input.notes ?? "").trim().slice(0, 500) || null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", data.userId)
      .maybeSingle();

    const prefix = data.comp ? "EDU-COMP" : "EDU-CASH";
    const certificateId = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabaseAdmin.from("certificate_payments").insert({
      user_id: data.userId,
      student_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      course_id: data.courseId || data.courseName.toLowerCase().replace(/\s+/g, "-"),
      course_name: data.courseName,
      certificate_type: data.level,
      amount: data.comp ? 0 : getCoursePrice(data.courseId, data.level as PriceLevel),
      payment_status: data.comp ? "certificate_sent" : "noted",
      certificate_id: certificateId,
    });
    if (error) throw error;
    return { success: true, certificateId };
  });

/** Bulk add contracted schools from a CSV/newline-separated list of names. */
export const bulkAddContractedSchools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { names: string[] }) => {
    if (!Array.isArray(input?.names)) throw new Error("Invalid payload");
    const names = Array.from(
      new Set(
        input.names
          .map((n) => (typeof n === "string" ? n.trim() : ""))
          .filter((n) => n.length >= 2 && n.length <= 200),
      ),
    );
    if (names.length === 0) throw new Error("No valid school names found");
    if (names.length > 500) throw new Error("Limit is 500 schools per upload");
    return { names };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.names.map((name) => ({ name, created_by: context.userId }));
    const { data: inserted, error } = await supabaseAdmin
      .from("contracted_schools")
      .upsert(rows, { onConflict: "normalized_name", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    const added = inserted?.length ?? 0;
    return { added, skipped: data.names.length - added };
  });


/**
 * Fetch all course_progress rows for a single learner and resolve them
 * into picker-friendly options (course id + title + level + completion).
 * Used by the smart cash payment form so the admin doesn't have to type
 * the course name - they pick from what the learner actually studied.
 */
export const getLearnerCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("Missing userId");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getCatalogItem, getCourseTitle } = await import("@/lib/courses");

    const { data: progress, error } = await supabaseAdmin
      .from("course_progress")
      .select("course_id, level, completed_modules, is_completed, updated_at")
      .eq("user_id", data.userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const { data: paid } = await supabaseAdmin
      .from("certificate_payments")
      .select("course_id, certificate_type")
      .eq("user_id", data.userId)
      .in("payment_status", ["paid_pending_admin", "noted", "certificate_sent"]);
    const paidKey = new Set((paid ?? []).map((p) => `${p.course_id}::${p.certificate_type}`));

    const courses = (progress ?? []).map((row) => {
      const item = getCatalogItem(row.course_id);
      const level = (row.level === "diploma" ? "diploma" : "certificate") as
        | "certificate"
        | "diploma";
      const title = item ? getCourseTitle(item, level) : row.course_id;
      return {
        courseId: row.course_id,
        title,
        level,
        completedModules: Array.isArray(row.completed_modules) ? row.completed_modules.length : 0,
        isCompleted: Boolean(row.is_completed),
        alreadyPaid: paidKey.has(`${row.course_id}::${level}`),
        updatedAt: row.updated_at,
      };
    });

    return { courses };
  });

/* ------------------------------ Contracted schools ----------------------------- */

export const listContractedSchools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [schoolsRes, learnersRes, adminsRes, rosterRes] = await Promise.all([
      supabaseAdmin
        .from("contracted_schools")
        .select("id, name, created_at, is_active, seat_limit, notes")
        .order("name", { ascending: true }),
      supabaseAdmin.from("profiles").select("school_id").not("school_id", "is", null),
      supabaseAdmin.from("school_admins").select("school_id, school_name, user_id"),
      supabaseAdmin.from("school_rosters").select("school_id").not("school_id", "is", null),
    ]);
    if (schoolsRes.error) throw schoolsRes.error;

    const tally = (rows: Array<{ school_id: string | null }> | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) {
        if (!r.school_id) continue;
        m.set(r.school_id, (m.get(r.school_id) ?? 0) + 1);
      }
      return m;
    };
    const learners = tally(learnersRes.data as any);
    const roster = tally(rosterRes.data as any);
    const admins = tally((adminsRes.data ?? []) as any);

    const schools = (schoolsRes.data ?? []).map((s) => ({
      ...s,
      learnerCount: learners.get(s.id) ?? 0,
      rosterCount: roster.get(s.id) ?? 0,
      adminCount: admins.get(s.id) ?? 0,
      seatsUsedPct: s.seat_limit ? Math.round(((learners.get(s.id) ?? 0) / s.seat_limit) * 100) : null,
    }));

    // School admin accounts whose school name does not match the contracted list.
    const unlinkedAdmins = (adminsRes.data ?? [])
      .filter((a: any) => !a.school_id)
      .map((a: any) => ({ userId: a.user_id, schoolName: a.school_name }));

    return { schools, unlinkedAdmins };
  });

/** Toggle a school's active state / seat limit. */
export const updateContractedSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; isActive?: boolean; seatLimit?: number | null }) => {
    if (!input?.id) throw new Error("Missing id");
    const seatLimit =
      input.seatLimit === null || input.seatLimit === undefined
        ? input.seatLimit ?? undefined
        : Number(input.seatLimit);
    if (typeof seatLimit === "number" && (!Number.isFinite(seatLimit) || seatLimit < 0 || seatLimit > 100000))
      throw new Error("Invalid seat limit");
    return { id: input.id, isActive: input.isActive, seatLimit };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (typeof data.isActive === "boolean") patch['is_active'] = data.isActive;
    if (data.seatLimit !== undefined) patch['seat_limit'] = data.seatLimit;
    if (Object.keys(patch).length === 0) return { success: true };
    const { error } = await supabaseAdmin.from("contracted_schools").update(patch).eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });


export const addContractedSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => {
    const name = (input?.name ?? "").trim();
    if (name.length < 2 || name.length > 200) throw new Error("School name is required");
    return { name };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("contracted_schools")
      .insert({ name: data.name, created_by: context.userId });
    if (error) {
      if (error.code === "23505") throw new Error("That school is already on the list");
      throw error;
    }
    return { success: true };
  });

export const removeContractedSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Missing id");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contracted_schools").delete().eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

/* ------------------------------ Sample certificate ----------------------------- */

export interface SampleCertificateValue {
  studentName: string;
  courseName: string;
  level: "certificate" | "diploma";
  date: string;
  certificateId: string;
}

const SAMPLE_CERT_KEY = "sample_certificate";
const DEFAULT_SAMPLE: SampleCertificateValue = {
  studentName: "Tariro Moyo",
  courseName: "Data Science Fundamentals",
  level: "certificate",
  date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  certificateId: "EDU-SAMPLE-001",
};

export const getSampleCertificate = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", SAMPLE_CERT_KEY)
    .maybeSingle();
  return { value: (data?.value as SampleCertificateValue | null) ?? DEFAULT_SAMPLE };
});

export const saveSampleCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SampleCertificateValue) => {
    if (!input || typeof input !== "object") throw new Error("Invalid payload");
    const fields: Array<keyof SampleCertificateValue> = ["studentName", "courseName", "date", "certificateId"];
    for (const f of fields) {
      const v = (input as any)[f];
      if (typeof v !== "string" || v.length > 200) throw new Error(`Invalid ${f}`);
    }
    if (input.level !== "certificate" && input.level !== "diploma") throw new Error("Invalid level");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({
        key: SAMPLE_CERT_KEY,
        value: data,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    if (error) throw error;
    return { success: true };
  });


/* ------------------------------ Auth page settings ----------------------------- */

const AUTH_SETTINGS_KEY = "auth_settings";

export interface AuthSettingsValue {
  googleEnabled: boolean;
}

const DEFAULT_AUTH_SETTINGS: AuthSettingsValue = { googleEnabled: true };

/** Public read so the sign-in page knows whether to render the Google button. */
export const getAuthSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", AUTH_SETTINGS_KEY)
    .maybeSingle();
  const value = (data?.value as Partial<AuthSettingsValue> | null) ?? null;
  return {
    value: {
      googleEnabled: value?.googleEnabled ?? DEFAULT_AUTH_SETTINGS.googleEnabled,
    } as AuthSettingsValue,
  };
});

export const saveAuthSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AuthSettingsValue) => {
    if (!input || typeof input.googleEnabled !== "boolean") throw new Error("Invalid payload");
    return { googleEnabled: input.googleEnabled };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: AUTH_SETTINGS_KEY,
      value: data,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    });
    if (error) throw error;
    return { success: true };
  });
