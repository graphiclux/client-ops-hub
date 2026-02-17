import { getRedis } from "@/lib/redis";

export async function enforceRateLimit(key: string, limit = 10, windowSeconds = 60) {
  const redis = getRedis();
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }
  return {
    success: current <= limit,
    remaining: Math.max(0, limit - current)
  };
}
