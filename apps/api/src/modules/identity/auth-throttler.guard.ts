import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Rate limiting for the credential endpoints.
 *
 * Keyed on client IP *and* the email being attempted, for two reasons:
 *
 *  - Server-rendered pages reach the API from the web server's address, so every user
 *    would otherwise share one bucket and a single busy client could lock everyone out.
 *  - Keying on the email alone would let an attacker lock a known account out of their
 *    own login by deliberately failing against it.
 *
 * Together they bound both a brute-force run against one account and a burst from one
 * source, without either being able to deny service to somebody else.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    const body = req.body as { email?: unknown } | undefined;
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : '-';
    const ip = req.ip ?? 'unknown';
    return `${ip}|${email}`;
  }
}
