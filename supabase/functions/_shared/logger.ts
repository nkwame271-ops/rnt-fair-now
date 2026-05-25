// Structured JSON logger for edge functions.
// Emits one line of JSON per call so logs are queryable in supabase analytics.
//
// Usage:
//   const log = createLogger("paystack-webhook", { requestId: crypto.randomUUID() });
//   log.info("received", { reference });
//   log.warn("retrying", { attempt: 2 });
//   log.error("failed", { error: err.message });

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (msg: string, ctx?: Record<string, unknown>) => void;
  info: (msg: string, ctx?: Record<string, unknown>) => void;
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
  error: (msg: string, ctx?: Record<string, unknown>) => void;
  child: (extra: Record<string, unknown>) => Logger;
  /** Wrap an async operation: logs start/end + duration, re-throws on error. */
  time: <T>(label: string, fn: () => Promise<T>, ctx?: Record<string, unknown>) => Promise<T>;
}

function emit(level: LogLevel, fn: string, base: Record<string, unknown>, msg: string, ctx?: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    level,
    fn,
    msg,
    ...base,
    ...(ctx || {}),
  };
  // Choose console method so analytics severity is right.
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export function createLogger(fn: string, base: Record<string, unknown> = {}): Logger {
  const make = (extra: Record<string, unknown>): Logger => {
    const merged = { ...base, ...extra };
    return {
      debug: (m, c) => emit("debug", fn, merged, m, c),
      info:  (m, c) => emit("info",  fn, merged, m, c),
      warn:  (m, c) => emit("warn",  fn, merged, m, c),
      error: (m, c) => emit("error", fn, merged, m, c),
      child: (e) => make({ ...merged, ...e }),
      time: async (label, op, c) => {
        const start = performance.now();
        try {
          const result = await op();
          const ms = Math.round(performance.now() - start);
          emit("info", fn, merged, label, { ...(c || {}), ok: true, duration_ms: ms });
          return result;
        } catch (err: any) {
          const ms = Math.round(performance.now() - start);
          emit("error", fn, merged, label, {
            ...(c || {}),
            ok: false,
            duration_ms: ms,
            error: err?.message || String(err),
          });
          throw err;
        }
      },
    };
  };
  return make({});
}
