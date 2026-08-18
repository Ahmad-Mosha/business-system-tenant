import type { AuthContext } from '../modules/identity/auth-context.js';

/**
 * Request-scoped values attached by middleware and guards. Declared once, globally,
 * so every handler sees the same types.
 */
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      auth?: AuthContext;
      sessionId?: string;
      sessionToken?: string;
    }
  }
}

export {};
