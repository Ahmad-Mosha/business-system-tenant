import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lt, ne } from 'drizzle-orm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DB, schema, type Database } from '../../db/db.module.js';
import { newId } from '../../shared/ids.js';

export const SESSION_COOKIE = 'cops_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** Avoid a database write on every request; activity resolution of 15 minutes is plenty. */
const LAST_SEEN_REFRESH_MS = 15 * 60 * 1000;

export interface SessionContext {
  sessionId: string;
  userId: string;
}

@Injectable()
export class SessionService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Returns the raw token exactly once - only its SHA-256 is persisted, so a database
   * leak cannot be replayed as a live session.
   */
  async create(
    userId: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.db.insert(schema.sessions).values({
      id: newId(),
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      ipAddress: meta.ipAddress ?? null,
    });
    return { token, expiresAt };
  }

  async resolve(token: string): Promise<SessionContext | null> {
    const [row] = await this.db
      .select({
        id: schema.sessions.id,
        userId: schema.sessions.userId,
        lastSeenAt: schema.sessions.lastSeenAt,
      })
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.tokenHash, hashToken(token)),
          isNull(schema.sessions.revokedAt),
          gt(schema.sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) return null;

    if (Date.now() - row.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS) {
      await this.db
        .update(schema.sessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(schema.sessions.id, row.id));
    }

    return { sessionId: row.id, userId: row.userId };
  }

  async revoke(token: string): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(schema.sessions.tokenHash, hashToken(token)), isNull(schema.sessions.revokedAt)),
      );
  }

  /** Used when a password changes: every other session for that user must stop working. */
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const conditions = [eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)];
    await this.db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(
        exceptSessionId
          ? and(...conditions, ne(schema.sessions.id, exceptSessionId))
          : and(...conditions),
      );
  }

  async deleteExpired(): Promise<number> {
    const deleted = await this.db
      .delete(schema.sessions)
      .where(lt(schema.sessions.expiresAt, new Date()))
      .returning({ id: schema.sessions.id });
    return deleted.length;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison for secrets supplied by a caller. */
export function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
