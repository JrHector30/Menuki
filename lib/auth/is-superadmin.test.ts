import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isSuperadmin } from './is-superadmin';

describe('isSuperadmin', () => {
  const originalEnv = process.env.SUPERADMIN_EMAILS;

  beforeEach(() => {
    process.env.SUPERADMIN_EMAILS = 'jrhector30@gmail.com, admin@menuki.pe';
  });

  afterEach(() => {
    process.env.SUPERADMIN_EMAILS = originalEnv;
  });

  it('returns true when email matches case-insensitively and is confirmed', () => {
    expect(
      isSuperadmin({
        email: 'jrhector30@gmail.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      })
    ).toBe(true);

    expect(
      isSuperadmin({
        email: 'JRHECTOR30@GMAIL.COM',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      })
    ).toBe(true);

    expect(
      isSuperadmin({
        email: 'admin@menuki.pe',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      })
    ).toBe(true);
  });

  it('returns false when email is not confirmed', () => {
    expect(
      isSuperadmin({
        email: 'jrhector30@gmail.com',
        email_confirmed_at: null,
      })
    ).toBe(false);

    expect(
      isSuperadmin({
        email: 'jrhector30@gmail.com',
        email_confirmed_at: undefined,
      })
    ).toBe(false);
  });

  it('returns false when email is not in the allowed list', () => {
    expect(
      isSuperadmin({
        email: 'hacker@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      })
    ).toBe(false);
  });

  it('returns false when user is null or undefined', () => {
    expect(isSuperadmin(null)).toBe(false);
    expect(isSuperadmin(undefined)).toBe(false);
  });

  it('returns false when SUPERADMIN_EMAILS env is empty', () => {
    delete process.env.SUPERADMIN_EMAILS;
    expect(
      isSuperadmin({
        email: 'jrhector30@gmail.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      })
    ).toBe(false);
  });
});
