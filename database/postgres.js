#!/usr/bin/env node

/**
 * PostgreSQL CLI via pg (node-postgres)
 *
 * Usage:
 *   node postgres.js query "SELECT * FROM users LIMIT 10"
 *   node postgres.js tables                              # List tables
 *   node postgres.js describe <table>                    # Table schema
 *   node postgres.js indexes <table>                     # Table indexes
 *   node postgres.js count <table>                       # Row count
 *   node postgres.js export <table> [--format csv|json]  # Export data
 *   node postgres.js databases                           # List databases
 *   node postgres.js size                                # Database sizes
 *
 * Connection: DATABASE_URL env var or --host/--port/--db/--user/--password flags
 */

import pg from "pg";

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
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  if (process.env.PG_CONNECTION_STRING) return { connectionString: process.env.PG_CONNECTION_STRING };
  return {
    host: opts.host || process.env.PGHOST || "localhost",
    port: parseInt(opts.port || process.env.PGPORT || "5432"),
    database: opts.db || process.env.PGDATABASE || "postgres",
    user: opts.user || process.env.PGUSER || "postgres",
    password: opts.password || process.env.PGPASSWORD || "",
  };
}

async function withClient(opts, fn) {
  const client = new pg.Client(getConnectionConfig(opts));
  try {
    await client.connect();
    await fn(client);
  } finally {
    await client.end();
  }
}

async function runQuery(sql, opts) {
  await withClient(opts, async (client) => {
    const result = await client.query(sql);
    if (result.rows.length === 0) { console.log("No rows returned."); return; }
    const format = opts.format || "table";
    if (format === "json") {
      for (const row of result.rows) console.log(JSON.stringify(row));
    } else if (format === "csv") {
      const cols = result.fields.map((f) => f.name);
      console.log(cols.join(","));
      for (const row of result.rows) {
        console.log(cols.map((c) => {
          const v = row[c];
          return v === null ? "" : typeof v === "string" && v.includes(",") ? `"${v}"` : String(v);
        }).join(","));
      }
    } else {
      // table format
      console.log(`Rows: ${result.rows.length}${result.rowCount > result.rows.length ? ` (of ${result.rowCount})` : ""}`);
      console.log();
      const cols = result.fields.map((f) => f.name);
      // Calculate column widths
      const widths = cols.map((c) => Math.max(c.length, ...result.rows.map((r) => String(r[c] ?? "NULL").length)));
      // Clamp to 40 chars
      const clamped = widths.map((w) => Math.min(w, 40));
      const header = cols.map((c, i) => c.padEnd(clamped[i])).join(" │ ");
      const separator = clamped.map((w) => "─".repeat(w)).join("─┼─");
      console.log(header);
      console.log(separator);
      for (const row of result.rows) {
        console.log(cols.map((c, i) => String(row[c] ?? "NULL").slice(0, 40).padEnd(clamped[i])).join(" │ "));
      }
    }
  });
}

async function listTables(opts) {
  const sql = `
    SELECT table_schema, table_name, table_type
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name`;
  await runQuery(sql, opts);
}

async function describeTable(table, opts) {
  const [schema, tbl] = table.includes(".") ? table.split(".") : ["public", table];
  const sql = `
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = '${schema}' AND table_name = '${tbl}'
    ORDER BY ordinal_position`;
  console.log(`# ${schema}.${tbl}\n`);
  await runQuery(sql, opts);

  // Primary key
  const pkSql = `
    SELECT a.attname FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = '${schema}.${tbl}'::regclass AND i.indisprimary`;
  await withClient(opts, async (client) => {
    const result = await client.query(pkSql);
    if (result.rows.length > 0) {
      console.log(`\nPrimary key: ${result.rows.map((r) => r.attname).join(", ")}`);
    }
  });
}

async function listIndexes(table, opts) {
  const [schema, tbl] = table.includes(".") ? table.split(".") : ["public", table];
  const sql = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = '${schema}' AND tablename = '${tbl}'`;
  await runQuery(sql, opts);
}

async function countTable(table, opts) {
  await withClient(opts, async (client) => {
    const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
    console.log(`${table}: ${result.rows[0].count} rows`);
  });
}

async function exportTable(table, opts) {
  const format = opts.format || "json";
  const sql = `SELECT * FROM ${table}`;
  await runQuery(sql, { ...opts, format });
}

async function listDatabases(opts) {
  const sql = `SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size FROM pg_database WHERE NOT datistemplate ORDER BY datname`;
  await runQuery(sql, opts);
}

async function databaseSize(opts) {
  const sql = `
    SELECT
      pg_size_pretty(pg_database_size(current_database())) AS database_size,
      (SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')) AS table_count`;
  await runQuery(sql, opts);
}

// ── Main ──
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (!cmd || cmd === "--help") {
  console.log(`PostgreSQL CLI

Usage:
  node postgres.js query "SELECT * FROM users LIMIT 10"    Run SQL
  node postgres.js tables                                  List tables
  node postgres.js describe <table>                        Table schema + PK
  node postgres.js indexes <table>                         Table indexes
  node postgres.js count <table>                           Row count
  node postgres.js export <table> [--format csv|json]      Export data
  node postgres.js databases                               List databases
  node postgres.js size                                    Database size

Connection (any of these):
  DATABASE_URL=postgres://user:pass@host:5432/db
  PG_CONNECTION_STRING=postgres://...
  PGHOST + PGPORT + PGDATABASE + PGUSER + PGPASSWORD
  --host localhost --port 5432 --db mydb --user postgres --password secret`);
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
    case "size":      await databaseSize(args); break;
    default: console.error(`Unknown: ${cmd}`); process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
