// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function normalizeError(error: unknown): unknown {
  if (error instanceof Error) return error;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; filename?: unknown; lineno?: unknown; colno?: unknown };
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      const location = typeof candidate.filename === "string" ? ` (${candidate.filename}:${candidate.lineno ?? "?"}:${candidate.colno ?? "?"})` : "";
      return new Error(`${candidate.message}${location}`);
    }
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return new Error(serialized);
    } catch {
      return new Error("An unknown browser error occurred.");
    }
  }
  if (typeof error === "string" && error.trim()) return new Error(error);
  return new Error("An unknown browser error occurred.");
}

function record(error: unknown) {
  lastCapturedError = { error: normalizeError(error), at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
