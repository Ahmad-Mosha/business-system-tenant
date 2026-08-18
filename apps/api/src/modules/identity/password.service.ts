import { hash, verify, Algorithm } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

/**
 * argon2id with OWASP's recommended parameters. Passwords are never stored, logged,
 * or returned - only this hash exists, and it is one-way.
 */
const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  /**
   * A genuine hash of a value nobody knows, computed once at boot. Verifying against
   * it costs the same as verifying a real user, so login response time does not reveal
   * whether an email exists.
   */
  private readonly decoyHash: Promise<string> = hash(
    randomBytes(32).toString('hex'),
    OPTIONS,
  );

  hash(plaintext: string): Promise<string> {
    return hash(plaintext, OPTIONS);
  }

  async verify(passwordHash: string, plaintext: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plaintext, OPTIONS);
    } catch {
      // A malformed stored hash must fail closed, not throw a 500 at the caller.
      return false;
    }
  }

  /** Spend equivalent time when the email was not found, then let the caller fail. */
  async verifyDecoy(plaintext: string): Promise<void> {
    await this.verify(await this.decoyHash, plaintext);
  }
}
