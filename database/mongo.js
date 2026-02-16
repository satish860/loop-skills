#!/usr/bin/env node

/**
 * MongoDB CLI via mongodb driver
 *
 * Usage:
 *   node mongo.js collections                                 # List collections
 *   node mongo.js find <collection> [--filter '{"age":{"$gt":25}}'] [--limit 10]
 *   node mongo.js findOne <collection> <id>                   # Get by _id
 *   node mongo.js insert <collection> '{"name":"John"}'       # Insert document
 *   node mongo.js update <collection> <id> '{"name":"Jane"}'  # Update by _id
 *   node mongo.js delete <collection> <id>                    # Delete by _id
 *   node mongo.js count <collection> [--filter '{}']          # Count docs
 *   node mongo.js aggregate <collection> '[{"$group":{...}}]' # Aggregation
 *   node mongo.js indexes <collection>                        # List indexes
 *   node mongo.js stats                                       # Database stats
 *
 * Connection: MONGODB_URL env var (default: mongodb://localhost:27017/test)
 */

import { MongoClient, ObjectId } from "mongodb";

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

const MONGODB_URL = process.env.MONGODB_URL || process.env.MONGO_URL || "mongodb://localhost:27017/test";

function parseId(id) {
  try { return new ObjectId(id); } catch { return id; }
}

async function withDb(fn) {
  const client = new MongoClient(MONGODB_URL);
  try {
    await client.connect();
    const dbName = new URL(MONGODB_URL).pathname.slice(1) || "test";
    const db = client.db(dbName);
    await fn(db);
  } finally {
    await client.close();
  }
}

async function listCollections() {
  await withDb(async (db) => {
    const collections = await db.listCollections().toArray();
    for (const c of collections) {
      const stats = await db.collection(c.name).estimatedDocumentCount();
      console.log(`📄 ${c.name} (${c.type}) — ~${stats} docs`);
    }
  });
}

async function findDocs(collection, opts) {
  await withDb(async (db) => {
    const filter = opts.filter ? JSON.parse(opts.filter) : {};
    const limit = parseInt(opts.limit) || 20;
    const sort = opts.sort ? JSON.parse(opts.sort) : {};
    const projection = opts.fields ? Object.fromEntries(opts.fields.split(",").map((f) => [f.trim(), 1])) : {};

    const docs = await db.collection(collection).find(filter, { projection }).sort(sort).limit(limit).toArray();
    console.log(`Documents: ${docs.length}\n`);
    for (const doc of docs) {
      console.log(JSON.stringify(doc));
    }
  });
}

async function findOne(collection, id) {
  await withDb(async (db) => {
    const doc = await db.collection(collection).findOne({ _id: parseId(id) });
    if (doc) { console.log(JSON.stringify(doc, null, 2)); }
    else { console.log("Not found."); }
  });
}

async function insertDoc(collection, jsonStr) {
  await withDb(async (db) => {
    const doc = JSON.parse(jsonStr);
    const result = await db.collection(collection).insertOne(doc);
    console.log(`✅ Inserted: ${result.insertedId}`);
  });
}

async function updateDoc(collection, id, jsonStr) {
  await withDb(async (db) => {
    const update = JSON.parse(jsonStr);
    const result = await db.collection(collection).updateOne(
      { _id: parseId(id) },
      { $set: update }
    );
    console.log(`✅ Modified: ${result.modifiedCount} document(s)`);
  });
}

async function deleteDoc(collection, id) {
  await withDb(async (db) => {
    const result = await db.collection(collection).deleteOne({ _id: parseId(id) });
    console.log(`✅ Deleted: ${result.deletedCount} document(s)`);
  });
}

async function countDocs(collection, opts) {
  await withDb(async (db) => {
    const filter = opts.filter ? JSON.parse(opts.filter) : {};
    const count = await db.collection(collection).countDocuments(filter);
    console.log(`${collection}: ${count} documents`);
  });
}

async function aggregate(collection, pipelineStr) {
  await withDb(async (db) => {
    const pipeline = JSON.parse(pipelineStr);
    const docs = await db.collection(collection).aggregate(pipeline).toArray();
    for (const doc of docs) console.log(JSON.stringify(doc));
  });
}

async function listIndexes(collection) {
  await withDb(async (db) => {
    const indexes = await db.collection(collection).indexes();
    for (const idx of indexes) {
      const unique = idx.unique ? " UNIQUE" : "";
      const keys = Object.entries(idx.key).map(([k, v]) => `${k}:${v}`).join(", ");
      console.log(`${idx.name}${unique}: {${keys}}`);
    }
  });
}

async function dbStats() {
  await withDb(async (db) => {
    const stats = await db.stats();
    console.log(`Database: ${stats.db}`);
    console.log(`Collections: ${stats.collections}`);
    console.log(`Documents: ${stats.objects}`);
    console.log(`Data size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Storage: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Indexes: ${stats.indexes}`);
    console.log(`Index size: ${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`);
  });
}

// ── Main ──
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (!cmd || cmd === "--help") {
  console.log(`MongoDB CLI

Usage:
  node mongo.js collections                                           List collections
  node mongo.js find <coll> [--filter '{"age":{"$gt":25}}'] [--limit 10]
  node mongo.js findOne <coll> <id>                                   Get by _id
  node mongo.js insert <coll> '{"name":"John","age":30}'              Insert
  node mongo.js update <coll> <id> '{"name":"Jane"}'                  Update ($set)
  node mongo.js delete <coll> <id>                                    Delete
  node mongo.js count <coll> [--filter '{}']                          Count
  node mongo.js aggregate <coll> '[{"$group":{"_id":"$status"}}]'     Aggregate
  node mongo.js indexes <coll>                                        List indexes
  node mongo.js stats                                                 Database stats

Connection: MONGODB_URL=mongodb://host:27017/dbname (default: mongodb://localhost:27017/test)`);
  process.exit(0);
}

try {
  switch (cmd) {
    case "collections": await listCollections(); break;
    case "find":        await findDocs(args._[1], args); break;
    case "findOne":     await findOne(args._[1], args._[2]); break;
    case "insert":      await insertDoc(args._[1], args._[2]); break;
    case "update":      await updateDoc(args._[1], args._[2], args._[3]); break;
    case "delete":      await deleteDoc(args._[1], args._[2]); break;
    case "count":       await countDocs(args._[1], args); break;
    case "aggregate":   await aggregate(args._[1], args._[2]); break;
    case "indexes":     await listIndexes(args._[1]); break;
    case "stats":       await dbStats(); break;
    default: console.error(`Unknown: ${cmd}`); process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
