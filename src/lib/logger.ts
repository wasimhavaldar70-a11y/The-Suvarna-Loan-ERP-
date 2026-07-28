// ========================================================
// SuvarnaLoan ERP - Centralized Structured Logger
// Location: src/lib/logger.ts
// ========================================================

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  tenantId?: string;
  userId?: string;
  route?: string;
  action?: string;
  durationMs?: number;
  [key: string]: any;
}

// Sensitive PII pattern regex list for auto-redaction
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'aadhaar',
  'aadhaar_number',
  'pan',
  'pan_number',
  'authorization',
  'cookie',
];

/**
 * Recursively sanitizes objects to mask sensitive PII / secret fields
 */
function sanitizePayload(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s));
    if (isSensitive && typeof val === 'string') {
      sanitized[key] = val.length > 4 ? `${val.substring(0, 2)}***${val.substring(val.length - 2)}` : '***REDACTED***';
    } else if (typeof val === 'object') {
      sanitized[key] = sanitizePayload(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

function formatLogMessage(level: LogLevel, message: string, context?: LogContext) {
  const sanitizedContext = context ? sanitizePayload(context) : {};
  const traceId = sanitizedContext.traceId || `tr-${Math.random().toString(36).substring(2, 9)}`;
  const payload = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    env: process.env.NODE_ENV || 'development',
    traceId,
    message,
    ...sanitizedContext,
  };

  return JSON.stringify(payload);
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(formatLogMessage('info', message, context));
  },

  warn(message: string, context?: LogContext) {
    console.warn(formatLogMessage('warn', message, context));
  },

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorDetails = error instanceof Error
      ? { errorMessage: error.message, stack: error.stack }
      : { errorMessage: String(error) };

    console.error(formatLogMessage('error', message, { ...context, ...errorDetails }));
  },

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLogMessage('debug', message, context));
    }
  },
};
