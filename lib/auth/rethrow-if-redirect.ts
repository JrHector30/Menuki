/**
 * Re-throws an error if it represents an internal Next.js redirect.
 * In Next.js App Router, `redirect()` works by throwing an error with a digest starting with 'NEXT_REDIRECT'.
 * Server Actions must let this error bubble up instead of capturing it as a generic business error.
 */
export function rethrowIfRedirect(err: unknown): void {
  if (
    err &&
    typeof err === 'object' &&
    'digest' in err &&
    typeof (err as { digest: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  ) {
    throw err;
  }
}
