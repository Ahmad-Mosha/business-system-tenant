import { describe, expect, it } from 'vitest';
import { AuthContext, broadestScope } from './auth-context.js';
import { PermissionDeniedError } from '../../shared/errors.js';

const user = {
  id: 'u1',
  email: 'a@b.c',
  name: 'A',
  organizationId: 'o1',
  organizationName: 'Org',
  mustChangePassword: false,
};

describe('broadestScope', () => {
  it('prefers ALL when a user holds the same permission through two roles', () => {
    expect(broadestScope('ASSIGNED', 'ALL')).toBe('ALL');
    expect(broadestScope('ALL', 'ASSIGNED')).toBe('ALL');
    expect(broadestScope('ALL', 'ALL')).toBe('ALL');
  });

  it('stays narrow when neither grant is broad', () => {
    expect(broadestScope('ASSIGNED', 'ASSIGNED')).toBe('ASSIGNED');
  });
});

describe('AuthContext', () => {
  it('returns the scope a permission was granted with', () => {
    const auth = new AuthContext(user, ['MODERATOR'], new Map([['order:read', 'ASSIGNED']]));
    expect(auth.requireScope('order:read')).toBe('ASSIGNED');
  });

  it('throws rather than defaulting when the permission is missing', () => {
    const auth = new AuthContext(user, [], new Map());
    expect(() => auth.requireScope('order:read')).toThrow(PermissionDeniedError);
  });

  it('reports undefined for a permission it does not hold', () => {
    const auth = new AuthContext(user, [], new Map());
    expect(auth.scopeFor('order:read')).toBeUndefined();
  });
});
