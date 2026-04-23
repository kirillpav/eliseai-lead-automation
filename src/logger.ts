export interface LeadLogger {
  info(event: string, data?: unknown): void;
  warn(event: string, data?: unknown): void;
  error(event: string, data?: unknown): void;
}

interface LoggerContext {
  runId: string;
  rowNumber?: number;
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, normalizeValue(nestedValue)])
    );
  }

  return value;
}

function emit(level: "INFO" | "WARN" | "ERROR", context: LoggerContext, event: string, data?: unknown): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    runId: context.runId,
    rowNumber: context.rowNumber ?? null,
    data: normalizeValue(data ?? {})
  };

  const message = JSON.stringify(payload);
  if (level === "ERROR") {
    console.error(message);
    return;
  }

  if (level === "WARN") {
    console.warn(message);
    return;
  }

  console.log(message);
}

export function createLeadLogger(context: LoggerContext): LeadLogger {
  return {
    info(event, data) {
      emit("INFO", context, event, data);
    },
    warn(event, data) {
      emit("WARN", context, event, data);
    },
    error(event, data) {
      emit("ERROR", context, event, data);
    }
  };
}
