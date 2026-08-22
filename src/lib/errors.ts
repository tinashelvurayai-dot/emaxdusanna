import { ValidationError } from "@/lib/validation";

export type ErrorCategory = "validation" | "auth" | "database" | "external_api" | "rate_limit" | "unknown";

export interface SafeError {
  category: ErrorCategory;
  status: number;
  message: string;
  issues?: { field: string; message: string }[];
  traceId: string;
}

function categorize(error: unknown): { category: ErrorCategory; status: number; message: string } {
  if (error instanceof ValidationError) {
    return { category: "validation", status: 400, message: error.message };
  }
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("invalid token")) {
    return { category: "auth", status: 403, message: "You are not allowed to do that. Please sign in again." };
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return { category: "rate_limit", status: 429, message: "Too many requests. Please slow down and try again shortly." };
  }
  if (lower.includes("pgrst") || lower.includes("permission denied") || lower.includes("relation") || lower.includes("duplicate key")) {
    return { category: "database", status: 500, message: "We could not save that right now. Please try again." };
  }
  if (lower.includes("fetch") || lower.includes("paypal") || lower.includes("telegram") || lower.includes("timeout")) {
    return { category: "external_api", status: 502, message: "An external service is unavailable. Please try again shortly." };
  }
  return { category: "unknown", status: 500, message: "Something went wrong on our side. Please try again." };
}

/**
 * Central error boundary for server functions and routes: logs the full detail
 * (stack, category, trace id) to the platform logs, and returns a
 * user-friendly, leak-free payload. Also writes an audit entry.
 */
export async function handleServerError(
  error: unknown,
  context: { operation: string; userId?: string | null },
): Promise<SafeError> {
  const { category, status, message } = categorize(error);
  const traceId = crypto.randomUUID();

  console.error(
    JSON.stringify({
      level: "error",
      traceId,
      category,
      operation: context.operation,
      userId: context.userId ?? null,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      at: new Date().toISOString(),
    }),
  );

  try {
    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      userId: context.userId ?? null,
      eventType: `error:${category}`,
      category: category === "validation" ? "validation" : "api",
      severity: status >= 500 ? "critical" : "warning",
      details: { operation: context.operation, traceId },
    });
  } catch {
    /* auditing must never mask the original error */
  }

  return {
    category,
    status,
    message,
    traceId,
    ...(error instanceof ValidationError ? { issues: error.issues } : {}),
  };
}

/** Wrap a server-function handler body so every failure is categorised + logged. */
export async function withErrorHandling<T>(
  operation: string,
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const safe = await handleServerError(error, { operation, userId });
    throw new Error(`${safe.message} (ref ${safe.traceId})`);
  }
}
