#!/usr/bin/env node

/**
 * MySQL CLI via mysql2
 *
 * Usage:
 *   node mysql.js query "SELECT * FROM users LIMIT 10"
 *   node mysql.js tables
 *   node mysql.js describe <table>
 *   node mysql.js indexes <table>
 *   node mysql.js count <table>
 *   node mysql.js export <table> [--format csv|json]
 *   node mysql.js databases
 *   node mysql.js size
 *
 * Connection: MYSQL_URL env var or --host/--port/--db/--user/--password flags
 */

import mysql from "mysql2/promise";

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

function getConnectionConfig(opts) {
  if (process.env.MYSQL_URL) return process.env.MYSQL_URL;
  return {
    host: opts.host || process.env.MYSQL_HOST || "localhost",
    port: parseInt(opts.port || process.env.MYSQL_PORT || "3306"),
    database: opts.db || process.env.MYSQL_DATABASE || "",
    user: opts.user || process.env.MYSQL_USER || "root",
    password: opts.password || process.env.MYSQL_PASSWORD || "",
  };
}

function formatRows(rows, opts) {
  if (!rows || rows.length === 0) { console.log("No rows returned."); return; }
  const format = opts.format || "table";

  if (format === "json") {
    for (const row of rows) console.log(JSON.stringify(row));
  } else if (format === "csv") {
    const cols = Object.keys(rows[0]);
    console.log(cols.join(","));
    for (const row of rows) {
      console.log(cols.map((c) => {
        const v = row[c];
        return v === null ? "" : typeof v === "string" && v.includes(",") ? `"${v}"` : String(v);
      }).join(","));
    }
  } else {
    console.log(`Rows: ${rows.length}\n`);
    const cols = Object.keys(rows[0]);
    const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "NULL").length)));
    const clamped = widths.map((w) => Math.min(w, 40));
    console.log(cols.map((c, i) => c.padEnd(clamped[i])).join(" │ "));
    console.log(clamped.map((w) => "─".repeat(w)).join("─┼─"));
    for (const row of rows) {
      console.log(cols.map((c, i) => String(row[c] ?? "NULL").slice(0, 40).padEnd(clamped[i])).join(" │ "));
    }
  }
}

async function withConnection(opts, fn) {
  const conn = await mysql.createConnection(getConnectionConfig(opts));
  try { await fn(conn); } finally { await conn.end(); }
}

async function runQuery(sql, opts) {
  await withConnection(opts, async (conn) => {
    const [rows] = await conn.execute(sql);
    if (Array.isArray(rows)) { formatRows(rows, opts); }
    else { console.log(`✅ ${rows.affectedRows} row(s) affected.`); }
  });
}

async function listTables(opts) {
  await runQuery("SHOW TABLES", opts);
}

async function describeTable(table, opts) {
  console.log(`# ${table}\n`);
  await runQuery(`DESCRIBE \`${table}\``, opts);
}

async function listIndexes(table, opts) {
  await runQuery(`SHOW INDEX FROM \`${table}\``, opts);
}

async function countTable(table, opts) {
  await withConnection(opts, async (conn) => {
    const [rows] = await conn.execute(`SELECT COUNT(*) as count FROM \`${table}\``);
    console.log(`${table}: ${rows[0].count} rows`);
  });
}

async function exportTable(table, opts) {
  await runQuery(`SELECT * FROM \`${table}\``, opts);
}

async function listDatabases(opts) {
  await runQuery("SHOW DATABASES", opts);
}

async function dbSize(opts) {
  const sql = `
    SELECT table_schema AS db,
      ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb,
      SUM(table_rows) AS rows
    FROM information_schema.tables
    GROUP BY table_schema
    ORDER BY size_mb DESC`;
  await runQuery(sql, opts);
}

// ── Main ──
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (!cmd || cmd === "--help") {
  console.log(`MySQL CLI

Usage:
  node mysql.js query "SELECT * FROM users LIMIT 10"   Run SQL
  node mysql.js tables                                 List tables
  node mysql.js describe <table>                       Table schema
  node mysql.js indexes <table>                        Table indexes
  node mysql.js count <table>                          Row count
  node mysql.js export <table> [--format csv|json]     Export data
  node mysql.js databases                              List databases
  node mysql.js size                                   Database sizes

Connection (any of these):
  MYSQL_URL=mysql://user:pass@host:3306/db
  MYSQL_HOST + MYSQL_PORT + MYSQL_DATABASE + MYSQL_USER + MYSQL_PASSWORD
  --host localhost --port 3306 --db mydb --user root --password secret`);
  process.exit(0);
}

try {
  switch (cmd) {
    case "query":     await runQuery(args._[1], args); break;
    case "tables":    await listTables(args); break;
    case "describe":  await describeTable(args._[1], args); break;
    case "indexes":   await listIndexes(args._[1], args); break;
    case "count":     await countTable(args._[1], args); break;
    case "export":    await exportTable(args._[1], args); break;
    case "databases": await listDatabases(args); break;
    case "size":      await dbSize(args); break;
    default: console.error(`Unknown: ${cmd}`); process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
