export interface SuperadminUserCheck {
  email?: string | null;
  email_confirmed_at?: string | null;
}

/**
 * Checks whether an authenticated user is a platform superadmin.
 * Requires an active, confirmed email address matching one of the
 * comma-separated emails defined in process.env.SUPERADMIN_EMAILS.
 * No hardcoded default emails are allowed in code.
 */
export function isSuperadmin(user?: SuperadminUserCheck | null): boolean {
  if (!user || !user.email || !user.email_confirmed_at) {
    return false;
  }

  const rawConfig = process.env.SUPERADMIN_EMAILS;
  if (!rawConfig) {
    return false;
  }

  const allowedEmails = rawConfig
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const normalizedUserEmail = user.email.trim().toLowerCase();
  return allowedEmails.includes(normalizedUserEmail);
}
