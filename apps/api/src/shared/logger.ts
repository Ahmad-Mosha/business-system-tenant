import type { LoggerService } from '@nestjs/common';
import pino from 'pino';

export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'api' },
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.token'],
    censor: '[redacted]',
  },
});

/** Bridges Nest's logging calls onto pino so everything is structured JSON. */
export class PinoLoggerService implements LoggerService {
  log(message: unknown, context?: string) {
    rootLogger.info({ context }, String(message));
  }
  error(message: unknown, stack?: string, context?: string) {
    rootLogger.error({ context, stack }, String(message));
  }
  warn(message: unknown, context?: string) {
    rootLogger.warn({ context }, String(message));
  }
  debug(message: unknown, context?: string) {
    rootLogger.debug({ context }, String(message));
  }
  verbose(message: unknown, context?: string) {
    rootLogger.trace({ context }, String(message));
  }
}
