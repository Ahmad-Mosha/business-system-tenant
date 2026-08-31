import { Injectable, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from './db.service';
import { tenants } from './schema';

/**
 * Resolves which tenant a request belongs to. Today there is exactly one, so
 * it is resolved once at startup and cached.
 *
 * When there is ever more than one, this is the single place that changes —
 * the resolution moves to the request (a subdomain, a header), and everything
 * downstream already takes the tenant id as an argument.
 */
@Injectable()
export class TenantService implements OnModuleInit {
  private cached: { id: string; slug: string; name: string } | null = null;

  constructor(private readonly db: DbService) {}

  async onModuleInit() {
    await this.current().catch(() => {
      // A database with no tenant row yet is a normal state before seeding.
    });
  }

  async current() {
    if (this.cached) return this.cached;
    const slug = process.env.TENANT_SLUG ?? 'prime-market';
    const [row] = await this.db.db
      .select({ id: tenants.id, slug: tenants.slug, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    if (!row) throw new Error(`no tenant "${slug}" — run: npm run seed`);
    this.cached = row;
    return row;
  }
}
