type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  const entry = {
    level,
    message,
    metadata,
    timestamp: new Date().toISOString()
  };
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
}

export const logger = {
  debug: (message: string, metadata?: Record<string, unknown>) => log('debug', message, metadata),
  info: (message: string, metadata?: Record<string, unknown>) => log('info', message, metadata),
  warn: (message: string, metadata?: Record<string, unknown>) => log('warn', message, metadata),
  error: (message: string, metadata?: Record<string, unknown>) => log('error', message, metadata)
};

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
