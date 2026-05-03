import { Redis } from "@upstash/redis";
import { loadConfig } from "@/lib/config";

export type RedisClient = {
  hincrby: (key: string, field: string, by: number) => Promise<number>;
  incr: (key: string) => Promise<number>;
};

let cached: RedisClient | null = null;

export function getRedis(): RedisClient {
  if (cached) return cached;
  const cfg = loadConfig();
  const client = new Redis({ url: cfg.kvUrl, token: cfg.kvToken });
  cached = {
    hincrby: (key, field, by) => client.hincrby(key, field, by),
    incr: (key) => client.incr(key),
  };
  return cached;
}
