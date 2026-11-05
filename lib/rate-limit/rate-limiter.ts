import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let warnedMissingConfig = false;

function getRedisInstance(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!warnedMissingConfig && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[RateLimit] Variables UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN no configuradas. El limitador de tasa operará en modo permisivo (bypass).'
      );
      warnedMissingConfig = true;
    }
    return null;
  }

  return new Redis({
    url,
    token,
  });
}

/**
 * Creates a rate limiter instance if Redis credentials are present.
 * If credentials are not present, returns a no-op limiter that always succeeds.
 */
export function createLimiter(requests: number, windowSeconds: number, prefix: string) {
  const redis = getRedisInstance();

  if (!redis) {
    return {
      limit: async (_identifier: string) => ({
        success: true,
        limit: requests,
        remaining: requests,
        reset: 0,
      }),
    };
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
    prefix: `menuki:rl:${prefix}`,
  });
}

// 1. Order placement limiter: 10 requests / 10 minutes per IP
export const orderIpLimiter = createLimiter(10, 600, 'order_ip');

// 2. Store throughput limiter: 60 orders / 1 minute per store
export const orderStoreLimiter = createLimiter(60, 60, 'order_store');

// 3. Auth login limiter: 5 attempts / 5 minutes per IP or email
export const authLoginLimiter = createLimiter(5, 300, 'auth_login');
