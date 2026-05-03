import type { RedisClient } from "@/lib/redis";

export type FakeRedis = RedisClient & {
  state: {
    hashes: Map<string, Map<string, number>>;
    counters: Map<string, number>;
  };
  failNext: (op: "hincrby" | "incr") => void;
};

export function makeFakeRedis(): FakeRedis {
  const hashes = new Map<string, Map<string, number>>();
  const counters = new Map<string, number>();
  let failOp: "hincrby" | "incr" | null = null;

  return {
    state: { hashes, counters },
    failNext(op) {
      failOp = op;
    },
    async hincrby(key, field, by) {
      if (failOp === "hincrby") {
        failOp = null;
        throw new Error("simulated redis failure");
      }
      let h = hashes.get(key);
      if (!h) {
        h = new Map();
        hashes.set(key, h);
      }
      const next = (h.get(field) ?? 0) + by;
      h.set(field, next);
      return next;
    },
    async incr(key) {
      if (failOp === "incr") {
        failOp = null;
        throw new Error("simulated redis failure");
      }
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    },
  };
}
