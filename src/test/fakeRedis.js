/**
 * In-memory Upstash Redis for endpoint tests: answers the commands that
 * api/_lib/kv.js sends. Strings are stored as strings, lists as arrays,
 * sets as arrays, hashes as objects and sorted sets as Map(member → score).
 */
export function fakeRedis() {
  const store = new Map();
  const hash = (key) => store.get(key) || {};
  const zset = (key) => store.get(key) || new Map();

  const run = ([cmd, key, ...args]) => {
    switch (cmd) {
      case "GET":
        return store.get(key) ?? null;
      case "SET":
        if (args.includes("NX") && store.has(key)) return null;
        store.set(key, args[0]);
        return "OK";
      case "DEL":
        store.delete(key);
        return 1;
      case "INCR": {
        const next = Number(store.get(key) || 0) + 1;
        store.set(key, String(next));
        return next;
      }
      case "EXPIRE":
        return 1;
      case "SADD":
      case "SREM": {
        const set = new Set(store.get(key) || []);
        if (cmd === "SADD") set.add(args[0]);
        else set.delete(args[0]);
        store.set(key, [...set]);
        return 1;
      }
      case "SMEMBERS":
        return store.get(key) || [];
      case "HGET":
        return hash(key)[args[0]] ?? null;
      case "HSET":
        store.set(key, { ...hash(key), [args[0]]: args[1] });
        return 1;
      case "HDEL": {
        const next = { ...hash(key) };
        args.forEach((field) => delete next[field]);
        store.set(key, next);
        return args.length;
      }
      case "HGETALL":
        return Object.entries(hash(key)).flat();
      case "ZADD": {
        const next = new Map(zset(key));
        next.set(args[1], Number(args[0]));
        store.set(key, next);
        return 1;
      }
      case "ZREM": {
        const next = new Map(zset(key));
        next.delete(args[0]);
        store.set(key, next);
        return 1;
      }
      case "ZRANGEBYSCORE": {
        const [min, max, , offset, count] = args;
        return [...zset(key)]
          .filter(([, score]) => score >= Number(min) && score <= Number(max))
          .sort((a, b) => a[1] - b[1])
          .slice(
            Number(offset || 0),
            Number(offset || 0) + Number(count ?? 1e9),
          )
          .map(([member]) => member);
      }
      case "LPUSH":
        store.set(key, [...args.reverse(), ...(store.get(key) || [])]);
        return store.get(key).length;
      case "LTRIM":
        store.set(key, (store.get(key) || []).slice(0, Number(args[1]) + 1));
        return "OK";
      case "LRANGE":
        return (store.get(key) || []).slice(
          Number(args[0]),
          Number(args[1]) + 1,
        );
      default:
        throw new Error(`fakeRedis: unexpected command ${cmd}`);
    }
  };
  return { store, run };
}
