export interface SuperadminUserCheck {
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}

/**
 * Checks whether an authenticated user is a platform superadmin.
 * Requires an active email address matching one of the comma-separated
 * emails defined in process.env.SUPERADMIN_EMAILS.
 * Rejects accounts where email confirmation is explicitly null.
 */
export function isSuperadmin(user?: SuperadminUserCheck | null): boolean {
  if (!user || !user.email) {
    return false;
  }

  // Reject unconfirmed accounts where email_confirmed_at or confirmed_at is explicitly null
  if (user.email_confirmed_at === null && user.confirmed_at === null) {
    return false;
  }

  const rawConfig = process.env.SUPERADMIN_EMAILS;
  if (!rawConfig) {
    return false;
  }

  const allowedEmails = rawConfig
    .split(',')
    .map((e) => e.replace(/['"]/g, '').trim().toLowerCase())
    .filter(Boolean);

  const normalizedUserEmail = user.email.trim().toLowerCase();
  return allowedEmails.includes(normalizedUserEmail);
}
