#!/usr/bin/env node

/**
 * SQLite CLI via better-sqlite3
 *
 * Usage:
 *   node sqlite.js <dbFile> query "SELECT * FROM users LIMIT 10"
 *   node sqlite.js <dbFile> tables
 *   node sqlite.js <dbFile> describe <table>
 *   node sqlite.js <dbFile> count <table>
 *   node sqlite.js <dbFile> export <table> [--format csv|json]
 *   node sqlite.js <dbFile> indexes <table>
 *   node sqlite.js <dbFile> size
 *   node sqlite.js <dbFile> vacuum
 */

import Database from "better-sqlite3";
import { statSync } from "fs";

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

function withDb(dbFile, fn) {
  const db = new Database(dbFile, { readonly: false });
  db.pragma("journal_mode = WAL");
  try { fn(db); } finally { db.close(); }
}

function runQuery(dbFile, sql, opts) {
  withDb(dbFile, (db) => {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA") || trimmed.startsWith("WITH") || trimmed.startsWith("EXPLAIN")) {
      const rows = db.prepare(sql).all();
      formatRows(rows, opts);
    } else {
      const result = db.prepare(sql).run();
      console.log(`✅ ${result.changes} row(s) affected.`);
    }
  });
}

function listTables(dbFile, opts) {
  withDb(dbFile, (db) => {
    const rows = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
    formatRows(rows, opts);
  });
}

function describeTable(dbFile, table, opts) {
  withDb(dbFile, (db) => {
    console.log(`# ${table}\n`);
    const rows = db.prepare(`PRAGMA table_info('${table}')`).all();
    const formatted = rows.map((r) => ({
      column: r.name,
      type: r.type || "ANY",
      nullable: r.notnull ? "NO" : "YES",
      default: r.dflt_value,
      pk: r.pk ? "✅" : "",
    }));
    formatRows(formatted, opts);

    // Foreign keys
    const fks = db.prepare(`PRAGMA foreign_key_list('${table}')`).all();
    if (fks.length > 0) {
      console.log("\nForeign Keys:");
      for (const fk of fks) {
        console.log(`  ${fk.from} → ${fk.table}.${fk.to}`);
      }
    }
  });
}

function listIndexes(dbFile, table, opts) {
  withDb(dbFile, (db) => {
    const rows = db.prepare(`PRAGMA index_list('${table}')`).all();
    for (const idx of rows) {
      const cols = db.prepare(`PRAGMA index_info('${idx.name}')`).all();
      const unique = idx.unique ? " UNIQUE" : "";
      console.log(`${idx.name}${unique}: ${cols.map((c) => c.name).join(", ")}`);
    }
  });
}

function countTable(dbFile, table) {
  withDb(dbFile, (db) => {
    const row = db.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get();
    console.log(`${table}: ${row.count} rows`);
  });
}

function exportTable(dbFile, table, opts) {
  withDb(dbFile, (db) => {
    const rows = db.prepare(`SELECT * FROM "${table}"`).all();
    formatRows(rows, opts);
  });
}

function dbSize(dbFile) {
  const stats = statSync(dbFile);
  const sizeKB = (stats.size / 1024).toFixed(1);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`File: ${dbFile}`);
  console.log(`Size: ${sizeKB} KB (${sizeMB} MB)`);
}

function vacuum(dbFile) {
  withDb(dbFile, (db) => {
    const before = statSync(dbFile).size;
    db.pragma("journal_mode = DELETE");
    db.exec("VACUUM");
    const after = statSync(dbFile).size;
    const saved = ((before - after) / 1024).toFixed(1);
    console.log(`✅ Vacuumed. Saved ${saved} KB.`);
  });
}

// ── Main ──
const args = parseArgs(process.argv.slice(2));
const dbFile = args._[0];
const cmd = args._[1];

if (!dbFile || dbFile === "--help") {
  console.log(`SQLite CLI

Usage:
  node sqlite.js <dbFile> query "SELECT * FROM users LIMIT 10"
  node sqlite.js <dbFile> tables
  node sqlite.js <dbFile> describe <table>
  node sqlite.js <dbFile> indexes <table>
  node sqlite.js <dbFile> count <table>
  node sqlite.js <dbFile> export <table> [--format csv|json]
  node sqlite.js <dbFile> size
  node sqlite.js <dbFile> vacuum

Output format: --format table|json|csv (default: table)`);
  process.exit(0);
}

try {
  switch (cmd) {
    case "query":    runQuery(dbFile, args._[2], args); break;
    case "tables":   listTables(dbFile, args); break;
    case "describe": describeTable(dbFile, args._[2], args); break;
    case "indexes":  listIndexes(dbFile, args._[2], args); break;
    case "count":    countTable(dbFile, args._[2]); break;
    case "export":   exportTable(dbFile, args._[2], args); break;
    case "size":     dbSize(dbFile); break;
    case "vacuum":   vacuum(dbFile); break;
    default: console.error(`Unknown: ${cmd}`); process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
