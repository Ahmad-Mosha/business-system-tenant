import { Inject, Injectable } from '@nestjs/common';
import { DB, schema, type Database } from '../../db/db.module.js';
import { newId } from '../../shared/ids.js';

export type Actor =
  | { type: 'USER'; userId: string; organizationId: string }
  | { type: 'SYSTEM'; organizationId?: string }
  | { type: 'INTEGRATION'; organizationId?: string };

export interface AuditEntry {
  actor: Actor;
  /** Dotted, past-tense, stable across refactors, e.g. "order.status.changed". */
  action: string;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Business history, not application logging. Append-only: entries are never updated or
 * deleted, and a correction is a new entry.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.insert(schema.auditEvents).values({
      id: newId(),
      organizationId: entry.actor.organizationId ?? null,
      actorType: entry.actor.type,
      actorUserId: entry.actor.type === 'USER' ? entry.actor.userId : null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      data: entry.data ?? null,
      correlationId: entry.correlationId ?? null,
    });
  }
}
