import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Input sanitisation
 * ------------------------------------------------------------------ */

/** Strip HTML/script payloads and control characters from free text. */
export function sanitizeText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on[a-z]+\s*=/gi, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim();
}

/** A trimmed, XSS-sanitised string field. */
const safeText = (min: number, max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .refine((v) => v.length >= min && v.length <= max, {
      message: `Must be between ${min} and ${max} characters.`,
    });

/* ------------------------------------------------------------------ *
 * Schemas — one per API surface
 * ------------------------------------------------------------------ */

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Password is too long.")
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), "Include at least one letter and one number.");

export const registrationSchema = z.object({
  email: z.string().email("Enter a valid email address.").max(255),
  password: passwordSchema,
  fullName: safeText(2, 120),
  country: safeText(2, 80).optional(),
  city: safeText(2, 80).optional(),
  mobileNumber: z.string().max(32).regex(/^[+0-9()\s-]*$/, "Enter a valid phone number.").optional(),
  signupType: z.enum(["standard", "academia"]).default("standard"),
  schoolName: safeText(2, 160).optional(),
});

export const courseSchema = z.object({
  title: safeText(3, 160),
  description: safeText(10, 4000),
  price: z.number().min(0).max(10_000),
  category: safeText(2, 80),
  level: z.enum(["certificate", "diploma"]),
});

export const enrollmentSchema = z.object({
  courseId: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/i, "Invalid course id."),
  level: z.enum(["certificate", "diploma"]),
  courseTitle: safeText(2, 200).optional(),
});

export const progressSchema = z.object({
  courseId: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/i, "Invalid course id."),
  level: z.enum(["certificate", "diploma"]),
  lessonId: z.number().int().min(0).max(1000),
  completionStatus: z.enum(["in_progress", "completed"]),
  quizScore: z.number().min(0).max(100).optional(),
});

export const auditQuerySchema = z.object({
  eventType: z.string().max(60).optional(),
  userId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

/* ------------------------------------------------------------------ *
 * Reusable validation helper for server functions
 * ------------------------------------------------------------------ */

export class ValidationError extends Error {
  readonly status = 400;
  readonly issues: { field: string; message: string }[];
  constructor(issues: { field: string; message: string }[]) {
    super(issues.map((i) => `${i.field}: ${i.message}`).join("; ") || "Invalid input.");
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/**
 * Validates + sanitises input against a schema. Throws a `ValidationError`
 * (HTTP 400 semantics, clear field messages) when it does not match.
 * Pass this straight into `.inputValidator()`.
 */
export function validate<S extends z.ZodTypeAny>(schema: S) {
  return (input: unknown): z.output<S> => {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new ValidationError(
        result.error.issues.map((i) => ({
          field: i.path.join(".") || "input",
          message: i.message,
        })),
      );
    }
    return result.data as z.output<S>;
  };
}
