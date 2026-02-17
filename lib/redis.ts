import { Redis } from "ioredis";
import { env } from "@/lib/env";

let redisClient: Redis | null = null;

export function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true
    });
  }
  return redisClient;
}
