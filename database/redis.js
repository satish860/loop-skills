#!/usr/bin/env node

/**
 * Redis CLI via redis (node-redis)
 *
 * Usage:
 *   node redis.js get <key>                       # Get value
 *   node redis.js set <key> <value> [--ttl 3600]  # Set value
 *   node redis.js del <key>                       # Delete key
 *   node redis.js keys <pattern>                  # List keys (default: *)
 *   node redis.js scan <pattern> [--count 100]    # Scan keys (production-safe)
 *   node redis.js hget <key> <field>              # Hash get
 *   node redis.js hset <key> <field> <value>      # Hash set
 *   node redis.js hgetall <key>                   # Hash get all
 *   node redis.js lpush <key> <value>             # List push left
 *   node redis.js lrange <key> <start> <stop>     # List range
 *   node redis.js type <key>                      # Key type
 *   node redis.js ttl <key>                       # Key TTL
 *   node redis.js info                            # Server info
 *   node redis.js dbsize                          # Key count
 *   node redis.js flush                           # Flush current DB (DANGER)
 *
 * Connection: REDIS_URL env var (default: redis://localhost:6379)
 */

import { createClient } from "redis";

function parseArgs(args) {
  const result = { _: [] };
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) { result[key] = args[i + 1]; i += 2; }
      else { result[key] = true; i += 1; }
    } else { result._.push(args[i]); i += 1; }
  }
  return result;
}

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function withClient(fn) {
  const client = createClient({ url: REDIS_URL });
  client.on("error", (err) => { console.error(`Redis error: ${err.message}`); process.exit(1); });
  await client.connect();
  try { await fn(client); } finally { await client.disconnect(); }
}

async function getValue(key) {
  await withClient(async (client) => {
    const type = await client.type(key);
    switch (type) {
      case "string": console.log(await client.get(key)); break;
      case "list": {
        const vals = await client.lRange(key, 0, -1);
        vals.forEach((v) => console.log(v));
        break;
      }
      case "set": {
        const vals = await client.sMembers(key);
        vals.forEach((v) => console.log(v));
        break;
      }
      case "hash": {
        const vals = await client.hGetAll(key);
        console.log(JSON.stringify(vals, null, 2));
        break;
      }
      case "zset": {
        const vals = await client.zRangeWithScores(key, 0, -1);
        vals.forEach((v) => console.log(`${v.score}: ${v.value}`));
        break;
      }
      case "none": console.log("(nil)"); break;
      default: console.log(`Type: ${type}`); break;
    }
  });
}

async function setValue(key, value, opts) {
  await withClient(async (client) => {
    if (opts.ttl) {
      await client.setEx(key, parseInt(opts.ttl), value);
      console.log(`✅ SET ${key} (TTL: ${opts.ttl}s)`);
    } else {
      await client.set(key, value);
      console.log(`✅ SET ${key}`);
    }
  });
}

async function delKey(key) {
  await withClient(async (client) => {
    const count = await client.del(key);
    console.log(`✅ Deleted ${count} key(s)`);
  });
}

async function listKeys(pattern) {
  await withClient(async (client) => {
    const keys = await client.keys(pattern || "*");
    console.log(`Keys: ${keys.length}\n`);
    for (const key of keys.sort()) {
      const type = await client.type(key);
      const ttl = await client.ttl(key);
      const ttlStr = ttl === -1 ? "∞" : `${ttl}s`;
      console.log(`  ${key} (${type}, TTL: ${ttlStr})`);
    }
  });
}

async function scanKeys(pattern, opts) {
  await withClient(async (client) => {
    const count = parseInt(opts.count) || 100;
    let cursor = 0;
    let total = 0;
    do {
      const result = await client.scan(cursor, { MATCH: pattern || "*", COUNT: count });
      cursor = result.cursor;
      for (const key of result.keys) { console.log(key); total++; }
    } while (cursor !== 0);
    console.log(`\n${total} keys found.`);
  });
}

async function hget(key, field) {
  await withClient(async (client) => {
    const val = await client.hGet(key, field);
    console.log(val ?? "(nil)");
  });
}

async function hset(key, field, value) {
  await withClient(async (client) => {
    await client.hSet(key, field, value);
    console.log(`✅ HSET ${key}.${field}`);
  });
}

async function hgetall(key) {
  await withClient(async (client) => {
    const vals = await client.hGetAll(key);
    console.log(JSON.stringify(vals, null, 2));
  });
}

async function lpush(key, value) {
  await withClient(async (client) => {
    const len = await client.lPush(key, value);
    console.log(`✅ LPUSH ${key} (length: ${len})`);
  });
}

async function lrange(key, start, stop) {
  await withClient(async (client) => {
    const vals = await client.lRange(key, parseInt(start), parseInt(stop));
    vals.forEach((v) => console.log(v));
  });
}

async function keyType(key) {
  await withClient(async (client) => { console.log(await client.type(key)); });
}

async function keyTtl(key) {
  await withClient(async (client) => {
    const ttl = await client.ttl(key);
    console.log(ttl === -1 ? "No expiry" : ttl === -2 ? "Key does not exist" : `${ttl} seconds`);
  });
}

async function serverInfo() {
  await withClient(async (client) => {
    const info = await client.info();
    // Parse key sections
    const sections = ["Server", "Clients", "Memory", "Keyspace"];
    for (const section of sections) {
      const regex = new RegExp(`# ${section}\\r?\\n([\\s\\S]*?)(?=# |$)`, "i");
      const match = info.match(regex);
      if (match) {
        console.log(`\n# ${section}`);
        const lines = match[1].trim().split(/\r?\n/).slice(0, 8);
        for (const line of lines) console.log(`  ${line}`);
      }
    }
  });
}

async function dbsize() {
  await withClient(async (client) => {
    const size = await client.dbSize();
    console.log(`Keys: ${size}`);
  });
}

async function flushDb() {
  await withClient(async (client) => {
    await client.flushDb();
    console.log("✅ Database flushed.");
  });
}

// ── Main ──
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (!cmd || cmd === "--help") {
  console.log(`Redis CLI

Usage:
  node redis.js get <key>                          Get value (auto-detects type)
  node redis.js set <key> <value> [--ttl 3600]     Set string value
  node redis.js del <key>                          Delete key
  node redis.js keys <pattern>                     List keys (WARN: blocks on large DBs)
  node redis.js scan <pattern> [--count 100]       Scan keys (production-safe)
  node redis.js hget <key> <field>                 Hash get field
  node redis.js hset <key> <field> <value>         Hash set field
  node redis.js hgetall <key>                      Hash get all fields
  node redis.js lpush <key> <value>                List push left
  node redis.js lrange <key> <start> <stop>        List range
  node redis.js type <key>                         Key type
  node redis.js ttl <key>                          Key TTL
  node redis.js info                               Server info
  node redis.js dbsize                             Key count
  node redis.js flush                              ⚠️  Flush current DB

Connection: REDIS_URL=redis://host:6379 (default: redis://localhost:6379)`);
  process.exit(0);
}

try {
  switch (cmd) {
    case "get":     await getValue(args._[1]); break;
    case "set":     await setValue(args._[1], args._[2], args); break;
    case "del":     await delKey(args._[1]); break;
    case "keys":    await listKeys(args._[1]); break;
    case "scan":    await scanKeys(args._[1], args); break;
    case "hget":    await hget(args._[1], args._[2]); break;
    case "hset":    await hset(args._[1], args._[2], args._[3]); break;
    case "hgetall": await hgetall(args._[1]); break;
    case "lpush":   await lpush(args._[1], args._[2]); break;
    case "lrange":  await lrange(args._[1], args._[2], args._[3]); break;
    case "type":    await keyType(args._[1]); break;
    case "ttl":     await keyTtl(args._[1]); break;
    case "info":    await serverInfo(); break;
    case "dbsize":  await dbsize(); break;
    case "flush":   await flushDb(); break;
    default: console.error(`Unknown: ${cmd}`); process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
