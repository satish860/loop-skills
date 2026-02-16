#!/usr/bin/env node

/**
 * Salesforce CLI via jsforce
 *
 * Usage:
 *   node salesforce.js query "SELECT Id, Name FROM Account LIMIT 10"
 *   node salesforce.js describe Account
 *   node salesforce.js get Account <recordId>
 *   node salesforce.js create Account --field "Name=Acme Corp" --field "Industry=Tech"
 *   node salesforce.js update Account <recordId> --field "Name=New Name"
 *   node salesforce.js search "FIND {Acme} IN ALL FIELDS"
 *   node salesforce.js objects                          # List all objects
 */

import jsforce from "jsforce";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_DIR = join(homedir(), ".salesforce-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return null;
  return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
}

function saveConfig(config) {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function parseArgs(args) {
  const result = { _: [], field: [] };
  let i = 0;
  while (i < args.length) {
    if (args[i] === "--field" && i + 1 < args.length) {
      result.field.push(args[i + 1]); i += 2;
    } else if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1]; i += 2;
      } else { result[key] = true; i += 1; }
    } else { result._.push(args[i]); i += 1; }
  }
  return result;
}

async function getConnection() {
  // Try env vars first
  const loginUrl = process.env.SF_LOGIN_URL || "https://login.salesforce.com";

  if (process.env.SF_ACCESS_TOKEN && process.env.SF_INSTANCE_URL) {
    return new jsforce.Connection({
      instanceUrl: process.env.SF_INSTANCE_URL,
      accessToken: process.env.SF_ACCESS_TOKEN,
    });
  }

  // Try saved config
  const config = loadConfig();
  if (config?.accessToken && config?.instanceUrl) {
    const conn = new jsforce.Connection({
      instanceUrl: config.instanceUrl,
      accessToken: config.accessToken,
    });
    // Test connection
    try { await conn.identity(); return conn; } catch { /* token expired, re-login */ }
  }

  // Username/password login
  const username = process.env.SF_USERNAME || config?.username;
  const password = process.env.SF_PASSWORD || config?.password;
  const token = process.env.SF_SECURITY_TOKEN || config?.securityToken || "";

  if (!username || !password) {
    console.error(`Error: Salesforce credentials not configured.

Option 1 — Environment variables:
  export SF_USERNAME=user@company.com
  export SF_PASSWORD=yourpassword
  export SF_SECURITY_TOKEN=yoursecuritytoken   # optional
  export SF_LOGIN_URL=https://login.salesforce.com  # or test.salesforce.com for sandbox

Option 2 — Access token:
  export SF_INSTANCE_URL=https://your-instance.salesforce.com
  export SF_ACCESS_TOKEN=your-access-token

Option 3 — Setup command:
  node salesforce.js setup`);
    process.exit(1);
  }

  const conn = new jsforce.Connection({ loginUrl });
  await conn.login(username, password + token);

  // Save tokens for reuse
  saveConfig({
    username,
    instanceUrl: conn.instanceUrl,
    accessToken: conn.accessToken,
  });

  return conn;
}

async function setup() {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  console.log("Salesforce CLI Setup\n");
  const username = await ask("Username (email): ");
  const password = await ask("Password: ");
  const securityToken = await ask("Security Token (or press Enter to skip): ");
  const loginUrl = await ask("Login URL (Enter for production, or https://test.salesforce.com): ");

  rl.close();

  saveConfig({
    username: username.trim(),
    password: password.trim(),
    securityToken: securityToken.trim(),
    loginUrl: loginUrl.trim() || "https://login.salesforce.com",
  });

  console.log(`\n✅ Config saved to ${CONFIG_FILE}`);

  // Test connection
  try {
    const conn = await getConnection();
    const identity = await conn.identity();
    console.log(`✅ Connected as ${identity.display_name} (${identity.username})`);
  } catch (err) {
    console.error(`❌ Login failed: ${err.message}`);
  }
}

async function soqlQuery(soql) {
  const conn = await getConnection();
  const result = await conn.query(soql);
  console.log(`Records: ${result.totalSize}`);
  for (const record of result.records) {
    const { attributes, ...fields } = record;
    console.log(JSON.stringify(fields));
  }
}

async function describeObject(objectName) {
  const conn = await getConnection();
  const meta = await conn.sobject(objectName).describe();
  console.log(`# ${meta.label} (${meta.name})`);
  console.log(`Records: ${meta.urls?.rowTemplate ? "queryable" : "n/a"}`);
  console.log(`\nFields (${meta.fields.length}):`);
  for (const f of meta.fields.slice(0, 50)) {
    const req = f.nillable ? "" : " *required*";
    console.log(`  ${f.name} (${f.type}${f.length ? `, ${f.length}` : ""})${req} — ${f.label}`);
  }
  if (meta.fields.length > 50) console.log(`  ... and ${meta.fields.length - 50} more`);
}

async function getRecord(objectName, recordId) {
  const conn = await getConnection();
  const record = await conn.sobject(objectName).retrieve(recordId);
  const { attributes, ...fields } = record;
  console.log(JSON.stringify(fields, null, 2));
}

async function createRecord(objectName, fields) {
  const conn = await getConnection();
  const data = {};
  for (const f of fields) {
    const [name, ...vParts] = f.split("=");
    data[name] = vParts.join("=");
  }
  const result = await conn.sobject(objectName).create(data);
  if (result.success) {
    console.log(`✅ Created ${objectName}: ${result.id}`);
  } else {
    console.error(`❌ Failed: ${JSON.stringify(result.errors)}`);
  }
}

async function updateRecord(objectName, recordId, fields) {
  const conn = await getConnection();
  const data = { Id: recordId };
  for (const f of fields) {
    const [name, ...vParts] = f.split("=");
    data[name] = vParts.join("=");
  }
  const result = await conn.sobject(objectName).update(data);
  if (result.success) {
    console.log(`✅ Updated ${objectName}: ${recordId}`);
  } else {
    console.error(`❌ Failed: ${JSON.stringify(result.errors)}`);
  }
}

async function soslSearch(sosl) {
  const conn = await getConnection();
  const result = await conn.search(sosl);
  for (const record of result.searchRecords) {
    console.log(`${record.attributes.type}: ${record.Name || record.Id}`);
    console.log(`  ID: ${record.Id}`);
  }
}

async function listObjects() {
  const conn = await getConnection();
  const result = await conn.describeGlobal();
  const custom = result.sobjects.filter((o) => o.custom);
  const standard = result.sobjects.filter((o) => !o.custom && o.queryable).slice(0, 30);

  console.log("Standard Objects (top 30 queryable):");
  for (const o of standard) console.log(`  ${o.name} — ${o.label}`);

  if (custom.length) {
    console.log(`\nCustom Objects (${custom.length}):`);
    for (const o of custom) console.log(`  ${o.name} — ${o.label}`);
  }
}

// ── Main ──
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (!cmd || cmd === "--help") {
  console.log(`Salesforce CLI

Usage:
  node salesforce.js setup                                              Interactive setup
  node salesforce.js query "SELECT Id, Name FROM Account LIMIT 10"      SOQL query
  node salesforce.js describe Account                                   Object metadata
  node salesforce.js get Account <recordId>                             Get record
  node salesforce.js create Account --field "Name=Acme" --field "Industry=Tech"
  node salesforce.js update Account <recordId> --field "Name=New Name"
  node salesforce.js search "FIND {Acme} IN ALL FIELDS"                 SOSL search
  node salesforce.js objects                                            List all objects

Auth: SF_USERNAME + SF_PASSWORD env vars, or SF_ACCESS_TOKEN + SF_INSTANCE_URL, or 'setup' command.`);
  process.exit(0);
}

try {
  switch (cmd) {
    case "setup":    await setup(); break;
    case "query":    await soqlQuery(args._[1]); break;
    case "describe": await describeObject(args._[1]); break;
    case "get":      await getRecord(args._[1], args._[2]); break;
    case "create":   await createRecord(args._[1], args.field); break;
    case "update":   await updateRecord(args._[1], args._[2], args.field); break;
    case "search":   await soslSearch(args._[1]); break;
    case "objects":  await listObjects(); break;
    default: console.error(`Unknown: ${cmd}`); process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
